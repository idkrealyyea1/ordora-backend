'use strict';

/** Task 4 US3: cart totals coherence from quote to server confirmation. */

process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || '';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startApp } = require('./helpers');

let env;
let itemId;
let feeCents;
const slug = 'cart-diner';

before(async () => {
  env = await startApp();
  await env.createPlatformOwner('root', 'owner-password-123');
  const ownerCookie = await env.login('root', 'owner-password-123');
  const fx = await env.createRestaurantFixture(ownerCookie, { name: 'Cart Diner', slug });
  itemId = fx.itemId;
  const view = await env.req('/api/restaurants/' + slug + '/menu');
  feeCents = view.data.settings.deliveryFeeCents;
});

after(async () => {
  if (env) await env.close();
});

test('pickup and delivery totals equal server-confirmed values', async () => {
  const pickup = await env.req(`/api/restaurants/${slug}/orders`, {
    method: 'POST',
    body: {
      customerName: 'Cart Guest',
      customerWhatsapp: '+15551234567',
      orderType: 'pickup',
      items: [{ itemId, quantity: 2 }],
    },
  });
  assert.strictEqual(pickup.status, 201);
  assert.strictEqual(pickup.data.order.totalCents, 1700);

  const delivery = await env.req(`/api/restaurants/${slug}/orders`, {
    method: 'POST',
    body: {
      customerName: 'Cart Guest',
      customerWhatsapp: '+15551234567',
      orderType: 'delivery',
      customerAddress: '7 Cart Lane, Town',
      items: [{ itemId, quantity: 2 }],
    },
  });
  assert.strictEqual(delivery.status, 201);
  assert.strictEqual(delivery.data.order.totalCents, 1700 + feeCents);

  for (const order of [pickup.data.order, delivery.data.order]) {
    const track = await env.req('/api/orders/track/' + order.code);
    assert.strictEqual(track.data.order.total_cents, order.totalCents);
  }
});
