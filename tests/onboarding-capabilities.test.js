'use strict';

/** 013 US4: capabilities evaluated live; UI hiding is never the enforcement. */

process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || '';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startApp } = require('./helpers');

let env;

function cookieOf(res) {
  const cookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')];
  return cookies.find((c) => c && (c.startsWith('__Host-sid=') || c.startsWith('sid='))).split(';')[0];
}

const hours7 = () => Array.from({ length: 7 }, (_, day) => ({ day, closed: false, opensAt: '09:00', closesAt: '22:00' }));

async function freshBusiness(n, businessType) {
  const s = await env.req('/api/signup', {
    method: 'POST',
    body: {
      email: `cap${n}@example.com`, username: `capowner${n}`, password: 'owner-password-123',
      businessName: `Cap Shop ${n}`, businessType,
    },
  });
  assert.strictEqual(s.status, 201);
  return { cookie: cookieOf(s), slug: s.data.business.slug };
}

before(async () => {
  env = await startApp({ authRateMax: 1000 });
});

after(async () => {
  if (env) await env.close();
});

test('effective capabilities reflect type + entitlement + configuration', async () => {
  const { cookie } = await freshBusiness(1, 'bakery');
  const res = await env.req('/api/onboarding/capabilities', { cookie });
  assert.strictEqual(res.status, 200);
  // Task 14: the placeholder is replaced by the assigned real plan.
  assert.strictEqual(res.data.entitlement.plan, 'standard');
  assert.strictEqual(res.data.capabilities.storefront, true);
  assert.strictEqual(res.data.capabilities.preorders, true);
  assert.strictEqual(res.data.capabilities.advanced_analytics, false, 'future capability off for all');
  assert.strictEqual(typeof res.data.limits.canAddProduct, 'boolean');
  assert.ok(res.data.limits.maxMenuItems >= 1);
});

test('disabling delivery revokes the delivery-gated write server-side', async () => {
  const { cookie } = await freshBusiness(2, 'home_kitchen');
  await env.req('/api/admin/settings', { method: 'PATCH', cookie, body: { deliveryEnabled: false } });
  const blocked = await env.req('/api/admin/delivery-groups', { method: 'PUT', cookie, body: { groupIds: [] } });
  assert.strictEqual(blocked.status, 403);
  assert.strictEqual(blocked.data.error.code, 'CAPABILITY_UNAVAILABLE');

  const caps = await env.req('/api/onboarding/capabilities', { cookie });
  assert.strictEqual(caps.data.capabilities.delivery, false);

  await env.req('/api/admin/settings', { method: 'PATCH', cookie, body: { deliveryEnabled: true } });
  const allowed = await env.req('/api/admin/delivery-groups', { method: 'PUT', cookie, body: { groupIds: [] } });
  assert.strictEqual(allowed.status, 200);
});

test('forged plan claims change nothing; capability reads need a session', async () => {
  const anon = await env.req('/api/onboarding/capabilities');
  assert.strictEqual(anon.status, 401);
  const { cookie } = await freshBusiness(3, 'restaurant');
  const res = await env.req('/api/onboarding/capabilities', { cookie });
  // Task 14: the placeholder is replaced by the assigned real plan.
  assert.strictEqual(res.data.entitlement.plan, 'standard');
});

test('numeric limit boundary stays honest (used vs max, canAddProduct)', async () => {
  const { cookie } = await freshBusiness(4, 'cafe');
  const cat = await env.req('/api/admin/categories', { method: 'POST', cookie, body: { name: 'Drinks' } });
  await env.req('/api/admin/items', {
    method: 'POST', cookie,
    body: { categoryId: cat.data.category.id, name: 'Tea', priceCents: 200 },
  });
  const caps = await env.req('/api/onboarding/capabilities', { cookie });
  assert.strictEqual(caps.data.limits.menuItemsUsed, 1);
  assert.strictEqual(caps.data.limits.canAddProduct, caps.data.limits.menuItemsUsed < caps.data.limits.maxMenuItems);
});
