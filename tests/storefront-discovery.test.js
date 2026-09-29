'use strict';

/** Task 4 US2: discovery payloads and soldout gating on the shared flow. */

process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || '';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startApp } = require('./helpers');

let env;
let adminCookie;
let itemId;
const slug = 'discovery-diner';

before(async () => {
  env = await startApp();
  await env.createPlatformOwner('root', 'owner-password-123');
  const ownerCookie = await env.login('root', 'owner-password-123');
  const fx = await env.createRestaurantFixture(ownerCookie, { name: 'Discovery Diner', slug });
  adminCookie = fx.adminCookie;
  itemId = fx.itemId;
});

after(async () => {
  if (env) await env.close();
});

test('menu view exposes categories, currency-priced items, and availability', async () => {
  const view = await env.req('/api/restaurants/' + slug + '/menu');
  assert.strictEqual(view.status, 200);
  assert.ok(view.data.categories.length >= 1);
  const item = view.data.items.find((i) => i.id === itemId);
  assert.ok(item);
  assert.strictEqual(typeof item.price_cents, 'number');
  assert.strictEqual(typeof item.is_available, 'boolean');
  assert.ok(view.data.settings.currency);
});

test('unavailable items are refused at checkout through every path', async () => {
  const off = await env.req('/api/admin/items/' + itemId, {
    method: 'PATCH', cookie: adminCookie, body: { isAvailable: false },
  });
  assert.strictEqual(off.status, 200);

  for (const orderType of ['pickup', 'delivery']) {
    const body = {
      customerName: 'Searcher',
      customerWhatsapp: '+15551234567',
      orderType,
      items: [{ itemId, quantity: 1 }],
    };
    if (orderType === 'delivery') body.customerAddress = '1 Search Street, Town';
    const res = await env.req(`/api/restaurants/${slug}/orders`, { method: 'POST', body });
    assert.notStrictEqual(res.status, 201, orderType + ' blocked for soldout');
  }
});
