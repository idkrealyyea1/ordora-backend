'use strict';

/** 014 US4: plans drive capabilities; UI and server agree; forgery changes nothing. */

process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || '';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startApp } = require('./helpers');

let env;
let ownerCookie;

function cookieOf(res) {
  const cookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')];
  return cookies.find((c) => c && (c.startsWith('__Host-sid=') || c.startsWith('sid='))).split(';')[0];
}

async function freshBusiness(n, businessType) {
  const s = await env.req('/api/signup', {
    method: 'POST',
    body: {
      email: `ent${n}@example.com`, username: `entowner${n}`, password: 'owner-password-123',
      businessName: `Ent Shop ${n}`, businessType,
    },
  });
  assert.strictEqual(s.status, 201);
  return { id: s.data.business.id, cookie: cookieOf(s) };
}

before(async () => {
  env = await startApp({ authRateMax: 1000 });
  await env.createPlatformOwner('root', 'owner-password-123');
  ownerCookie = await env.login('root', 'owner-password-123');
});

after(async () => {
  if (env) await env.close();
});

test('plan deny flips a capability off server-wide, re-allow restores it', async () => {
  const { id, cookie } = await freshBusiness(1, 'bakery');
  const before = await env.req('/api/onboarding/capabilities', { cookie });
  assert.strictEqual(before.data.capabilities.preorders, true);

  const upd = await env.req('/api/owner/plans/standard', {
    method: 'PATCH', cookie: ownerCookie, body: { entitlements: { preorders: false } },
  });
  assert.strictEqual(upd.status, 200);
  assert.strictEqual(upd.data.capabilities.preorders, false);

  const after = await env.req('/api/onboarding/capabilities', { cookie });
  assert.strictEqual(after.data.capabilities.preorders, false, 'no stale grant');

  // Restore for the rest of the suite.
  await env.req('/api/owner/plans/standard', {
    method: 'PATCH', cookie: ownerCookie, body: { entitlements: { preorders: true } },
  });
  const restored = await env.req('/api/onboarding/capabilities', { cookie });
  assert.strictEqual(restored.data.capabilities.preorders, true, 'no stale denial');
  assert.ok(id);
});

test('numeric plan limit overrides honestly and creation enforces it', async () => {
  const { cookie } = await freshBusiness(2, 'cafe');
  const cat = await env.req('/api/admin/categories', { method: 'POST', cookie, body: { name: 'Drinks' } });
  await env.req('/api/owner/plans/standard', {
    method: 'PATCH', cookie: ownerCookie, body: { entitlements: { max_menu_items: 1 } },
  });
  const caps = await env.req('/api/onboarding/capabilities', { cookie });
  assert.strictEqual(caps.data.limits.maxMenuItems, 1);

  const first = await env.req('/api/admin/items', {
    method: 'POST', cookie,
    body: { categoryId: cat.data.category.id, name: 'Tea', priceCents: 200 },
  });
  assert.strictEqual(first.status, 201);
  // Business row still says 30 — the plan limit governs, not the row.
  const second = await env.req('/api/admin/items', {
    method: 'POST', cookie,
    body: { categoryId: cat.data.category.id, name: 'Coffee', priceCents: 300 },
  });
  assert.strictEqual(second.status, 409);

  await env.req('/api/owner/plans/standard', {
    method: 'PATCH', cookie: ownerCookie, body: { entitlements: { max_menu_items: 10000 } },
  });
});

test('missing subscription row fails closed with a clear code', async () => {
  const { id, cookie } = await freshBusiness(3, 'restaurant');
  await env.query('DELETE FROM subscriptions WHERE restaurant_id = $1', [id]);
  const res = await env.req('/api/onboarding/capabilities', { cookie });
  assert.strictEqual(res.status, 404);
});
