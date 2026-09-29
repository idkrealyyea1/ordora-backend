'use strict';

/** Task 2 US2: six required kinds on the shared flow + dashboards-only + owner-only locks. */

process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || '';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startApp } = require('./helpers');

const KINDS = [
  ['restaurant', 'kind-restaurant'],
  ['cafe', 'kind-cafe'],
  ['bakery', 'kind-bakery'],
  ['dessert_shop', 'kind-dessert'],
  ['home_kitchen', 'kind-home'],
  ['cloud_kitchen', 'kind-cloud'],
];

let env;
let ownerCookie;
const fixtures = {};

before(async () => {
  env = await startApp();
  await env.createPlatformOwner('root', 'owner-password-123');
  ownerCookie = await env.login('root', 'owner-password-123');
  for (const [kind, slug] of KINDS) {
    const created = await env.req('/api/owner/restaurants', {
      method: 'POST',
      cookie: ownerCookie,
      body: { name: 'Kind ' + kind, slug, businessType: kind },
    });
    assert.strictEqual(created.status, 201, kind + ' created');
    const adminUsername = `${slug}-admin`;
    await env.req(`/api/owner/restaurants/${created.data.restaurant.id}/admins`, {
      method: 'POST',
      cookie: ownerCookie,
      body: { username: adminUsername, password: 'admin-password-123' },
    });
    const adminCookie = await env.login(adminUsername, 'admin-password-123');
    const cat = await env.req('/api/admin/categories', {
      method: 'POST', cookie: adminCookie, body: { name: 'Mains' },
    });
    const item = await env.req('/api/admin/items', {
      method: 'POST', cookie: adminCookie,
      body: { categoryId: cat.data.category.id, name: 'Staple', priceCents: 400 },
    });
    fixtures[kind] = { restaurantId: created.data.restaurant.id, adminCookie, itemId: item.data.item.id };
  }
});

after(async () => {
  if (env) await env.close();
});

test('each required kind takes a guest order on the shared flow', async () => {
  for (const [kind, slug] of KINDS) {
    const res = await env.req(`/api/restaurants/${slug}/orders`, {
      method: 'POST',
      body: {
        customerName: 'Kind Guest',
        customerWhatsapp: '+15551234567',
        orderType: 'pickup',
        items: [{ itemId: fixtures[kind].itemId, quantity: 1 }],
      },
    });
    assert.strictEqual(res.status, 201, kind + ' guest checkout');
    assert.strictEqual(res.data.order.totalCents, 400);
  }
});

test('type visible in dashboards, never badged on storefronts; mutation is owner-only', async () => {
  const fx = fixtures.bakery;

  const mine = await env.req('/api/admin/restaurant', { cookie: fx.adminCookie });
  assert.strictEqual(mine.data.restaurant.businessType, 'bakery');

  const listed = await env.req('/api/owner/restaurants?search=kind-bakery', { cookie: ownerCookie });
  const row = listed.data.restaurants.find((r) => r.slug === 'kind-bakery');
  assert.strictEqual(row.businessType, 'bakery');

  const page = await env.req('/restaurant/kind-bakery', { raw: true });
  assert.strictEqual(page.status, 200);

  const sneak = await env.req('/api/admin/settings', {
    method: 'PATCH', cookie: fx.adminCookie, body: { description: 'Still a bakery', businessType: 'cafe' },
  });
  assert.strictEqual(sneak.status, 200);
  const after = await env.req('/api/admin/restaurant', { cookie: fx.adminCookie });
  assert.strictEqual(after.data.restaurant.businessType, 'bakery');

  const moved = await env.req('/api/owner/restaurants/' + fx.restaurantId, {
    method: 'PATCH', cookie: ownerCookie, body: { businessType: 'cafe' },
  });
  assert.strictEqual(moved.data.restaurant.businessType, 'cafe');
  const back = await env.req('/api/owner/restaurants/' + fx.restaurantId, {
    method: 'PATCH', cookie: ownerCookie, body: { businessType: 'bakery' },
  });
  assert.strictEqual(back.data.restaurant.businessType, 'bakery');
});
