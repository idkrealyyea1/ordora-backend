'use strict';

/** Food Business Foundation US4: pre-order reserve (unknown fields tolerated, enforcement unchanged). */

process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || '';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startApp } = require('./helpers');

let env;
let adminCookie;
let categoryId;
let itemId;
const slug = 'reserve-diner';

before(async () => {
  env = await startApp();
  await env.createPlatformOwner('root', 'owner-password-123');
  const ownerCookie = await env.login('root', 'owner-password-123');
  const fx = await env.createRestaurantFixture(ownerCookie, { name: 'Reserve Diner', slug });
  adminCookie = fx.adminCookie;
  categoryId = fx.categoryId;
  itemId = fx.itemId;
});

after(async () => {
  if (env) await env.close();
});

test('unknown future availability fields are ignored, never stored or trusted', async () => {
  const created = await env.req('/api/admin/items', {
    method: 'POST',
    cookie: adminCookie,
    body: {
      categoryId, name: 'Future Pie', priceCents: 600, availableAt: '2030-01-01', isPreorder: true,
    },
  });
  assert.strictEqual(created.status, 201);
  assert.ok(!('availableAt' in created.data.item), 'future field not echoed');
  assert.ok(!('isPreorder' in created.data.item), 'future field not echoed');

  const view = await env.req('/api/restaurants/' + slug + '/menu');
  const seen = view.data.items.find((i) => i.name === 'Future Pie');
  assert.ok(seen && !('availableAt' in seen), 'future field not leaked to storefront');
});

test('current availability enforcement still gates checkout', async () => {
  const off = await env.req('/api/admin/items/' + itemId, {
    method: 'PATCH', cookie: adminCookie, body: { isAvailable: false },
  });
  assert.strictEqual(off.status, 200);

  const res = await env.req(`/api/restaurants/${slug}/orders`, {
    method: 'POST',
    body: {
      customerName: 'Pat Guest',
      customerWhatsapp: '+15551234567',
      orderType: 'pickup',
      items: [{ itemId, quantity: 1 }],
    },
  });
  assert.notStrictEqual(res.status, 201);
});
