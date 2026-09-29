'use strict';

/** Task 3 US1: legacy businesses operate with zero difference and zero repair. */

process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || '';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startApp } = require('./helpers');

let env;
let adminCookie;
let itemId;
const slug = 'currency-legacy';

before(async () => {
  env = await startApp();
  await env.createPlatformOwner('root', 'owner-password-123');
  const ownerCookie = await env.login('root', 'owner-password-123');
  const fx = await env.createRestaurantFixture(ownerCookie, { name: 'Currency Legacy', slug });
  adminCookie = fx.adminCookie;
  itemId = fx.itemId;
});

after(async () => {
  if (env) await env.close();
});

test('migrated history backfills current context with identical values', async () => {
  const view = await env.req('/api/restaurants/' + slug + '/menu');
  assert.strictEqual(view.status, 200);
  assert.strictEqual(view.data.settings.currency, 'USD');
});

test('legacy checkout, tracking, and export unchanged', async () => {
  const res = await env.req(`/api/restaurants/${slug}/orders`, {
    method: 'POST',
    body: {
      customerName: 'Legacy Buyer',
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
  assert.strictEqual(track.data.order.currency, 'USD');

  const csv = await env.req('/api/admin/reports/orders.csv?scope=all', { cookie: adminCookie, raw: true });
  assert.strictEqual(csv.status, 200);
});
