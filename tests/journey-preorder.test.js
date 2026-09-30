'use strict';

/** Tasks 6-8 US1: pre-order truth with snapshots; normal products identical. */

process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || '';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startApp } = require('./helpers');

let env;
let ownerCookie;
let adminCookie;
let itemId;
const slug = 'journey-preorder';

before(async () => {
  env = await startApp();
  await env.createPlatformOwner('root', 'owner-password-123');
  ownerCookie = await env.login('root', 'owner-password-123');
  const fx = await env.createRestaurantFixture(ownerCookie, { name: 'Journey Preorder', slug });
  adminCookie = fx.adminCookie;
  itemId = fx.itemId;
});

after(async () => {
  if (env) await env.close();
});

test('pre-order flag plus message order with frozen snapshot', async () => {
  const marked = await env.req('/api/admin/items/' + itemId, {
    method: 'PATCH', cookie: adminCookie,
    body: { isPreorder: true, preorderNote: 'Baked Friday morning' },
  });
  assert.strictEqual(marked.status, 200);
  assert.strictEqual(marked.data.item.is_preorder, true);

  const view = await env.req('/api/restaurants/' + slug + '/menu');
  const seen = view.data.items.find((i) => i.id === itemId);
  assert.strictEqual(seen.is_preorder, true);
  assert.strictEqual(seen.preorder_note, 'Baked Friday morning');

  const order = await env.req(`/api/restaurants/${slug}/orders`, {
    method: 'POST',
    body: {
      customerName: 'Planner', customerWhatsapp: '+15551234567', orderType: 'pickup',
      items: [{ itemId, quantity: 1 }],
    },
  });
  assert.strictEqual(order.status, 201);

  const track = await env.req('/api/orders/track/' + order.data.order.code);
  const line = track.data.order.items[0];
  assert.strictEqual(line.is_preorder, true);
  assert.strictEqual(line.preorder_note, 'Baked Friday morning');

  // Disable mid-cart: stale claims refused, history intact.
  await env.req('/api/admin/items/' + itemId, {
    method: 'PATCH', cookie: adminCookie, body: { isPreorder: false },
  });
  const trackAgain = await env.req('/api/orders/track/' + order.data.order.code);
  assert.strictEqual(trackAgain.data.order.items[0].is_preorder, true);
  assert.strictEqual(trackAgain.data.order.items[0].preorder_note, 'Baked Friday morning');
});

test('normal products behave byte-identically with pre-order off', async () => {
  const res = await env.req(`/api/restaurants/${slug}/orders`, {
    method: 'POST',
    body: {
      customerName: 'Regular', customerWhatsapp: '+15551234567', orderType: 'pickup',
      items: [{ itemId, quantity: 1 }],
    },
  });
  assert.strictEqual(res.status, 201);
  const track = await env.req('/api/orders/track/' + res.data.order.code);
  assert.strictEqual(track.data.order.items[0].is_preorder, false);
});
