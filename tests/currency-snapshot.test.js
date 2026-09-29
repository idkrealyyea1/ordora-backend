'use strict';

/** Task 3 US3: orders keep creation-time currency context across changes. */

process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || '';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startApp } = require('./helpers');

let env;
let ownerCookie;
let adminCookie;
let restaurantId;
let itemId;
const slug = 'currency-snap';

before(async () => {
  env = await startApp();
  await env.createPlatformOwner('root', 'owner-password-123');
  ownerCookie = await env.login('root', 'owner-password-123');
  const created = await env.req('/api/owner/restaurants', {
    method: 'POST',
    cookie: ownerCookie,
    body: { name: 'Currency Snap', slug, businessType: 'bakery', currency: 'jod' },
  });
  assert.strictEqual(created.status, 201);
  restaurantId = created.data.restaurant.id;
  const adminUsername = `${slug}-admin`;
  await env.req(`/api/owner/restaurants/${restaurantId}/admins`, {
    method: 'POST',
    cookie: ownerCookie,
    body: { username: adminUsername, password: 'admin-password-123' },
  });
  adminCookie = await env.login(adminUsername, 'admin-password-123');
  const cat = await env.req('/api/admin/categories', {
    method: 'POST', cookie: adminCookie, body: { name: 'Breads' },
  });
  const item = await env.req('/api/admin/items', {
    method: 'POST', cookie: adminCookie,
    body: { categoryId: cat.data.category.id, name: 'Loaf', priceCents: 900 },
  });
  itemId = item.data.item.id;
});

after(async () => {
  if (env) await env.close();
});

test('tracked history keeps creation context after a currency change', async () => {
  const first = await env.req(`/api/restaurants/${slug}/orders`, {
    method: 'POST',
    body: {
      customerName: 'Snap Buyer',
      customerWhatsapp: '+15551234567',
      orderType: 'pickup',
      items: [{ itemId, quantity: 1 }],
    },
  });
  assert.strictEqual(first.status, 201);

  await env.req('/api/admin/settings', {
    method: 'PATCH', cookie: adminCookie, body: { currency: 'aed' },
  });

  const track = await env.req('/api/orders/track/' + first.data.order.code);
  assert.strictEqual(track.status, 200);
  assert.strictEqual(track.data.order.total_cents, 900);
  assert.strictEqual(track.data.order.currency, 'JOD');

  const second = await env.req(`/api/restaurants/${slug}/orders`, {
    method: 'POST',
    body: {
      customerName: 'New Buyer',
      customerWhatsapp: '+15551234567',
      orderType: 'pickup',
      items: [{ itemId, quantity: 1 }],
    },
  });
  assert.strictEqual(second.status, 201);
  const track2 = await env.req('/api/orders/track/' + second.data.order.code);
  assert.strictEqual(track2.data.order.currency, 'AED');
});

test('analytics carry per-currency context across the change', async () => {
  const res = await env.req('/api/admin/analytics?days=30', { cookie: adminCookie });
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.data.currencies), 'currencies context present');
  assert.ok(res.data.currencies.includes('JOD'), 'history currency present');
});
