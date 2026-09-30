'use strict';

/** Task 5 US1: option-free products and history byte-identical. */

process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || '';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startApp } = require('./helpers');

let env;
let adminCookie;
let itemId;
const slug = 'options-plain';

before(async () => {
  env = await startApp();
  await env.createPlatformOwner('root', 'owner-password-123');
  const ownerCookie = await env.login('root', 'owner-password-123');
  const fx = await env.createRestaurantFixture(ownerCookie, { name: 'Options Plain', slug });
  adminCookie = fx.adminCookie;
  itemId = fx.itemId;
});

after(async () => {
  if (env) await env.close();
});

test('option-free items attach empty option sets and price unchanged', async () => {
  const view = await env.req('/api/restaurants/' + slug + '/menu');
  assert.strictEqual(view.status, 200);
  const item = view.data.items.find((i) => i.id === itemId);
  assert.deepStrictEqual(item.options || [], []);
});

test('option-free checkout, tracking, and history unchanged', async () => {
  const res = await env.req(`/api/restaurants/${slug}/orders`, {
    method: 'POST',
    body: {
      customerName: 'Plain Buyer',
      customerWhatsapp: '+15551234567',
      orderType: 'pickup',
      items: [{ itemId, quantity: 2 }],
    },
  });
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.data.order.totalCents, 1700);

  const track = await env.req('/api/orders/track/' + res.data.order.code);
  assert.strictEqual(track.status, 200);
  assert.strictEqual(track.data.order.total_cents, 1700);
  assert.deepStrictEqual(track.data.order.items[0].options || [], []);
});
