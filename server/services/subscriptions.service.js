'use strict';

/**
 * Subscription lifecycle: explicit six-state machine with read-time
 * derivation (no scheduler exists, none is added). Stored `suspended` and
 * `cancelled` override derivation; trial/active/grace/expired resolve from
 * server timestamps. Every mutation mirrors the effective access end into
 * restaurants.subscription_ends_at in the same transaction (see note on
 * deriveEffectiveEndsAt) and writes exactly one audit row.
 */

const { query, withTx } = require('../db/pool');
const { conflict, notFound } = require('../utils/errors');
const observe = require('../utils/observe');

const STATUSES = ['trial', 'active', 'grace', 'expired', 'cancelled', 'suspended'];
/* Explicit transitions only; anything else is 409 INVALID_TRANSITION. */
const TRANSITIONS = {
  trial: ['active', 'grace', 'expired', 'cancelled', 'suspended'],
  active: ['grace', 'expired', 'cancelled', 'suspended'],
  grace: ['active', 'expired', 'cancelled', 'suspended'],
  expired: ['active', 'cancelled', 'suspended'],
  cancelled: ['active'],
  suspended: ['active'],
};

function asDate(v) {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * Pure derivation. `sub` = subscription row (or null for grandfather-less
 * legacy, treated like the old clock). Returns effective state + the end
 * instant gates should enforce (grace_until while in grace).
 */
function derive(sub, endsAt, now = Date.now()) {
  if (!sub) {
    const end = asDate(endsAt);
    const active = !end || end > now;
    return { state: active ? 'active' : 'expired', accessEndsAt: endsAt || null };
  }
  if (sub.status === 'suspended') return { state: 'suspended', accessEndsAt: sub.current_period_end };
  if (sub.status === 'cancelled') {
    const eff = asDate(sub.cancel_effective_at) || asDate(sub.current_period_end);
    if (eff && eff > now) return { state: 'active', accessEndsAt: sub.current_period_end };
    return { state: 'cancelled', accessEndsAt: sub.current_period_end };
  }
  const end = asDate(sub.current_period_end);
  if (!end) return { state: sub.status === 'trial' ? 'trial' : 'active', accessEndsAt: null };
  if (end > now) return { state: sub.status, accessEndsAt: sub.current_period_end };
  const grace = asDate(sub.grace_until);
  if (grace && grace > now) return { state: 'grace', accessEndsAt: sub.grace_until };
  return { state: 'expired', accessEndsAt: sub.current_period_end };
}

function assertTransition(from, to) {
  if (!(TRANSITIONS[from] || []).includes(to)) {
    throw conflict('INVALID_TRANSITION', `Cannot move subscription from ${from} to ${to}`);
  }
}

async function getForRestaurant(restaurantId) {
  const { rows } = await query('SELECT * FROM subscriptions WHERE restaurant_id = $1', [restaurantId]);
  return rows[0] || null;
}

/**
 * Transactional access check for write paths that already hold locks
 * (checkout, bookings). `client` is a pg client/pool with .query.
 * Grace counts as access (recovery-first); suspended/cancelled-effective do not.
 */
async function accessAllowed(client, restaurantId) {
  const { rows } = await client.query(
    `SELECT status, current_period_end, grace_until, cancel_effective_at
     FROM subscriptions WHERE restaurant_id = $1`,
    [restaurantId]
  );
  if (!rows[0]) {
    const legacy = await client.query(
      'SELECT subscription_ends_at FROM restaurants WHERE id = $1', [restaurantId]
    );
    const endsAt = legacy.rows[0] ? legacy.rows[0].subscription_ends_at : null;
    return !endsAt || new Date(endsAt).getTime() > Date.now();
  }
  const eff = derive(rows[0], null);
  return ['trial', 'active', 'grace'].includes(eff.state);
}

/**
 * Owner-facing status payload. Tenant-scoped by the caller; copy keys stay
 * in the client DICT (messageKey only here, never sentences).
 */
async function statusFor(restaurantId) {
  const { rows } = await query(
    `SELECT s.*, p.key AS plan_key, p.name AS plan_name
     FROM subscriptions s JOIN plans p ON p.id = s.plan_id
     WHERE s.restaurant_id = $1`,
    [restaurantId]
  );
  const sub = rows[0];
  if (!sub) {
    // Row-less legacy business: derive honestly from the old clock instead
    // of 404ing (backfill covers migrated rows; this covers any other path).
    const legacy = await query(
      'SELECT subscription_ends_at FROM restaurants WHERE id = $1', [restaurantId]
    );
    if (!legacy.rows[0]) {
      const { notFound } = require('../utils/errors');
      throw notFound('No subscription for this business');
    }
    const endsAt = legacy.rows[0].subscription_ends_at;
    const active = !endsAt || new Date(endsAt).getTime() > Date.now();
    return {
      state: active ? 'active' : 'expired',
      active,
      endsAt,
      plan: { key: 'standard', name: 'Standard' },
      trialEndsAt: null,
      periodEndsAt: endsAt,
      daysLeft: endsAt ? Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 864e5)) : null,
      graceUntil: endsAt ? new Date(new Date(endsAt).getTime() + 7 * 864e5).toISOString() : null,
      messageKey: active ? 'sub_active_until' : 'sub_expired_renew',
    };
  }
  const eff = derive(sub, null);
  const end = asDate(sub.current_period_end);
  const daysLeft = end ? Math.max(0, Math.ceil((end - Date.now()) / (24 * 60 * 60 * 1000))) : null;
  const messageKey = {
    trial: 'sub_trial_left',
    active: end ? 'sub_active_until' : 'sub_active_open',
    grace: 'sub_grace',
    expired: 'sub_expired_renew',
    cancelled: 'sub_cancelled',
    suspended: 'sub_suspended',
  }[eff.state] || 'sub_active_until';
  return {
    state: eff.state,
    active: ['trial', 'active', 'grace'].includes(eff.state),
    endsAt: sub.current_period_end,
    plan: { key: sub.plan_key, name: sub.plan_name },
    trialEndsAt: sub.status === 'trial' ? sub.current_period_end : null,
    periodEndsAt: sub.current_period_end,
    daysLeft,
    graceUntil: sub.grace_until,
    messageKey,
  };
}

