'use strict';

/** Food Business Foundation US2: new business type on the shared platform. */

process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || '';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startApp } = require('./helpers');

let env;
let ownerCookie;
let bakery;
let diner;

before(async () => {
  env = await startApp();
  await env.createPlatformOwner('root', 'owner-password-123');
  ownerCookie = await env.login('root', 'owner-password-123');
  diner = await env.createRestaurantFixture(ownerCookie, { name: 'Type Diner', slug: 'type-diner' });
  bakery = await env.createRestaurantFixture(ownerCookie, { name: 'Type Bakery', slug: 'type-bakery' });
  const setType = await env.req('/api/owner/restaurants/' + bakery.restaurantId, {
    method: 'PATCH', cookie: ownerCookie, body: { businessType: 'bakery' },
  });
  assert.strictEqual(setType.status, 200);
  assert.strictEqual(setType.data.restaurant.businessType, 'bakery');
});

after(async () => {
  if (env) await env.close();
});

test('owner create accepts a closed-set type and rejects unknown types', async () => {
  const bad = await env.req('/api/owner/restaurants', {
    method: 'POST',
    cookie: ownerCookie,
    body: { name: 'Bad Type', slug: 'bad-type', businessType: 'spaceship' },
  });
  assert.strictEqual(bad.status, 400);

  const created = await env.req('/api/owner/restaurants', {
    method: 'POST',
    cookie: ownerCookie,
    body: { name: 'Cake Lab', slug: 'cake-lab', businessType: 'cake_business' },
  });
  assert.strictEqual(created.status, 201);
  assert.strictEqual(created.data.restaurant.businessType, 'cake_business');
});

test('omitted type defaults to restaurant', async () => {
  const created = await env.req('/api/owner/restaurants', {
    method: 'POST',
    cookie: ownerCookie,
    body: { name: 'Plain Diner', slug: 'plain-diner' },
  });
  assert.strictEqual(created.status, 201);
  assert.strictEqual(created.data.restaurant.businessType, 'restaurant');
});

test('bakery storefront works on shared flows and tenants stay isolated', async () => {
  const view = await env.req('/api/restaurants/type-bakery/menu');
  assert.strictEqual(view.status, 200);
  assert.strictEqual(view.data.businessType, 'bakery');

  const dir = await env.req('/api/restaurants');
  const entry = dir.data.restaurants.find((r) => r.slug === 'type-bakery');
  assert.strictEqual(entry.businessType, 'bakery');

  for (const [cookie, otherId, label] of [
    [diner.adminCookie, bakery.restaurantId, 'diner-into-bakery'],
    [bakery.adminCookie, diner.restaurantId, 'bakery-into-diner'],
  ]) {
    const res = await env.req('/api/admin/orders?limit=10&restaurantId=' + otherId, { cookie });
    assert.ok(res.status === 404 || res.status === 403, label + ' denied, got ' + res.status);
  }
});
