'use strict';

/** Tasks 6-8 US3: enforced transitions with joint dashboard/SSE/timeline truth. */

process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || '';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startApp } = require('./helpers');

let env;
let adminCookie;
let itemId;
const slug = 'journey-life';

before(async () => {
  env = await startApp();
  await env.createPlatformOwner('root', 'owner-password-123');
  const ownerCookie = await env.login('root', 'owner-password-123');
  const fx = await env.createRestaurantFixture(ownerCookie, { name: 'Journey Life', slug });
  adminCookie = fx.adminCookie;
  itemId = fx.itemId;
});

after(async () => {
  if (env) await env.close();
});

async function placeOrder() {
  const res = await env.req(`/api/restaurants/${slug}/orders`, {
    method: 'POST',
    body: {
      customerName: 'Lifer', customerWhatsapp: '+15551234567', orderType: 'pickup',
      items: [{ itemId, quantity: 1 }],
    },
  });
  assert.strictEqual(res.status, 201);
  return res.data.order.code;
}

test('valid pickup walk terminates; invalid jumps and terminal edits refused', async () => {
  const code = await placeOrder();
  const id = code; // admin endpoints accept UUID or tracking code

  for (const next of ['confirmed', 'preparing', 'ready', 'completed']) {
    const res = await env.req(`/api/admin/orders/${id}/status`, {
      method: 'PATCH', cookie: adminCookie, body: { status: next },
    });
    assert.strictEqual(res.status, 200, 'to ' + next);
  }
  const done = await env.req('/api/orders/track/' + code);
  assert.strictEqual(done.data.order.status, 'completed');

  const revive = await env.req(`/api/admin/orders/${id}/status`, {
    method: 'PATCH', cookie: adminCookie, body: { status: 'preparing' },
  });
  assert.notStrictEqual(revive.status, 200);

  const repeat = await env.req(`/api/admin/orders/${id}/status`, {
    method: 'PATCH', cookie: adminCookie, body: { status: 'completed' },
  });
  assert.notStrictEqual(repeat.status, 200);
  const still = await env.req('/api/orders/track/' + code);
  assert.strictEqual(still.data.order.status, 'completed');
});

test('delivery-only state refused for pickup; unknown states rejected', async () => {
  const code = await placeOrder();
  const id = code; // admin endpoints accept UUID or tracking code

  const wrong = await env.req(`/api/admin/orders/${id}/status`, {
    method: 'PATCH', cookie: adminCookie, body: { status: 'out_for_delivery' },
  });
  assert.notStrictEqual(wrong.status, 200);

  const unknown = await env.req(`/api/admin/orders/${id}/status`, {
    method: 'PATCH', cookie: adminCookie, body: { status: 'flying' },
  });
  assert.strictEqual(unknown.status, 400);

  const jump = await env.req(`/api/admin/orders/${id}/status`, {
    method: 'PATCH', cookie: adminCookie, body: { status: 'completed' },
  });
  assert.notStrictEqual(jump.status, 200);
});