async function writeEvent(client, { restaurantId, actorId, action, oldSub, newSub, reason }) {
  await client.query(
    `INSERT INTO subscription_events
       (restaurant_id, actor_user_id, action, old_status, new_status,
        old_plan_key, new_plan_key, old_ends_at, new_ends_at, reason)
     VALUES ($1, $2, $3, $4, $5,
       (SELECT key FROM plans WHERE id = $6), (SELECT key FROM plans WHERE id = $7),
       $8, $9, $10)`,
    [
      restaurantId, actorId || null, action,
      oldSub ? oldSub.status : null, newSub ? newSub.status : null,
      oldSub ? oldSub.plan_id : null, newSub ? newSub.plan_id : null,
      oldSub ? oldSub.current_period_end : null, newSub ? newSub.current_period_end : null,
      reason || '',
    ]
  );
}

async function mirrorAccessEnd(client, restaurantId, accessEndsAt) {
  await client.query('UPDATE restaurants SET subscription_ends_at = $2 WHERE id = $1', [restaurantId, accessEndsAt]);
}

async function getPlanId(client, planKey) {
  const { rows } = await client.query('SELECT id FROM plans WHERE key = $1', [planKey]);
  if (!rows[0]) {
    const { notFound } = require('../utils/errors');
    throw notFound('Unknown plan');
  }
  return rows[0].id;
}

async function requireSub(client, restaurantId) {
  const { rows } = await client.query('SELECT * FROM subscriptions WHERE restaurant_id = $1', [restaurantId]);
  if (!rows[0]) throw notFound('No subscription for this business');
  return rows[0];
}

/** Admin assigns a plan + paid period (the future payment boundary calls this too). */
async function activate({ restaurantId, planKey, periodEndsAt, reason, actorId }) {
  return withTx(async (client) => {
    const oldSub = await requireSub(client, restaurantId);
    const planId = await getPlanId(client, planKey);
    assertTransition(oldSub.status, 'active');
    const now = new Date().toISOString();
    const { rows } = await client.query(
      `UPDATE subscriptions
       SET plan_id = $2, status = 'active', current_period_start = $3, current_period_end = $4::timestamptz,
           grace_until = CASE WHEN $4::timestamptz IS NULL THEN NULL ELSE ($4::timestamptz + INTERVAL '7 days') END,
           cancelled_at = NULL, cancel_effective_at = NULL,
           suspended_at = NULL, suspend_reason = '', updated_at = $3
       WHERE restaurant_id = $1 RETURNING *`,
      [restaurantId, planId, now, periodEndsAt || null]
    );
    await mirrorAccessEnd(client, restaurantId, periodEndsAt || null);
    await writeEvent(client, {
      restaurantId, actorId, action: oldSub.status === 'trial' ? 'trial_converted' : 'subscription_activated',
      oldSub, newSub: rows[0], reason,
    });
    observe.info('subscription.activated', { restaurantId, planKey });
    return rows[0];
  });
}

