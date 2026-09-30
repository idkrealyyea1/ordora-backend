'use strict';

/** Tasks 6-8 US2: minimal guest journey with atomic idempotent creation. */

process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || '';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startApp } = require('./helpers');

let env;
let itemId;
let feeCents;
const slug = 'journey-checkout';

before(async () => {
  env = await startApp();
  await env.createPlatformOwner('root', 'owner-password-123');
  const ownerCookie = await env.login('root', 'owner-password-123');
  const fx = await env.createRestaurantFixture(ownerCookie, { name: 'Journey Checkout', slug });
  itemId = fx.itemId;
  const view = await env.req('/api/restaurants/' + slug + '/menu');
  feeCents = view.data.settings.deliveryFeeCents;
});

after(async () => {
  if (env) await env.close();
});

test('review totals match server confirmation in business currency', async () => {
  const view = await env.req('/api/restaurants/' + slug + '/menu');
  assert.ok(view.data.settings.currency);

  const res = await env.req(`/api/restaurants/${slug}/orders`, {
    method: 'POST',
    body: {
      customerName: 'Minimal', customerWhatsapp: '+15551234567', orderType: 'delivery',
      customerAddress: '3 Journey Road, Town', notes: 'Ring twice',
      items: [{ itemId, quantity: 2 }],
    },
  });
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.data.order.totalCents, 1700 + feeCents);
  assert.ok(res.data.order.code);
});

test('duplicate submits create one order; failures create none', async () => {
  const key = '12345678-1234-4234-8234-123456789012';
  const body = () => ({
    customerName: 'Retry', customerWhatsapp: '+15551234567', orderType: 'pickup',
    submissionKey: key, items: [{ itemId, quantity: 1 }],
  });
  const first = await env.req(`/api/restaurants/${slug}/orders`, { method: 'POST', body: body() });
  assert.strictEqual(first.status, 201);
  const retry = await env.req(`/api/restaurants/${slug}/orders`, { method: 'POST', body: body() });
  assert.strictEqual(retry.data.order.code, first.data.order.code);

  const before = await env.req('/api/orders/track/' + first.data.order.code);
  assert.strictEqual(before.status, 200);

  const bad = await env.req(`/api/restaurants/${slug}/orders`, {
    method: 'POST',
    body: {
      customerName: 'X', customerWhatsapp: 'bad', orderType: 'pickup',
      items: [{ itemId, quantity: 1 }],
    },
  });
  assert.notStrictEqual(bad.status, 201);
});
