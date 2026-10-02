'use strict';

/**
 * Internal notification abstraction (Tasks 11).
 *
 * Order logic emits one domain event per change AFTER its transaction
 * commits; channels fan out asynchronously. Emit NEVER throws into order
 * writes — channel failures are recorded, never propagated.
 *
 * Channels: `dashboard_sse` (active, wraps middleware/sse.js).
 * `push` stays default-off until VAPID keys are configured (foundation
 * only: storage shape in 025, no live send path).
 */

const { query } = require('../db/pool');
const sse = require('../middleware/sse');

const EVENT_TYPES = ['order.created', 'order.status_changed'];
const CHANNELS = ['dashboard_sse', 'push'];

// Single platform-wide VAPID identity (clarified 012): tenant isolation comes
// from per-business subscriptions and scoped fan-out, not per-tenant keys.
function pushConfig() {
  const publicKey = (process.env.VAPID_PUBLIC_KEY || '').trim();
  const privateKey = (process.env.VAPID_PRIVATE_KEY || '').trim();
  const subject = (process.env.VAPID_SUBJECT || '').trim();
  const enabled = process.env.PUSH_ENABLED === '1' && Boolean(publicKey);
  return { publicKey, privateKey, subject, enabled };
}

const PUSH_ENABLED = pushConfig().enabled;
const RETENTION_DAYS = 30;
const PUSH_CONCURRENCY = 5;
const PUSH_TTL_SECONDS = 24 * 60 * 60;

/* Transport seam: tests inject a fake via setPushTransport; production
   uses the web-push library. Never import web-push at module top so unit
   contexts without keys stay inert. */
let pushTransport = null;
function setPushTransport(fn) {
  pushTransport = fn;
}

