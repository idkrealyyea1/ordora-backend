'use strict';

/** Task 4 US1: identity payload completeness for every business state. */

process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || '';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startApp } = require('./helpers');

let env;
let ownerCookie;
const slug = 'identity-diner';

before(async () => {
  env = await startApp();
  await env.createPlatformOwner('root', 'owner-password-123');
  ownerCookie = await env.login('root', 'owner-password-123');
  await env.createRestaurantFixture(ownerCookie, { name: 'Identity Diner', slug });
});

after(async () => {
  if (env) await env.close();
});

test('public view carries every identity, contact, and currency field', async () => {
  const view = await env.req('/api/restaurants/' + slug + '/menu');
  assert.strictEqual(view.status, 200);
  assert.ok(view.data.name);
  assert.strictEqual(view.data.slug, slug);
  assert.ok('openNow' in view.data);
  assert.ok(view.data.settings);
  for (const key of ['description', 'phone', 'whatsapp', 'address', 'logoPath', 'coverPath', 'currency', 'deliveryFeeCents']) {
    assert.ok(key in view.data.settings, key + ' present');
  }
});

test('closed and asset-missing states stay clean and explicit', async () => {
  const created = await env.req('/api/owner/restaurants', {
    method: 'POST',
    cookie: ownerCookie,
    body: { name: 'Bare Kitchen', slug: 'bare-kitchen', businessType: 'home_kitchen' },
  });
  const id = created.data.restaurant.id;
  const adminUsername = 'bare-kitchen-admin';
  await env.req(`/api/owner/restaurants/${id}/admins`, {
    method: 'POST',
    cookie: ownerCookie,
    body: { username: adminUsername, password: 'admin-password-123' },
  });
  const bareCookie = await env.login(adminUsername, 'admin-password-123');
  const shut = await env.req('/api/admin/status', {
    method: 'PATCH', cookie: bareCookie, body: { status: 'closed' },
  });
  assert.strictEqual(shut.status, 200);
  const view = await env.req('/api/restaurants/bare-kitchen/menu');
  assert.strictEqual(view.status, 200);
  assert.strictEqual(view.data.status, 'closed');
  assert.strictEqual(view.data.openNow, false);
});
