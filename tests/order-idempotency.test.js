'use strict';

/**
 * Task 17 FR-001: idempotent checkout beyond the sequential replay covered
 * in order-double-submit.test.js — true concurrent races, post-price-change
 * replays, tampered money, cross-business key scope, malformed keys.
 *
 * Mechanism under test (already in service): nullable `submission_key` UUID
 * with per-business UNIQUE (restaurant_id, submission_key) from migration
 * 019; replay inside the checkout transaction returns the original row.
 */

process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || '';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startApp } = require('./helpers');

let env;
let fx;
let fx2;

before(async () => {
  env = await startApp({ orderRateMax: 1000 });
  await env.createPlatformOwner('root', 'owner-password-123');
  const ownerCookie = await env.login('root', 'owner-password-123');
  fx = await env.createRestaurantFixture(ownerCookie, { name: 'Race Diner', slug: 'race-diner' });
  fx2 = await env.createRestaurantFixture(ownerCookie, { name: 'Race Diner Two', slug: 'race-diner-two' });
  // Hours are not under test here: bypass the clock so this file passes at any hour.
  for (const f of [fx, fx2]) {
    const r = await env.req('/api/admin/settings', {
      method: 'PATCH', cookie: f.adminCookie, body: { ignoreOpeningHours: true },
    });
    assert.strictEqual(r.status, 200);
  }
});

after(async () => {
  if (env) await env.close();
});

function checkout(slug, over = {}) {
  return env.req('/api/restaurants/' + slug + '/orders', {
    method: 'POST',
    body: Object.assign({
      customerName: 'Race Customer',
      customerWhatsapp: '15550001111',
      orderType: 'pickup',
      items: [{ itemId: fx.itemId, quantity: 1 }],
    }, over),
  });
}

test('parallel same-key burst persists exactly one order', async () => {
  const key = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
  const results = await Promise.all(
    Array.from({ length: 10 }, () => checkout(fx.slug, { submissionKey: key }))
  );
  for (const r of results) assert.strictEqual(r.status, 201);
  const codes = new Set(results.map((r) => r.data.order.code));
  assert.strictEqual(codes.size, 1, 'all replays reference the original order');
  const count = await env.query(
    'SELECT COUNT(*)::int AS n FROM orders WHERE restaurant_id = $1 AND submission_key = $2',
    [fx.restaurantId, key]
  );
  assert.strictEqual(count.rows[0].n, 1, 'exactly one row for one intent');
});

test('replay after a price change keeps the original snapshot totals', async () => {
  const key = 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff';
  const first = await checkout(fx.slug, { submissionKey: key });
  assert.strictEqual(first.status, 201);
  const originalTotal = first.data.order.totalCents;

  await env.req('/api/admin/items/' + fx.itemId, {
    method: 'PATCH', cookie: fx.adminCookie, body: { priceCents: 9999 },
  });
  const replay = await checkout(fx.slug, { submissionKey: key });
  assert.strictEqual(replay.status, 201);
  assert.strictEqual(replay.data.order.code, first.data.order.code);
  assert.strictEqual(replay.data.order.totalCents, originalTotal, 'snapshot preserved');

  await env.req('/api/admin/items/' + fx.itemId, {
    method: 'PATCH', cookie: fx.adminCookie, body: { priceCents: 850 },
  });
});

test('client-sent money is ignored even with a valid key', async () => {
  const res = await checkout(fx.slug, {
    submissionKey: 'cccccccc-dddd-4eee-8fff-000000000000',
    subtotalCents: 1, totalCents: 1, deliveryFeeCents: 0, priceCents: 1,
  });
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.data.order.totalCents, 850, 'server-priced total');
});

test('same key at a different business creates a distinct order', async () => {
  const key = 'dddddddd-eeee-4fff-8000-111111111111';
  const a = await checkout(fx.slug, { submissionKey: key });
  const b = await env.req('/api/restaurants/' + fx2.slug + '/orders', {
    method: 'POST',
    body: {
      customerName: 'Other Customer',
      customerWhatsapp: '15550002222',
      orderType: 'pickup',
      submissionKey: key,
      items: [{ itemId: fx2.itemId, quantity: 1 }],
    },
  });
  assert.strictEqual(a.status, 201);
  assert.strictEqual(b.status, 201);
  assert.notStrictEqual(b.data.order.code, a.data.order.code, 'per-business key scope');
});

test('malformed key is rejected with no order created', async () => {
  const before = await env.query('SELECT COUNT(*)::int AS n FROM orders');
  const res = await checkout(fx.slug, { submissionKey: 'not-a-uuid' });
  assert.strictEqual(res.status, 400);
  const after = await env.query('SELECT COUNT(*)::int AS n FROM orders');
  assert.strictEqual(after.rows[0].n, before.rows[0].n, 'no partial order');
});

test('key-less requests still create one order per request', async () => {
  const first = await checkout(fx.slug, { customerWhatsapp: '15550003333' });
  const second = await checkout(fx.slug, { customerWhatsapp: '15550003333' });
  assert.strictEqual(first.status, 201);
  assert.strictEqual(second.status, 201);
  assert.notStrictEqual(second.data.order.code, first.data.order.code);
});