function defaultPushTransport(subscription, payload, vapid) {
  const webPush = require('web-push');
  webPush.setVapidDetails(vapid.subject || 'mailto:admin@localhost', vapid.publicKey, vapid.privateKey);
  return webPush.sendNotification(
    { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
    payload,
    { TTL: PUSH_TTL_SECONDS }
  );
}

const senders = {
  dashboard_sse(event) {
    if (event.type === 'order.created') {
      sse.broadcast(event.restaurantId, 'order:new', {
        orderId: event.orderId,
        code: event.orderCode,
        totalCents: event.totalCents,
        orderType: event.orderType,
      });
    } else if (event.type === 'order.status_changed') {
      sse.broadcast(event.restaurantId, 'order:status', {
        orderId: event.orderId,
        code: event.orderCode,
        status: event.status,
      });
    }
    return 'delivered';
  },
  async push(event) {
    return pushToSubscribers(event);
  },
};

/**
 * Real Web Push fan-out for `order.created` (012). Status changes never
 * enter this sender. Minimal payload (no customer PII). Never throws:
 * resolves to a row state for emit() to record.
 */
async function pushToSubscribers(event) {
  if (event.type !== 'order.created') return 'skipped';
  const { publicKey, privateKey, subject, enabled } = pushConfig();
  if (!enabled || !privateKey) return 'skipped';
  let subs;
  try {
    const res = await query(
      `SELECT s.id, s.endpoint, s.p256dh, s.auth, r.name AS business_name
       FROM push_subscriptions s
       JOIN restaurants r ON r.id = s.restaurant_id
       WHERE s.restaurant_id = $1 AND s.is_active`,
      [event.restaurantId]
    );
    subs = res.rows;
  } catch {
    return 'failed';
  }
  if (!subs.length) return 'skipped';
  const transport = pushTransport || defaultPushTransport;
  const vapid = { publicKey, privateKey, subject };
  const business = subs[0].business_name || '';
  const payload = JSON.stringify({
    title: 'طلب جديد · New order',
    body: `${business} — ${event.orderCode || ''}`.trim(),
    tag: `new-order:${event.orderCode || event.orderId}`,
    url: '/admin.html#orders',
  });
  let delivered = 0;
  let attempted = 0;
  const queue = subs.slice();
  const workers = Array.from({ length: Math.min(PUSH_CONCURRENCY, queue.length) }, async () => {
    while (queue.length) {
      const sub = queue.shift();
      attempted += 1;
      try {
        await transport(sub, payload, vapid);
        delivered += 1;
      } catch (err) {
        const code = err && err.statusCode;
        if (code === 404 || code === 410) {
          try {
            await query(`UPDATE push_subscriptions SET is_active = FALSE WHERE id = $1`, [sub.id]);
          } catch {
            /* best-effort cleanup */
          }
        }
      }
    }
  });
  try {
    await Promise.all(workers);
  } catch {
    return 'failed';
  }
  return delivered > 0 ? 'delivered' : 'failed';
}

function registerChannel(name, sender) {
  if (!CHANNELS.includes(name)) throw new Error(`Unknown notification channel: ${name}`);
  senders[name] = sender;
}

function eventKeyOf({ type, orderId, status, occurredAt }) {
  if (type === 'order.created') return `order.created:${orderId}`;
  return `order.status:${orderId}:${status}:${new Date(occurredAt).getTime()}`;
}

function activeChannels() {
  return PUSH_ENABLED ? CHANNELS : CHANNELS.filter((c) => c !== 'push');
}

async function claimRow(row) {
  try {
    const { rowCount } = await query(
      `INSERT INTO notification_events
         (restaurant_id, event_key, event_type, order_id, order_code, status, channel, state)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
       ON CONFLICT (event_key) DO NOTHING`,
      [row.restaurantId, row.eventKey, row.type, row.orderId || null, row.orderCode || null,
        row.status || null, row.channel]
    );
    return rowCount > 0;
  } catch {
    return true; // persistence is best-effort; still attempt in-process delivery
  }
}

async function markRow(eventKey, state) {
  try {
    await query(`UPDATE notification_events SET state = $2 WHERE event_key = $1`, [eventKey, state]);
  } catch {
    /* best-effort */
  }
}

/**
 * Emit a domain event. Never throws. Returns the event key or null when
 * the payload is not emittable (missing tenant/order identity).
 * First claim wins per channel: replays collapse to one visible send.
 */
async function emit(input = {}) {
  const { restaurantId, type, orderId } = input;
  if (!restaurantId || !EVENT_TYPES.includes(type) || !orderId) return null;
  const event = { ...input, occurredAt: input.occurredAt || new Date().toISOString() };
  const eventKey = eventKeyOf(event);
  for (const channel of activeChannels()) {
    const key = `${eventKey}:${channel}`;
    try {
      if (!(await claimRow({ ...event, eventKey: key, channel }))) continue;
      let state = 'delivered';
      try {
        const r = await senders[channel](event);
        state = r === 'failed' ? 'failed' : r === 'skipped' ? 'skipped' : 'delivered';
      } catch {
        state = 'failed';
      }
      await markRow(key, state);
    } catch {
      /* contained: order writes never observe channel outcomes */
    }
  }
  return eventKey;
}

async function cleanupOld() {
  const { rowCount } = await query(
    `DELETE FROM notification_events WHERE created_at < now() - make_interval(days => $1)`,
    [RETENTION_DAYS]
  );
  return rowCount;
}

/* ------------------- push subscription store -------------------- */
/* Tenant ALWAYS comes from the authenticated session (callers pass
   tenantId(req)); browser-supplied business/owner ids are never read. */

async function listSubscriptions(restaurantId) {
  const { rows } = await query(
    `SELECT id, label, is_active, created_at
     FROM push_subscriptions WHERE restaurant_id = $1 ORDER BY created_at DESC`,
    [restaurantId]
  );
  return rows;
}

async function saveSubscription(restaurantId, { endpoint, p256dh, auth, label }) {
  const { rows } = await query(
    `INSERT INTO push_subscriptions (restaurant_id, endpoint, p256dh, auth, label, is_active)
     VALUES ($1, $2, $3, $4, $5, TRUE)
     ON CONFLICT (endpoint) DO UPDATE SET
       restaurant_id = EXCLUDED.restaurant_id,
       p256dh = EXCLUDED.p256dh,
       auth = EXCLUDED.auth,
       label = EXCLUDED.label,
       is_active = TRUE,
       updated_at = now()
     RETURNING id`,
    [restaurantId, endpoint, p256dh, auth, label || '']
  );
  return rows[0];
}

async function removeSubscription(restaurantId, id) {
  const { rowCount } = await query(
    `DELETE FROM push_subscriptions WHERE id = $1 AND restaurant_id = $2`,
    [id, restaurantId]
  );
  return rowCount > 0;
}

function vapidPublic() {
  const { publicKey, enabled } = pushConfig();
  return { enabled, publicKey: enabled ? publicKey : null };
}

module.exports = {
  EVENT_TYPES,
  CHANNELS,
  PUSH_ENABLED,
  RETENTION_DAYS,
  emit,
  registerChannel,
  cleanupOld,
  eventKeyOf,
  listSubscriptions,
  saveSubscription,
  removeSubscription,
  vapidPublic,
  setPushTransport,
};
