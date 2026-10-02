'use strict';

/** Owner Web Push: sender fan-out, endpoints authZ/isolation, coexistence. */

process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || '';
process.env.PUSH_ENABLED = '1';
process.env.VAPID_PUBLIC_KEY = 'BMTestPublicKeyForUnitTestsOnly12345678901234567890123456789012';
process.env.VAPID_PRIVATE_KEY = 'test-private-key-for-unit-tests-only-do-not-use-in-prod-1234';
process.env.VAPID_SUBJECT = 'mailto:test@example.com';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startApp } = require('./helpers');

let env;
let adminCookie;
let otherAdminCookie;
let restaurantId;
let itemId;
const slug = 'owner-push';
const otherSlug = 'owner-push-other';

function notify() {
  return require('../server/services/notifications.service');
}

before(async () => {
  env = await startApp();
  await env.createPlatformOwner('root', 'owner-password-123');
  const ownerCookie = await env.login('root', 'owner-password-123');
  const fx = await env.createRestaurantFixture(ownerCookie, { name: 'Owner Push', slug });
  adminCookie = fx.adminCookie;
  restaurantId = fx.restaurantId;
  itemId = fx.itemId;
  const other = await env.createRestaurantFixture(ownerCookie, { name: 'Owner Push Other', slug: otherSlug });
  otherAdminCookie = other.adminCookie;
});

after(async () => {
  if (env) await env.close();
});

function subRow(endpoint) {
  return {
    endpoint: endpoint || 'https://push.example.com/sub/unit-test-device-1',
    keys: {
      p256dh: 'BMTestP256dhKeyUnitTestsOnly123456789012345678901234567890',
      auth: 'dGVzdEF1dGhLZXlVbml0VGVzdHNvbmx5MTIzNA',
    },
  };
}

async function seedSubscription(cookie, overrides = {}) {
  const res = await env.req('/api/admin/push-subscriptions', {
    method: 'POST', cookie, body: { ...subRow(), ...overrides },
  });
  assert.strictEqual(res.status, 201, JSON.stringify(res.data));
  return res.data.subscription.id;
}

async function placeOrder() {
  const res = await env.req(`/api/restaurants/${slug}/orders`, {
    method: 'POST',
    body: { customerName: 'Push Buyer', customerWhatsapp: '+15550007777', orderType: 'pickup', items: [{ itemId, quantity: 1 }] },
  });
  assert.strictEqual(res.status, 201);
  await new Promise((r) => setTimeout(r, 300));
  return res.data.order.code;
}

/* ------------------------- US1: delivery -------------------------- */

test('[US1] push payload is minimal with no customer PII, one send per subscription', async () => {
  const seen = [];
  notify().setPushTransport(async (sub, payload) => { seen.push({ sub, payload: JSON.parse(payload) }); });
  try {
    await seedSubscription(adminCookie);
    await seedSubscription(adminCookie, { endpoint: 'https://push.example.com/sub/unit-test-device-2' });
    const code = await placeOrder();
    assert.strictEqual(seen.length, 2, 'one send per active subscription, got ' + seen.length);
    for (const s of seen) {
      const body = JSON.stringify(s.payload);
      assert.ok(!/Push Buyer|5550007777|15550007777/i.test(body), 'no customer PII in payload');
      assert.ok(/order/i.test(s.payload.title), 'title carries new-order meaning');
      assert.ok(body.includes(code), 'payload carries order code');
    }
  } finally {
    notify().setPushTransport(null);
  }
});

test('[US1] replayed order.created collapses to zero additional sends', async () => {
  let sends = 0;
  notify().setPushTransport(async () => { sends += 1; });
  try {
    await env.query(
      `INSERT INTO push_subscriptions (restaurant_id, endpoint, p256dh, auth)
       VALUES ($1, 'https://push.example.com/sub/replay-probe', 'BMReplayProbeKey12345678901234567890123456789012', 'cmVwbGF5UHJvYmVLZXlVbml0VGVzdDEyMw')
       ON CONFLICT (endpoint) DO UPDATE SET is_active = TRUE`,
      [restaurantId]
    );
    const placed = await env.req(`/api/restaurants/${slug}/orders`, {
      method: 'POST',
      body: { customerName: 'Replay Ron', customerWhatsapp: '+15550009999', orderType: 'pickup', items: [{ itemId, quantity: 1 }] },
    });
    const { rows: orow } = await env.query(`SELECT id FROM orders WHERE code = $1`, [placed.data.order.code]);
    await env.query(`DELETE FROM notification_events WHERE order_code = $1`, [placed.data.order.code]);
    const svc = notify();
    const ev = { restaurantId, type: 'order.created', orderId: orow[0].id, orderCode: placed.data.order.code };
    await svc.emit(ev);
    const first = sends;
    assert.ok(first >= 1, 'first emit sends');
    await svc.emit(ev);
    await svc.emit(ev);
    assert.strictEqual(sends, first, 'replays send nothing more');
  } finally {
    notify().setPushTransport(null);
    await env.query(`DELETE FROM push_subscriptions WHERE endpoint = 'https://push.example.com/sub/replay-probe'`);
  }
});

