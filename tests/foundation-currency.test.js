'use strict';

/** Food Business Foundation US3: per-business currency with integer math. */

process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || '';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startApp } = require('./helpers');

let env;
let ownerCookie;
let adminCookie;
let restaurantId;
let itemId;
const slug = 'currency-bakery';

before(async () => {
  env = await startApp();
  await env.createPlatformOwner('root', 'owner-password-123');
  ownerCookie = await env.login('root', 'owner-password-123');
  const created = await env.req('/api/owner/restaurants', {
    method: 'POST',
    cookie: ownerCookie,
    body: { name: 'Currency Bakery', slug, businessType: 'bakery', currency: 'jod' },
  });
  assert.strictEqual(created.status, 201);
  restaurantId = created.data.restaurant.id;

  const fx = { adminUsername: `${slug}-admin`, adminPassword: 'admin-password-123' };
  await env.req(`/api/owner/restaurants/${restaurantId}/admins`, {
    method: 'POST',
    cookie: ownerCookie,
    body: { username: fx.adminUsername, password: fx.adminPassword },
  });
  adminCookie = await env.login(fx.adminUsername, fx.adminPassword);

  const cat = await env.req('/api/admin/categories', {
    method: 'POST', cookie: adminCookie, body: { name: 'Breads' },
  });
  const item = await env.req('/api/admin/items', {
    method: 'POST', cookie: adminCookie,
    body: { categoryId: cat.data.category.id, name: 'Flatbread', priceCents: 500 },
  });
  itemId = item.data.item.id;
});

after(async () => {
  if (env) await env.close();
});

test('creation currency is honored per business and invalid codes rejected', async () => {
  const view = await env.req('/api/restaurants/' + slug + '/menu');
  assert.strictEqual(view.status, 200);
  assert.strictEqual(view.data.settings.currency, 'JOD');

  const bad = await env.req('/api/owner/restaurants', {
    method: 'POST',
    cookie: ownerCookie,
    body: { name: 'Bad Currency', slug: 'bad-currency', currency: 'xx' },
  });
  assert.strictEqual(bad.status, 400);
});

test('checkout math stays integer and snapshots survive currency changes', async () => {
  const order = await env.req(`/api/restaurants/${slug}/orders`, {
    method: 'POST',
    body: {
      customerName: 'Jo Buyer',
      customerWhatsapp: '+15551234567',
      orderType: 'pickup',
      items: [{ itemId, quantity: 3 }],
    },
  });
  assert.strictEqual(order.status, 201);
  assert.strictEqual(order.data.order.totalCents, 1500);

  const patched = await env.req('/api/admin/settings', {
    method: 'PATCH', cookie: adminCookie, body: { currency: 'sar' },
  });
  assert.strictEqual(patched.status, 200);
  assert.strictEqual(patched.data.settings.currency, 'SAR');

  const track = await env.req('/api/orders/track/' + order.data.order.code);
  assert.strictEqual(track.status, 200);
  assert.strictEqual(track.data.order.total_cents, 1500);
});
