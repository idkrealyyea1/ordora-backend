'use strict';

/**
 * THE critical multi-tenant security suite:
 * Restaurant A must NEVER read or mutate Restaurant B data.
 */

process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || '';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startApp } = require('./helpers');

let env;
let ownerCookie;
let A; // restaurant A fixture
let B; // restaurant B fixture
let bOrderId; // an order placed at B

before(async () => {
  env = await startApp();
  await env.createPlatformOwner('root', 'owner-password-123');
  ownerCookie = await env.login('root', 'owner-password-123');

  A = await env.createRestaurantFixture(ownerCookie, { name: 'Alpha Sushi', slug: 'alpha-sushi' });
  B = await env.createRestaurantFixture(ownerCookie, { name: 'Beta Pizza', slug: 'beta-pizza' });

  // Hours are not under test here: bypass the clock so this file passes at any hour.
  for (const f of [A, B]) {
    const r = await env.req('/api/admin/settings', {
      method: 'PATCH', cookie: f.adminCookie, body: { ignoreOpeningHours: true },
    });
    assert.strictEqual(r.status, 200);
  }

  // Place a real order at B through the public API.
  const order = await env.req('/api/restaurants/' + B.slug + '/orders', {
    method: 'POST',
    body: {
      customerName: 'Bob Customer',
      customerWhatsapp: '15550001111',
      orderType: 'pickup',
      items: [{ itemId: B.itemId, quantity: 2 }],
    },
  });
  assert.strictEqual(order.status, 201);
  bOrderId = (await env.query(`SELECT id FROM orders WHERE code = $1`, [order.data.order.code])).rows[0].id;
});

after(async () => {
  if (env) await env.close();
});

test('admin A cannot update menu item of restaurant B', async () => {
  const res = await env.req('/api/admin/items/' + B.itemId, {
    method: 'PATCH',
    cookie: A.adminCookie,
    body: { priceCents: 1 },
  });
  assert.ok(res.status === 404 || res.status === 403, 'expected denial, got ' + res.status);

  const check = await env.query('SELECT price_cents FROM menu_items WHERE id = $1', [B.itemId]);
  assert.strictEqual(check.rows[0].price_cents, 850, 'price unchanged');
});

test('admin A cannot delete category of restaurant B', async () => {
  const res = await env.req('/api/admin/categories/' + B.categoryId, {
    method: 'DELETE', cookie: A.adminCookie,
  });
  assert.ok(res.status === 404 || res.status === 403);
  const still = await env.query('SELECT 1 FROM categories WHERE id = $1', [B.categoryId]);
  assert.strictEqual(still.rowCount, 1);
});

test('admin A cannot read the order placed at restaurant B', async () => {
  const res = await env.req('/api/admin/orders/' + bOrderId, { cookie: A.adminCookie });
  assert.strictEqual(res.status, 404);
});

test('admin A cannot change status of restaurant B order', async () => {
  const res = await env.req('/api/admin/orders/' + bOrderId + '/status', {
    method: 'PATCH', cookie: A.adminCookie, body: { status: 'completed' },
  });
  assert.ok(res.status === 404 || res.status === 403);
  const st = await env.query('SELECT status FROM orders WHERE id = $1', [bOrderId]);
  assert.strictEqual(st.rows[0].status, 'pending', 'status unchanged');
});

test('admin A cannot upload an image onto restaurant B item', async () => {
  const PNG = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c626001000000ffff03000006000557bfabd40000000049454e44ae426082',
    'hex'
  );
  const fd = new FormData();
  fd.append('image', new Blob([PNG], { type: 'image/png' }), 'x.png');
  const res = await env.req('/api/admin/images?type=items&itemId=' + B.itemId, {
    method: 'POST', cookie: A.adminCookie, body: fd,
  });
  assert.ok(res.status === 404 || res.status === 400 || res.status === 403, 'got ' + res.status);
});

test('admin A cannot see restaurant B orders in their list', async () => {
  const res = await env.req('/api/admin/orders?limit=100', { cookie: A.adminCookie });
  assert.strictEqual(res.status, 200);
  const codes = res.data.orders.map((o) => o.code);
  const bCodeRow = await env.query('SELECT code FROM orders WHERE id = $1', [bOrderId]);
  assert.ok(!codes.includes(bCodeRow.rows[0].code), 'B order must not leak into A list');
});

test('restaurant admin cannot use platform-owner endpoints', async () => {
  const res = await env.req('/api/owner/restaurants', { cookie: A.adminCookie });
  assert.strictEqual(res.status, 403);

  const res2 = await env.req('/api/owner/restaurants/' + B.restaurantId, {
    method: 'DELETE', cookie: A.adminCookie,
  });
  assert.strictEqual(res2.status, 403);
});

test('anonymous requests cannot reach protected endpoints', async () => {
  assert.strictEqual((await env.req('/api/admin/dashboard')).status, 401);
  assert.strictEqual((await env.req('/api/owner/restaurants')).status, 401);
  assert.strictEqual((await env.req('/api/admin/orders')).status, 401);
});