/** Extend trial or period. Extends from later-of(now, current end): paid days are never lost. */
async function extend({ restaurantId, extendDays, newEndsAt, reason, actorId }) {
  return withTx(async (client) => {
    const oldSub = await requireSub(client, restaurantId);
    if (!['trial', 'active', 'grace'].includes(oldSub.status)) {
      throw conflict('INVALID_TRANSITION', `Cannot extend a ${oldSub.status} subscription`);
    }
    let end;
    if (extendDays !== undefined) {
      const base = Math.max(Date.now(), asDate(oldSub.current_period_end) || 0);
      end = new Date(base + extendDays * 24 * 60 * 60 * 1000).toISOString();
    } else {
      end = newEndsAt;
    }
    const { rows } = await client.query(
      `UPDATE subscriptions
       SET current_period_end = $2,
           grace_until = ($2::timestamptz + INTERVAL '7 days'),
           updated_at = now()
       WHERE restaurant_id = $1 RETURNING *`,
      [restaurantId, end]
    );
    await mirrorAccessEnd(client, restaurantId, end);
    const isTrial = oldSub.status === 'trial';
    await writeEvent(client, {
      restaurantId, actorId, action: isTrial ? 'trial_extended' : 'subscription_extended',
      oldSub, newSub: rows[0], reason,
    });
    observe.info('subscription.extended', { restaurantId, end });
    return rows[0];
  });
}

/** Cancel now or at period end (default). Pre-effect cancellation stays reversible via activate. */
async function cancel({ restaurantId, effective, reason, actorId }) {
  return withTx(async (client) => {
    const oldSub = await requireSub(client, restaurantId);
    if (!['trial', 'active', 'grace'].includes(oldSub.status)) {
      throw conflict('INVALID_TRANSITION', `Cannot cancel a ${oldSub.status} subscription`);
    }
    const now = new Date().toISOString();
    const effectiveAt = effective === 'now'
      ? now
      : oldSub.current_period_end || now;
    const { rows } = await client.query(
      `UPDATE subscriptions
       SET status = 'cancelled', cancelled_at = $2, cancel_effective_at = $3, updated_at = $2
       WHERE restaurant_id = $1 RETURNING *`,
      [restaurantId, now, effectiveAt]
    );
    if (effective === 'now') await mirrorAccessEnd(client, restaurantId, now);
    await writeEvent(client, { restaurantId, actorId, action: 'subscription_cancelled', oldSub, newSub: rows[0], reason });
    observe.info('subscription.cancelled', { restaurantId, effective });
    return rows[0];
  });
}

/** Suspend with mandatory reason. Nothing is deleted; access derives suspended. */
async function suspend({ restaurantId, reason, actorId }) {
  return withTx(async (client) => {
    const oldSub = await requireSub(client, restaurantId);
    assertTransition(oldSub.status, 'suspended');
    const now = new Date().toISOString();
    const { rows } = await client.query(
      `UPDATE subscriptions
       SET status = 'suspended', suspended_at = $2, suspend_reason = $3, updated_at = $2
       WHERE restaurant_id = $1 RETURNING *`,
      [restaurantId, now, reason]
    );
    await mirrorAccessEnd(client, restaurantId, now);
    await writeEvent(client, { restaurantId, actorId, action: 'subscription_suspended', oldSub, newSub: rows[0], reason });
    observe.info('subscription.suspended', { restaurantId });
    return rows[0];
  });
}

/** Clear suspension/expiry back to active; access then follows dates (extend for a lapsed end). */
async function reactivate({ restaurantId, reason, actorId }) {
  return withTx(async (client) => {
    const oldSub = await requireSub(client, restaurantId);
    assertTransition(oldSub.status, 'active');
    const { rows } = await client.query(
      `UPDATE subscriptions
       SET status = 'active', suspended_at = NULL, suspend_reason = '',
           cancelled_at = NULL, cancel_effective_at = NULL, updated_at = now()
       WHERE restaurant_id = $1 RETURNING *`,
      [restaurantId]
    );
    // Re-mirror the true end so legacy gates agree with derivation again.
    const eff = derive(rows[0], null);
    await mirrorAccessEnd(client, restaurantId, eff.accessEndsAt);
    await writeEvent(client, { restaurantId, actorId, action: 'subscription_reactivated', oldSub, newSub: rows[0], reason });
    observe.info('subscription.reactivated', { restaurantId });
    return rows[0];
  });
}

module.exports = {
  STATUSES, TRANSITIONS, derive, assertTransition,
  getForRestaurant, accessAllowed, statusFor, activate, extend, cancel, suspend, reactivate,
};
