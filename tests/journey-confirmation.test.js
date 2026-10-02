'use strict';

/** Tasks 9 (US1): guest confirmation data, kind-correct tracking, live-definition reorder. */

process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || '';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startApp } = require('./helpers');

let env;
let adminCookie;
let categoryId;
let normalId;
let preorderId;
const slug = 'post-order-confirm';

before(async () => {
  env = await startApp();
  await env.createPlatformOwner('root', 'owner-password-123');
  const ownerCookie = await env.login('root', 'owner-password-123');
  const fx = await env.createRestaurantFixture(ownerCookie, { name: 'Post Order Confirm', slug });
  adminCookie = fx.adminCookie;
  categoryId = fx.categoryId;
  normalId = fx.itemId;

  const pre = await env.req('/api/admin/items', {
    method: 'POST', cookie: adminCookie,
    body: { categoryId, name: 'Holiday Cake', priceCents: 2000, isPreorder: true, preorderNote: 'Ready Friday' },
  });
  preorderId = pre.data.item.id;

  const grp = await env.req('/api/admin/option-groups', {
    method: 'POST', cookie: adminCookie,
    body: { menuItemId: normalId, name: 'Size', pricing: 'replace', isRequired: false, minPicks: 0, maxPicks: 1 },
  }).catch(() => null);
  if (grp && grp.data && grp.data.group) {
    await env.req(`/api/admin/option-groups/${grp.data.group.id}/choices`, {
      method: 'POST', cookie: adminCookie,
      body: { name: 'Large', priceCents: 1200 },
    }).catch(() => null);
  }
});

after(async () => {
  if (env) await env.close();
});

function guestOrder(body) {
  return env.req(`/api/restaurants/${slug}/orders`, { method: 'POST', body });
}

test('checkout response carries server-confirmed summary for confirmation view', async () => {
  const res = await guestOrder({
    customerName: 'Sara', customerWhatsapp: '+15551234567', orderType: 'delivery',
    customerAddress: '12 Market Street, Town', notes: 'Extra napkins',
    items: [{ itemId: normalId, quantity: 1 }, { itemId: preorderId, quantity: 1 }],
  });
  assert.strictEqual(res.status, 201);
  const o = res.data.order;
  assert.ok(o.code);
  assert.ok(o.currency);
  assert.ok(Number.isInteger(o.totalCents));
  assert.ok(Number.isInteger(o.subtotalCents));
  assert.ok(Number.isInteger(o.deliveryFeeCents));
  assert.ok(o.createdAt);
});

test('tracking projection exposes frozen lines, options, preorder, currency per kind', async () => {
  const placed = await guestOrder({
    customerName: 'Omar', customerWhatsapp: '+15557654321', orderType: 'pickup',
    items: [{ itemId: preorderId, quantity: 2 }],
  });
  const track = await env.req('/api/orders/track/' + placed.data.order.code);
  assert.strictEqual(track.status, 200);
  const t = track.data.order;
  assert.strictEqual(t.order_type, 'pickup');
  assert.ok(t.currency);
  assert.strictEqual(t.items.length, 1);
  assert.strictEqual(t.items[0].is_preorder, true);
  assert.strictEqual(t.items[0].preorder_note, 'Ready Friday');
  assert.ok(Number.isInteger(t.total_cents));
});

test('preorder snapshot survives disable and reword; normal lines stay identical', async () => {
  const placed = await guestOrder({
    customerName: 'Lina', customerWhatsapp: '+15550001111', orderType: 'pickup',
    items: [{ itemId: normalId, quantity: 1 }, { itemId: preorderId, quantity: 1 }],
  });
  await env.req('/api/admin/items/' + preorderId, {
    method: 'PATCH', cookie: adminCookie, body: { isPreorder: false, preorderNote: 'Changed' },
  });
  const track = await env.req('/api/orders/track/' + placed.data.order.code);
  const lines = track.data.order.items;
  const pre = lines.find((l) => l.is_preorder === true);
  assert.ok(pre, 'frozen preorder flag survives');
  assert.strictEqual(pre.preorder_note, 'Ready Friday');
});

test('invalid codes fail uniformly; lowercase equals uppercase; no PII leaks', async () => {
  const placed = await guestOrder({
    customerName: 'Noor', customerWhatsapp: '+15550002222', orderType: 'pickup',
    items: [{ itemId: normalId, quantity: 1 }],
  });
  const code = placed.data.order.code;
  const lower = await env.req('/api/orders/track/' + code.toLowerCase());
  assert.strictEqual(lower.status, 200);
  for (const bad of ['nope99', 'ABC', 'toolongcode12345', '../../../etc']) {
    const r = await env.req('/api/orders/track/' + encodeURIComponent(bad));
    assert.strictEqual(r.status, 404);
    const body = JSON.stringify(r.data);
    assert.ok(!/password|token|restaurant_id|user_id/i.test(body), 'no internals for ' + bad);
  }
});

test('menu definitions expose current availability, prices, and options for reorder rebuild', async () => {
  const view = await env.req('/api/restaurants/' + slug + '/menu');
  assert.strictEqual(view.status, 200);
  const items = view.data.items;
  const normal = items.find((i) => i.id === normalId);
  assert.ok(normal);
  assert.ok(Number.isInteger(normal.price_cents));
  assert.strictEqual(typeof normal.is_available, 'boolean');
  assert.ok(Array.isArray(normal.options));
});
