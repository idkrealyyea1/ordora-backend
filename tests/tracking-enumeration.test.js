'use strict';

/**
 * FR-007: unauthenticated code lookups must resist enumeration and expose
 * only the minimum fields needed for tracking.
 */

process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || '';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startApp } = require('./helpers');

let env;
let fx;
let realCode;

before(async () => {
  env = await startApp({ orderRateMax: 1000 });
  await env.createPlatformOwner('root', 'owner-password-123');
  const ownerCookie = await env.login('root', 'owner-password-123');
  fx = await env.createRestaurantFixture(ownerCookie, { name: 'Enum Cafe', slug: 'enum-cafe' });

  // Hours are not under test here: bypass the clock so this file passes at any hour.
  const hrs = await env.req('/api/admin/settings', {
    method: 'PATCH', cookie: fx.adminCookie, body: { ignoreOpeningHours: true },
  });
  assert.strictEqual(hrs.status, 200);

  const order = await env.req('/api/restaurants/' + fx.slug + '/orders', {
    method: 'POST',
    body: {
      customerName: 'Enum Customer',
      customerWhatsapp: '15550002222',
      orderType: 'pickup',
      items: [{ itemId: fx.itemId, quantity: 1 }],
    },
  });
  assert.strictEqual(order.status, 201);
  realCode = order.data.order.code;
});

after(async () => {
  if (env) await env.close();
});

test('tracking exposes no customer PII or internal ids', async () => {
  const res = await env.req('/api/orders/track/' + realCode);
  assert.strictEqual(res.status, 200);
  const body = JSON.stringify(res.data);
  assert.ok(!('id' in (res.data.order || res.data)), 'no internal id');
  assert.ok(!body.includes('15550002222'), 'no customer whatsapp');
  assert.ok(!body.includes('Enum Customer'), 'no customer name');
});

test('guessed codes do not leak existence (uniform 404)', async () => {
  for (const code of ['AAAAAAAA', 'ZZZZ9999', '12345678']) {
    const res = await env.req('/api/orders/track/' + code);
    assert.strictEqual(res.status, 404, code + ' must 404, got ' + res.status);
  }
});

test('lowercase code resolves same as uppercase (no bypass channel)', async () => {
  const res = await env.req('/api/orders/track/' + realCode.toLowerCase());
  assert.strictEqual(res.status, 200);
});