test('[US1] dead endpoint deactivates; transient failure records failed without retry; order intact', async () => {
  let calls = 0;
  notify().setPushTransport(async (sub) => {
    calls += 1;
    if (sub.endpoint.endsWith('dead-device')) {
      const err = new Error('gone');
      err.statusCode = 410;
      throw err;
    }
    throw new Error('push service down');
  });
  try {
    await seedSubscription(adminCookie, { endpoint: 'https://push.example.com/sub/dead-device' });
    const code = await placeOrder(); // must still be 201 despite total push failure
    const { rows } = await env.query(`SELECT endpoint, is_active FROM push_subscriptions WHERE restaurant_id = $1`, [restaurantId]);
    const dead = rows.find((r) => r.endpoint.endsWith('dead-device'));
    assert.strictEqual(dead.is_active, false, 'dead endpoint deactivated');
    assert.strictEqual(calls, rows.length, 'single attempt per subscription, no retry loop');
    const { rows: ev } = await env.query(
      `SELECT state FROM notification_events WHERE order_code = $1 AND channel = 'push'`, [code]
    );
    assert.ok(ev.some((r) => r.state === 'failed'), 'failure recorded');
  } finally {
    notify().setPushTransport(null);
    await env.query(`DELETE FROM push_subscriptions WHERE restaurant_id = $1`, [restaurantId]);
  }
});

/* ------------------- US2: subscription endpoints ------------------- */

test('[US2] subscription CRUD needs auth, refuses staff, isolates tenants', async () => {
  const anon = await env.req('/api/admin/push-subscriptions', { method: 'POST', body: subRow() });
  assert.strictEqual(anon.status, 401);

  const staffCookie = await env.createStaffUser('push-staff-1', 'staff-password-123');
  const staff = await env.req('/api/admin/push-subscriptions', { method: 'POST', cookie: staffCookie, body: subRow() });
  assert.strictEqual(staff.status, 403);

  const id = await seedSubscription(adminCookie);
  const list = await env.req('/api/admin/push-subscriptions', { cookie: adminCookie });
  assert.ok(list.data.subscriptions.some((s) => s.id === id));
  assert.ok(!('endpoint' in list.data.subscriptions[0]), 'no endpoint/key material in list view');

  const cross = await env.req('/api/admin/push-subscriptions', { cookie: otherAdminCookie });
  assert.ok(!cross.data.subscriptions.some((s) => s.id === id), 'tenant isolation on list');
  const crossDel = await env.req('/api/admin/push-subscriptions/' + id, { method: 'DELETE', cookie: otherAdminCookie });
  assert.strictEqual(crossDel.status, 404);

  const bad = await env.req('/api/admin/push-subscriptions', {
    method: 'POST', cookie: adminCookie, body: { endpoint: 'http://insecure.example/x', keys: { p256dh: '!!', auth: '' }, label: 'x'.repeat(61) },
  });
  assert.strictEqual(bad.status, 400);

  // Same endpoint re-subscribed: update, not duplicate.
  const again = await env.req('/api/admin/push-subscriptions', {
    method: 'POST', cookie: adminCookie, body: { ...subRow(), label: 'Kitchen phone' },
  });
  assert.strictEqual(again.status, 201);
  const { rows } = await env.query(`SELECT COUNT(*)::int AS n FROM push_subscriptions WHERE endpoint = $1`, [subRow().endpoint]);
  assert.strictEqual(rows[0].n, 1);

  const del = await env.req('/api/admin/push-subscriptions/' + id, { method: 'DELETE', cookie: adminCookie });
  assert.strictEqual(del.status, 200);
});

test('[US2] public-key endpoint serves admins only and reflects configuration', async () => {
  const ok = await env.req('/api/admin/push-public-key', { cookie: adminCookie });
  assert.strictEqual(ok.status, 200);
  assert.strictEqual(ok.data.enabled, true);
  assert.ok(ok.data.publicKey);
  const anon = await env.req('/api/admin/push-public-key');
  assert.strictEqual(anon.status, 401);
});

/* --------------------- US3: coexistence ---------------------------- */

test('[US3] SSE order:new still fires with push enabled and with push broken', async () => {
  await seedSubscription(adminCookie);
  notify().setPushTransport(async () => { throw new Error('push down'); });
  try {
    const code = await placeOrder();
    const { rows } = await env.query(
      `SELECT channel, state FROM notification_events WHERE order_code = $1`, [code]
    );
    assert.ok(rows.some((r) => r.channel === 'dashboard_sse' && r.state === 'delivered'), 'SSE row delivered');
    assert.ok(rows.some((r) => r.channel === 'push' && r.state === 'failed'), 'push row failed, order intact');
  } finally {
    notify().setPushTransport(null);
    await env.query(`DELETE FROM push_subscriptions WHERE restaurant_id = $1`, [restaurantId]);
  }
});
