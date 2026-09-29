'use strict';

/** Food Business Foundation US1: default-type regression (existing behavior unchanged). */

process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || '';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startApp } = require('./helpers');

let env;
let adminCookie;
let itemId;
const slug = 'regression-diner';

before(async () => {
  env = await startApp();
  await env.createPlatformOwner('root', 'owner-password-123');
  const ownerCookie = await env.login('root', 'owner-password-123');
  const fx = await env.createRestaurantFixture(ownerCookie, { name: 'Regression Diner', slug });
  adminCookie = fx.adminCookie;
  itemId = fx.itemId;
});

after(async () => {
  if (env) await env.close();
});

test('creation without type defaults to restaurant and exposes it read-only', async () => {
  const view = await env.req('/api/restaurants/' + slug + '/menu');
  assert.strictEqual(view.status, 200);
  assert.strictEqual(view.data.businessType, 'restaurant');
  assert.ok(view.data.settings.currency);
});

test('guest pickup and delivery checkout unchanged with server-side totals', async () => {
  for (const orderType of ['pickup', 'delivery']) {
    const body = {
      customerName: 'Sam Diner',
      customerWhatsapp: '+15551234567',
      orderType,
      items: [{ itemId, quantity: 2 }],
    };
    if (orderType === 'delivery') body.customerAddress = '123 Main Street, Town';
    const res = await env.req(`/api/restaurants/${slug}/orders`, { method: 'POST', body });
    assert.strictEqual(res.status, 201);
    // 2 x 850c fixture price + zero default delivery fee, computed server-side.
    assert.strictEqual(res.data.order.totalCents, 1700);

    const track = await env.req('/api/orders/track/' + res.data.order.code);
    assert.strictEqual(track.status, 200);
    assert.strictEqual(track.data.order.code, res.data.order.code);
  }
});
