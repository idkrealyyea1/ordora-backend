'use strict';

/** Task 3 US2: business-admin currency selection with no-conversion guarantee. */

process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || '';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startApp } = require('./helpers');

const PREPARED = ['ILS', 'USD', 'EUR', 'GBP', 'JOD', 'SAR', 'AED', 'EGP'];

let env;
let adminCookie;
let itemId;
let categoryId;
const slug = 'currency-select';

before(async () => {
  env = await startApp();
  await env.createPlatformOwner('root', 'owner-password-123');
  const ownerCookie = await env.login('root', 'owner-password-123');
  const fx = await env.createRestaurantFixture(ownerCookie, { name: 'Currency Select', slug });
  adminCookie = fx.adminCookie;
  itemId = fx.itemId;
  categoryId = fx.categoryId;
});

after(async () => {
  if (env) await env.close();
});

test('each prepared code is selectable and presented', async () => {
  for (const code of PREPARED) {
    const res = await env.req('/api/admin/settings', {
      method: 'PATCH', cookie: adminCookie, body: { currency: code.toLowerCase() },
    });
    assert.strictEqual(res.status, 200, code + ' accepted');
    assert.strictEqual(res.data.settings.currency, code);
  }
  // Restore business-admin default for later tests.
  await env.req('/api/admin/settings', {
    method: 'PATCH', cookie: adminCookie, body: { currency: 'usd' },
  });
});

test('malformed codes rejected with stored value intact', async () => {
  for (const bad of ['xx', 'USDD', 'US$', '', '12']) {
    const res = await env.req('/api/admin/settings', {
      method: 'PATCH', cookie: adminCookie, body: { currency: bad, description: 'probe' },
    });
    if (bad === '') continue; // empty means "no change" for optional fields
    assert.strictEqual(res.status, 400, JSON.stringify(bad) + ' rejected');
  }
  const view = await env.req('/api/restaurants/' + slug + '/menu');
  assert.strictEqual(view.data.settings.currency, 'USD');
});

test('currency change converts nothing in storage', async () => {
  const before = await env.req('/api/admin/items', { cookie: adminCookie });
  const storedPrices = before.data.items.map((i) => i.price_cents);

  await env.req('/api/admin/settings', {
    method: 'PATCH', cookie: adminCookie, body: { currency: 'egp' },
  });

  const after = await env.req('/api/admin/items', { cookie: adminCookie });
  assert.deepStrictEqual(after.data.items.map((i) => i.price_cents), storedPrices);

  const view = await env.req('/api/restaurants/' + slug + '/menu');
  assert.strictEqual(view.data.settings.currency, 'EGP');

  await env.req('/api/admin/settings', {
    method: 'PATCH', cookie: adminCookie, body: { currency: 'usd' },
  });
});
