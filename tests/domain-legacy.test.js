'use strict';

/** Task 2 US1: legacy restaurants byte-identical after domain work. */

process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || '';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startApp } = require('./helpers');

let env;
let adminCookie;
let itemId;
const slug = 'legacy-diner';

before(async () => {
  env = await startApp();
  await env.createPlatformOwner('root', 'owner-password-123');
  const ownerCookie = await env.login('root', 'owner-password-123');
  const fx = await env.createRestaurantFixture(ownerCookie, { name: 'Legacy Diner', slug });
  adminCookie = fx.adminCookie;
  itemId = fx.itemId;
});

after(async () => {
  if (env) await env.close();
});

test('legacy restaurant reads as restaurant type with unchanged data', async () => {
  const mine = await env.req('/api/admin/restaurant', { cookie: adminCookie });
  assert.strictEqual(mine.status, 200);
  assert.strictEqual(mine.data.restaurant.businessType, 'restaurant');
  assert.strictEqual(mine.data.restaurant.slug, slug);
});

test('legacy guest checkout and tracking unchanged', async () => {
  const res = await env.req(`/api/restaurants/${slug}/orders`, {
    method: 'POST',
    body: {
      customerName: 'Old Regular',
      customerWhatsapp: '+15551234567',
      orderType: 'pickup',
      items: [{ itemId, quantity: 1 }],
    },
  });
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.data.order.totalCents, 850);

  const track = await env.req('/api/orders/track/' + res.data.order.code);
  assert.strictEqual(track.status, 200);
});