test('admin cannot spoof another restaurant via query parameter', async () => {
  const res = await env.req('/api/admin/orders?limit=10&restaurantId=' + B.restaurantId, {
    cookie: A.adminCookie,
  });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.data.total, 0, 'query param ignored — still scoped to own restaurant');
});

test('staff cannot read tenant data via swapped restaurantId (create-only remit)', async () => {
  const staffCookie = await env.createStaffUser('probe-staff', 'staff-password-123');
  const res = await env.req('/api/admin/orders?limit=10&restaurantId=' + A.restaurantId, {
    cookie: staffCookie,
  });
  assert.strictEqual(res.status, 403, 'staff denied tenant reads, got ' + res.status);
});

test('staff cannot read an order by direct ID', async () => {
  const staffCookie = await env.login('probe-staff', 'staff-password-123');
  const res = await env.req('/api/admin/orders/' + bOrderId, { cookie: staffCookie });
  assert.strictEqual(res.status, 403, 'staff denied direct-ID read, got ' + res.status);
});

test('staff without restaurant scope gets no tenant data', async () => {
  const staffCookie = await env.login('probe-staff', 'staff-password-123');
  const res = await env.req('/api/admin/dashboard', { cookie: staffCookie });
  assert.strictEqual(res.status, 403);
});

test('visitor cannot reach tenant data even with restaurantId param', async () => {
  assert.strictEqual(
    (await env.req('/api/admin/orders?restaurantId=' + A.restaurantId)).status,
    401
  );
  assert.strictEqual((await env.req('/api/owner/restaurants')).status, 401);
});

test('delivery API is retired: credential reaches nothing (D4)', async () => {
  const { cookie } = await env.createDeliveryFixture({
    groupName: 'Probe Couriers',
    username: 'probe-courier',
    password: 'delivery-password-123',
  });
  // Legacy rows may still exist, but the delivery API surface is gone.
  const res = await env.req('/api/delivery/orders', { cookie });
  assert.strictEqual(res.status, 404, 'delivery API removed, got ' + res.status);
});

test('delivery credential cannot touch platform or admin endpoints', async () => {
  const ck = await env.login('probe-courier', 'delivery-password-123');
  assert.strictEqual((await env.req('/api/owner/restaurants', { cookie: ck })).status, 403);
  assert.strictEqual((await env.req('/api/admin/dashboard', { cookie: ck })).status, 403);
});

test('owner password reset revokes the target session immediately', async () => {
  const fresh = await env.login(B.adminUsername, B.adminPassword);
  assert.strictEqual((await env.req('/api/admin/dashboard', { cookie: fresh })).status, 200);

  const admins = await env.req('/api/owner/restaurants/' + B.restaurantId, { cookie: ownerCookie });
  const adminUser = admins.data.admins[0];

  const reset = await env.req(`/api/owner/restaurants/${B.restaurantId}/admins/${adminUser.id}/reset-password`, {
    method: 'POST', cookie: ownerCookie, body: { password: 'brand-new-password-99' },
  });
  assert.strictEqual(reset.status, 200);

  const afterReset = await env.req('/api/admin/dashboard', { cookie: fresh });
  assert.strictEqual(afterReset.status, 401, 'old session revoked');

  const relogin = await env.req('/api/auth/login', {
    method: 'POST',
    body: { identifier: B.adminUsername, password: 'brand-new-password-99' },
  });
  assert.strictEqual(relogin.status, 200);
});

test('replaying B\u2019s idempotency key against A\u2019s storefront never resolves B\u2019s order', async () => {
  const key = 'eeeeeeee-ffff-4000-8000-222222222222';
  const atB = await env.req('/api/restaurants/' + B.slug + '/orders', {
    method: 'POST',
    body: {
      customerName: 'Key Owner',
      customerWhatsapp: '15550009999',
      orderType: 'pickup',
      submissionKey: key,
      items: [{ itemId: B.itemId, quantity: 1 }],
    },
  });
  assert.strictEqual(atB.status, 201);

  // Same key, other tenant: must create A's own order (or reject) — never B's row.
  const atA = await env.req('/api/restaurants/' + A.slug + '/orders', {
    method: 'POST',
    body: {
      customerName: 'Key Owner',
      customerWhatsapp: '15550009999',
      orderType: 'pickup',
      submissionKey: key,
      items: [{ itemId: A.itemId, quantity: 1 }],
    },
  });
  assert.strictEqual(atA.status, 201);
  assert.notStrictEqual(atA.data.order.code, atB.data.order.code, 'no cross-tenant key resolution');

  // Admin A listing orders still sees nothing from B.
  const list = await env.req('/api/admin/orders', { cookie: A.adminCookie });
  const codes = (list.data.orders || []).map((o) => o.code);
  assert.ok(!codes.includes(atB.data.order.code), 'A must not see B order codes');
});
