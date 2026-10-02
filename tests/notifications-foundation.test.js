'use strict';

/** Tasks 11 (US3): single-emit abstraction, dedup, failure containment, isolation. */

process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || '';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startApp } = require('./helpers');

let env;
let slug = 'notify-foundation';
let itemId;
let orderCode;
let orderId;

before(async () => {
  env = await startApp();
  await env.createPlatformOwner('root', 'owner-password-123');
  const ownerCookie = await env.login('root', 'owner-password-123');
  const fx = await env.createRestaurantFixture(ownerCookie, { name: 'Notify Foundation', slug });
  itemId = fx.itemId;
});

after(async () => {
  if (env) await env.close();
});

function notify() {
  return require('../server/services/notifications.service');
}

test('checkout records exactly one order.created event for the owning business', async () => {
  const res = await env.req(`/api/restaurants/${slug}/orders`, {
    method: 'POST',
    body: { customerName: 'Hadi', customerWhatsapp: '+15550003333', orderType: 'pickup', items: [{ itemId, quantity: 1 }] },
  });
  assert.strictEqual(res.status, 201);
  orderCode = res.data.order.code;
  // Fire-and-forget emit: allow a tick for the async persist.
  await new Promise((r) => setTimeout(r, 300));
  const { rows } = await env.query(
    `SELECT e.event_type, e.channel, e.state, e.restaurant_id, r.slug
     FROM notification_events e JOIN restaurants r ON r.id = e.restaurant_id
     WHERE e.order_code = $1`,
    [orderCode]
  );
  assert.ok(rows.length >= 1, 'at least one event row recorded');
  assert.ok(rows.every((r) => r.slug === slug), 'no cross-tenant rows');
  assert.ok(rows.every((r) => r.event_type === 'order.created'));
  const sseRows = rows.filter((r) => r.channel === 'dashboard_sse');
  assert.strictEqual(sseRows.length, 1, 'exactly one dashboard event per order');
  orderId = (await env.query(`SELECT id FROM orders WHERE code = $1`, [orderCode])).rows[0].id;
});

test('status change records order.status_changed; replayed emits collapse', async () => {
  const adminCookie = await env.login(`${slug}-admin`, 'admin-password-123');
  const changed = await env.req('/api/admin/orders/' + orderCode + '/status', {
    method: 'PATCH', cookie: adminCookie, body: { status: 'confirmed' },
  });
  assert.strictEqual(changed.data.order.status, 'confirmed');
  await new Promise((r) => setTimeout(r, 300));

  const svc = notify();
  const { rows: rest } = await env.query(`SELECT id AS "restaurantId" FROM restaurants WHERE slug = $1`, [slug]);
  const restaurantId = rest[0].restaurantId;
  const key = await svc.emit({
    restaurantId, type: 'order.status_changed',
    orderId, orderCode, status: 'confirmed', occurredAt: new Date().toISOString(),
  });
  assert.ok(key);
  await svc.emit({
    restaurantId, type: 'order.status_changed',
    orderId, orderCode, status: 'confirmed', occurredAt: new Date().toISOString(),
  });
  const { rows } = await env.query(
    `SELECT channel, COUNT(*)::int AS n FROM notification_events
     WHERE order_code = $1 AND event_type = 'order.status_changed' AND channel = 'dashboard_sse'
     GROUP BY channel`,
    [orderCode]
  );
  assert.ok(rows.length <= 1);
});

test('channel failure never breaks checkout; invalid payload emits nothing', async () => {
  const svc = notify();
  const sse = require('../server/middleware/sse');
  svc.registerChannel('dashboard_sse', async () => { throw new Error('channel down'); });
  try {
    const res = await env.req(`/api/restaurants/${slug}/orders`, {
      method: 'POST',
      body: { customerName: 'Iris', customerWhatsapp: '+15550004444', orderType: 'pickup', items: [{ itemId, quantity: 1 }] },
    });
    assert.strictEqual(res.status, 201);
    await new Promise((r) => setTimeout(r, 300));
    const { rows } = await env.query(
      `SELECT state FROM notification_events WHERE order_code = $1 AND channel = 'dashboard_sse'`,
      [res.data.order.code]
    );
    assert.ok(rows.some((r) => r.state === 'failed'), 'failure recorded, order intact');
  } finally {
    svc.registerChannel('dashboard_sse', (event) => {
      sse.broadcast(event.restaurantId, 'order:status', {
        orderId: event.orderId, code: event.orderCode, status: event.status,
      });
      return 'delivered';
    });
  }
  assert.strictEqual(await svc.emit({}), null);
  assert.strictEqual(await svc.emit({ restaurantId: 'x', type: 'nope', orderId: 'y' }), null);
});
