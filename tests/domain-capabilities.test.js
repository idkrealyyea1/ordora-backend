'use strict';

/** Task 2 US3: capability variance on the shared flow without duplication. */

process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || '';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startApp } = require('./helpers');

let env;
let adminCookie;
let itemId;
const slug = 'cap-cloud';

before(async () => {
  env = await startApp();
  await env.createPlatformOwner('root', 'owner-password-123');
  const ownerCookie = await env.login('root', 'owner-password-123');
  const created = await env.req('/api/owner/restaurants', {
    method: 'POST',
    cookie: ownerCookie,
    body: { name: 'Cap Cloud', slug, businessType: 'cloud_kitchen' },
  });
  assert.strictEqual(created.status, 201);
  const adminUsername = `${slug}-admin`;
  await env.req(`/api/owner/restaurants/${created.data.restaurant.id}/admins`, {
    method: 'POST',
    cookie: ownerCookie,
    body: { username: adminUsername, password: 'admin-password-123' },
  });
  adminCookie = await env.login(adminUsername, 'admin-password-123');
  const cat = await env.req('/api/admin/categories', {
    method: 'POST', cookie: adminCookie, body: { name: 'Mains' },
  });
  const item = await env.req('/api/admin/items', {
    method: 'POST', cookie: adminCookie,
    body: { categoryId: cat.data.category.id, name: 'Bowl', priceCents: 700 },
  });
  itemId = item.data.item.id;

  const off = await env.req('/api/admin/settings', {
    method: 'PATCH', cookie: adminCookie, body: { deliveryEnabled: false },
  });
  assert.strictEqual(off.status, 200);
});

after(async () => {
  if (env) await env.close();
});

test('delivery-disabled type refuses delivery with pickup intact', async () => {
  const denied = await env.req(`/api/restaurants/${slug}/orders`, {
    method: 'POST',
    body: {
      customerName: 'No Delivery',
      customerWhatsapp: '+15551234567',
      orderType: 'delivery',
      customerAddress: '9 Cloud Street, Town',
      items: [{ itemId, quantity: 1 }],
    },
  });
  assert.notStrictEqual(denied.status, 201);

  const ok = await env.req(`/api/restaurants/${slug}/orders`, {
    method: 'POST',
    body: {
      customerName: 'Pickup Fan',
      customerWhatsapp: '+15551234567',
      orderType: 'pickup',
      items: [{ itemId, quantity: 1 }],
    },
  });
  assert.strictEqual(ok.status, 201);
  assert.strictEqual(ok.data.order.totalCents, 700);
});
