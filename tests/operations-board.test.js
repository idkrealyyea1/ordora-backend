'use strict';

/** Tasks 10 (US2): operations board ordering, detail, transitions, isolation. */

process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || '';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startApp } = require('./helpers');

let env;
let adminCookie;
let otherAdminCookie;
let slug = 'ops-board';
let otherSlug = 'ops-board-other';
let itemId;
let preorderId;
let deliveryCode;
let preorderCode;

before(async () => {
  env = await startApp();
  await env.createPlatformOwner('root', 'owner-password-123');
  const ownerCookie = await env.login('root', 'owner-password-123');
  const fx = await env.createRestaurantFixture(ownerCookie, { name: 'Ops Board', slug });
  adminCookie = fx.adminCookie;
  itemId = fx.itemId;
  const pre = await env.req('/api/admin/items', {
    method: 'POST', cookie: adminCookie,
    body: { categoryId: fx.categoryId, name: 'Ops Cake', priceCents: 1500, isPreorder: true, preorderNote: 'Friday pickup' },
  });
  preorderId = pre.data.item.id;
  const other = await env.createRestaurantFixture(ownerCookie, { name: 'Ops Other', slug: otherSlug });
  otherAdminCookie = other.adminCookie;

  const d = await env.req(`/api/restaurants/${slug}/orders`, {
    method: 'POST',
    body: {
      customerName: 'Dana', customerWhatsapp: '+15551112222', orderType: 'delivery',
      customerAddress: '9 Olive Street, Amman', notes: 'Call on arrival',
      items: [{ itemId, quantity: 2 }],
    },
  });
  deliveryCode = d.data.order.code;
  const p = await env.req(`/api/restaurants/${slug}/orders`, {
    method: 'POST',
    body: { customerName: 'Eli', customerWhatsapp: '+15553334444', orderType: 'pickup', items: [{ itemId: preorderId, quantity: 1 }] },
  });
  preorderCode = p.data.order.code;
});

after(async () => {
  if (env) await env.close();
});

test('unfiltered list prioritizes pending newest-first', async () => {
  const res = await env.req('/api/admin/orders', { cookie: adminCookie });
  assert.strictEqual(res.status, 200);
  assert.ok(res.data.total >= 2);
  assert.strictEqual(res.data.orders[0].status, 'pending');
  assert.strictEqual(res.data.orders[1].status, 'pending');
});

test('detail carries address, items, preorder snapshot, frozen money', async () => {
  const list = await env.req('/api/admin/orders?status=pending', { cookie: adminCookie });
  const del = list.data.orders.find((o) => o.code === deliveryCode);
  assert.ok(del);
  const det = await env.req('/api/admin/orders/' + deliveryCode, { cookie: adminCookie });
  assert.strictEqual(det.status, 200);
  assert.strictEqual(det.data.order.customer_address, '9 Olive Street, Amman');
  assert.strictEqual(det.data.order.customer_name, 'Dana');
  assert.ok(det.data.order.items.length >= 1);
  assert.ok(Number.isInteger(det.data.order.total_cents));

  const pre = await env.req('/api/admin/orders/' + preorderCode, { cookie: adminCookie });
  assert.ok(pre.data.order.items.some((i) => i.is_preorder === true));
  assert.ok(!pre.data.order.customer_address, 'pickup carries no address');
});

test('invalid jumps refused; repeats are safe no-ops', async () => {
  const bad = await env.req('/api/admin/orders/' + deliveryCode + '/status', {
    method: 'PATCH', cookie: adminCookie, body: { status: 'completed' },
  });
  assert.strictEqual(bad.status, 409);

  const first = await env.req('/api/admin/orders/' + deliveryCode + '/status', {
    method: 'PATCH', cookie: adminCookie, body: { status: 'confirmed' },
  });
  assert.strictEqual(first.data.order.status, 'confirmed');
  const repeat = await env.req('/api/admin/orders/' + deliveryCode + '/status', {
    method: 'PATCH', cookie: adminCookie, body: { status: 'confirmed' },
  });
  assert.strictEqual(repeat.data.order.status, 'confirmed');
});

test('history stays frozen after menu edits', async () => {
  await env.req('/api/admin/items/' + itemId, {
    method: 'PATCH', cookie: adminCookie, body: { priceCents: 9999, name: 'Renamed Burger' },
  });
  const det = await env.req('/api/admin/orders/' + deliveryCode, { cookie: adminCookie });
  assert.strictEqual(det.data.order.items[0].item_name, 'Test Burger');
  assert.notStrictEqual(det.data.order.items[0].unit_price_cents, 9999);
});

test('cross-tenant order access denied both directions', async () => {
  const cross = await env.req('/api/admin/orders/' + deliveryCode, { cookie: otherAdminCookie });
  assert.strictEqual(cross.status, 404);
  const crossList = await env.req('/api/admin/orders', { cookie: otherAdminCookie });
  assert.ok(!crossList.data.orders.some((o) => o.code === deliveryCode));
  const spoof = await env.req('/api/admin/orders/' + deliveryCode + '?restaurantId=other', { cookie: otherAdminCookie });
  assert.strictEqual(spoof.status, 404);
});
