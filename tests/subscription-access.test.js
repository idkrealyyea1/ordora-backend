'use strict';

/** 014 US5: per-surface access matrix — grace works, expired degrades, nothing deleted. */

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

let slug;
let adminCookie;
let itemId;

before(async () => {
  env = await startApp({ authRateMax: 1000 });
  await env.createPlatformOwner('root', 'owner-password-123');
  ownerCookie = await env.login('root', 'owner-password-123');
  const s = await env.req('/api/signup', {
    method: 'POST',
    body: {
      email: 'stage@example.com', username: 'stageowner', password: 'owner-password-123',
      businessName: 'Stage Bistro', businessType: 'restaurant',
    },
  });
  slug = s.data.business.slug;
  adminCookie = cookieOf(s);
  const cat = await env.req('/api/admin/categories', { method: 'POST', cookie: adminCookie, body: { name: 'Mains' } });
  const item = await env.req('/api/admin/items', {
    method: 'POST', cookie: adminCookie,
    body: { categoryId: cat.data.category.id, name: 'Stew', priceCents: 900 },
  });
  itemId = item.data.item.id;
});

after(async () => {
  if (env) await env.close();
});

const order = () => ({
  customerName: 'Pat', customerWhatsapp: '+15551234567', orderType: 'pickup',
  items: [{ itemId, quantity: 1 }],
});

async function setDates(periodEnd, graceUntil) {
  await env.query(
    `UPDATE subscriptions SET current_period_end = $1, grace_until = $2
     WHERE restaurant_id = (SELECT restaurant_id FROM users WHERE username = 'stageowner')`,
    [periodEnd, graceUntil]
  );
}

test('grace: storefront, ordering, and dashboard all work', async () => {
  await setDates(new Date(Date.now() - 864e5).toISOString(), new Date(Date.now() + 6 * 864e5).toISOString());
  const menu = await env.req(`/api/restaurants/${slug}/menu`);
  assert.strictEqual(menu.status, 200);
  assert.strictEqual(menu.data.orderingBlocked || false, false);
  const o = await env.req(`/api/restaurants/${slug}/orders`, { method: 'POST', body: order() });
  assert.strictEqual(o.status, 201);
  const dash = await env.req('/api/admin/dashboard', { cookie: adminCookie });
  assert.strictEqual(dash.status, 200);
  assert.strictEqual(dash.data.subscription.state, 'grace');
});

test('expired: menu visible with ordering disabled, tracking works, data intact', async () => {
  await setDates(new Date(Date.now() - 10 * 864e5).toISOString(), new Date(Date.now() - 864e5).toISOString());
  const menu = await env.req(`/api/restaurants/${slug}/menu`);
  assert.strictEqual(menu.status, 200, 'expired storefront stays visible (no 404)');
  assert.strictEqual(menu.data.orderingBlocked, true);
  assert.ok(menu.data.noticeKey, 'customer notice key present');
  assert.ok(menu.data.items.some((i) => i.name === 'Stew'), 'menu data intact');

  const blocked = await env.req(`/api/restaurants/${slug}/orders`, { method: 'POST', body: order() });
  assert.strictEqual(blocked.status, 403);

  const dash = await env.req('/api/admin/dashboard', { cookie: adminCookie });
  assert.strictEqual(dash.status, 200, 'dashboard reads reachable');
  assert.strictEqual(dash.data.subscription.state, 'expired');
  const mut = await env.req('/api/admin/categories', { method: 'POST', cookie: adminCookie, body: { name: 'Nope' } });
  assert.strictEqual(mut.status, 403, 'management writes blocked');
});

test('suspended: controlled notice, ordering blocked, owner still authenticates', async () => {
  const id = (await env.req('/api/owner/restaurants', { cookie: ownerCookie })).data;
  const target = id.restaurants.find((r) => r.slug === slug).id;
  await env.req(`/api/owner/restaurants/${target}/subscription/suspend`, {
    method: 'POST', cookie: ownerCookie, body: { reason: 'abuse review' },
  });
  const menu = await env.req(`/api/restaurants/${slug}/menu`);
  assert.strictEqual(menu.status, 200);
  assert.strictEqual(menu.data.orderingBlocked, true);
  assert.strictEqual(menu.data.noticeKey, 'sub_store_suspended');

  // Owner identity still works; recovery guidance is served, not a dead end.
  const login = await env.req('/api/auth/login', { method: 'POST', body: { identifier: 'stageowner', password: 'owner-password-123' } });
  assert.strictEqual(login.status, 200);
  const dash = await env.req('/api/admin/dashboard', { cookie: adminCookie });
  assert.strictEqual(dash.status, 200);

  await env.req(`/api/owner/restaurants/${target}/subscription/reactivate`, {
    method: 'POST', cookie: ownerCookie, body: { reason: 'cleared' },
  });
});
