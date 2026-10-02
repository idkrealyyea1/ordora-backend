'use strict';

/** 013 US1: full wizard journey — signup to orderable storefront, SSE intact. */

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

before(async () => {
  env = await startApp({ authRateMax: 1000 });
});

after(async () => {
  if (env) await env.close();
});

test('restaurant journey: signup → product → fulfillment → hours → complete → guest order', async () => {
  const signup = await env.req('/api/signup', {
    method: 'POST',
    body: {
      email: 'journey@example.com', username: 'journeyowner', password: 'owner-password-123',
      businessName: 'Journey Diner', businessType: 'restaurant',
    },
  });
  assert.strictEqual(signup.status, 201);
  const cookie = cookieOf(signup);
  const slug = signup.data.business.slug;

  const cat = await env.req('/api/admin/categories', { method: 'POST', cookie, body: { name: 'Mains' } });
  assert.strictEqual(cat.status, 201);
  const item = await env.req('/api/admin/items', {
    method: 'POST', cookie,
    body: { categoryId: cat.data.category.id, name: 'Burger', priceCents: 850 },
  });
  assert.strictEqual(item.status, 201);

  const settings = await env.req('/api/admin/settings', { method: 'PATCH', cookie, body: { deliveryEnabled: false } });
  assert.strictEqual(settings.status, 200);
  const hours = await env.req('/api/admin/hours', { method: 'PUT', cookie, body: { hours: hours7() } });
  assert.strictEqual(hours.status, 200);

  for (const step of ['setup', 'product', 'fulfillment', 'hours', 'review']) {
    const put = await env.req('/api/onboarding/state', { method: 'PUT', cookie, body: { step } });
    assert.strictEqual(put.status, 200);
  }
  const done = await env.req('/api/onboarding/complete', { method: 'POST', cookie });
  assert.strictEqual(done.status, 200);
  assert.strictEqual(done.data.storefrontUrl, `/restaurant/${slug}`);
  assert.ok(done.data.dashboardUrl);
  assert.ok(done.data.share.qrUrl);

  // Storefront serves the product to guests.
  const menu = await env.req(`/api/restaurants/${slug}/menu`);
  assert.strictEqual(menu.status, 200);
  assert.ok(menu.data.items.some((i) => i.name === 'Burger'));

  // Guest checkout works (existing non-online-payment model).
  const order = await env.req(`/api/restaurants/${slug}/orders`, {
    method: 'POST',
    body: {
      customerName: 'Guest', customerWhatsapp: '+15551234567', orderType: 'pickup',
      items: [{ itemId: item.data.item.id, quantity: 1 }],
    },
  });
  assert.strictEqual(order.status, 201);

  // Owner dashboard still reachable after completion.
  const dash = await env.req('/api/admin/dashboard', { cookie });
  assert.strictEqual(dash.status, 200);
});

test('fresh signup cannot complete before reaching review', async () => {
  const signup = await env.req('/api/signup', {
    method: 'POST',
    body: {
      email: 'early@example.com', username: 'earlyowner', password: 'owner-password-123',
      businessName: 'Early Bird', businessType: 'cafe',
    },
  });
  const cookie = cookieOf(signup);
  const done = await env.req('/api/onboarding/complete', { method: 'POST', cookie });
  assert.strictEqual(done.status, 409);
  assert.strictEqual(done.data.error.code, 'INCOMPLETE_SETUP');
  assert.ok(Array.isArray(done.data.error.details.missing) && done.data.error.details.missing.length > 0);
});
