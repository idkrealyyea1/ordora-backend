'use strict';

/**
 * Free-delivery threshold (server-authoritative):
 * delivery fee becomes 0 when the business enabled the threshold and the
 * server-computed subtotal reaches it. Pickup never carries a fee.
 * Fixture item costs 850c.
 */

process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || '';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startApp } = require('./helpers');

let env;
let fx;
let fxB;

function order(slug, itemId, qty, orderType = 'delivery') {
  return env.req('/api/restaurants/' + slug + '/orders', {
    method: 'POST',
    body: {
      customerName: 'Free Ship',
      customerWhatsapp: '15550004444',
      customerAddress: orderType === 'delivery' ? '123 Test Street' : undefined,
      orderType,
      items: [{ itemId, quantity: qty }],
    },
  });
}

async function settings(cookie, body) {
  return env.req('/api/admin/settings', { method: 'PATCH', cookie, body });
}

before(async () => {
  env = await startApp({ orderRateMax: 1000 });
  await env.createPlatformOwner('root', 'owner-password-123');
  const ownerCookie = await env.login('root', 'owner-password-123');
  fx = await env.createRestaurantFixture(ownerCookie, { name: 'Ship Diner', slug: 'ship-diner' });
  fxB = await env.createRestaurantFixture(ownerCookie, { name: 'Ship Diner B', slug: 'ship-diner-b' });
  for (const f of [fx, fxB]) {
    const r = await settings(f.adminCookie, { ignoreOpeningHours: true, deliveryFeeCents: 300 });
    assert.strictEqual(r.status, 200);
  }
});

after(async () => {
  if (env) await env.close();
});

test('disabled by default: delivery fee charged', async () => {
  const res = await order(fx.slug, fx.itemId, 1);
  assert.strictEqual(res.status, 201);
  assert.ok(res.data.order.deliveryFeeCents > 0, 'default fee applies');
});

test('enabled, subtotal below threshold: fee charged', async () => {
  const s = await settings(fx.adminCookie, { freeDeliveryEnabled: true, freeDeliveryThresholdCents: 1000 });
  assert.strictEqual(s.status, 200);
  const res = await order(fx.slug, fx.itemId, 1); // 850 < 1000
  assert.strictEqual(res.status, 201);
  assert.ok(res.data.order.deliveryFeeCents > 0);
});

test('enabled, subtotal exactly at threshold: free', async () => {
  const s = await settings(fx.adminCookie, { freeDeliveryThresholdCents: 850 });
  assert.strictEqual(s.status, 200);
  const res = await order(fx.slug, fx.itemId, 1); // 850 >= 850
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.data.order.deliveryFeeCents, 0, 'threshold inclusive');
  assert.strictEqual(res.data.order.totalCents, res.data.order.subtotalCents);
});

test('enabled, subtotal above threshold: free', async () => {
  const res = await order(fx.slug, fx.itemId, 3); // 2550 >= 850
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.data.order.deliveryFeeCents, 0);
});

test('pickup never carries a delivery fee', async () => {
  const res = await order(fx.slug, fx.itemId, 1, 'pickup');
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.data.order.deliveryFeeCents, 0);
});

test('disabling restores the normal fee', async () => {
  const s = await settings(fx.adminCookie, { freeDeliveryEnabled: false });
  assert.strictEqual(s.status, 200);
  const res = await order(fx.slug, fx.itemId, 3);
  assert.strictEqual(res.status, 201);
  assert.ok(res.data.order.deliveryFeeCents > 0);
});

test('invalid configuration rejected', async () => {
  assert.strictEqual((await settings(fx.adminCookie, { freeDeliveryThresholdCents: -5 })).status, 400);
  assert.strictEqual((await settings(fx.adminCookie, { freeDeliveryThresholdCents: 99999999 })).status, 400);
  assert.strictEqual((await settings(fx.adminCookie, { freeDeliveryEnabled: 'yes-please' })).status, 400);
});

test('public menu view exposes the free-delivery fields the storefront reads', async () => {
  await settings(fx.adminCookie, { freeDeliveryEnabled: true, freeDeliveryThresholdCents: 2500 });
  const view = await env.req('/api/restaurants/' + fx.slug + '/menu');
  assert.strictEqual(view.status, 200);
  assert.strictEqual(view.data.settings.freeDeliveryEnabled, true);
  assert.strictEqual(view.data.settings.freeDeliveryThresholdCents, 2500);
});

test('tenant isolation: A cannot change B free-delivery settings', async () => {
  const beforeB = await env.req('/api/admin/settings', { cookie: fxB.adminCookie });
  // A PATCHes only its own tenant record (derived from session).
  await settings(fx.adminCookie, { freeDeliveryEnabled: true, freeDeliveryThresholdCents: 1 });
  const afterB = await env.req('/api/admin/settings', { cookie: fxB.adminCookie });
  assert.strictEqual(afterB.data.settings.freeDeliveryEnabled, beforeB.data.settings.freeDeliveryEnabled);
  // B still pays delivery: threshold untouched.
  const res = await order(fxB.slug, fxB.itemId, 5);
  assert.strictEqual(res.status, 201);
  assert.ok(res.data.order.deliveryFeeCents > 0);
});
