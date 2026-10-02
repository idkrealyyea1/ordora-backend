'use strict';

/** 014 US1: exactly one server-timed trial per new business; deterministic expiry. */

process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || '';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startApp } = require('./helpers');

let env;

function cookieOf(res) {
  const cookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')];
  return cookies.find((c) => c && (c.startsWith('__Host-sid=') || c.startsWith('sid='))).split(';')[0];
}

const signupAs = (n) => ({
  email: `trial${n}@example.com`,
  username: `trialowner${n}`,
  password: 'owner-password-123',
  businessName: `Trial Shop ${n}`,
  businessType: 'bakery',
});

before(async () => {
  env = await startApp({ authRateMax: 1000 });
});

after(async () => {
  if (env) await env.close();
});

test('signup attaches exactly one trial with correct dates and plan', async () => {
  const s = await env.req('/api/signup', { method: 'POST', body: signupAs(1) });
  assert.strictEqual(s.status, 201);
  const cookie = cookieOf(s);
  const st = await env.req('/api/onboarding/subscription', { cookie });
  assert.strictEqual(st.status, 200);
  assert.strictEqual(st.data.state, 'trial');
  assert.strictEqual(st.data.plan.key, 'standard');
  const end = new Date(st.data.trialEndsAt).getTime();
  assert.ok(end > Date.now() + 6 * 24 * 3600 * 1000 && end <= Date.now() + 8 * 24 * 3600 * 1000);
  assert.ok(st.data.daysLeft >= 6 && st.data.daysLeft <= 7);
  assert.ok(st.data.messageKey);
});

test('resume/retry creates no second subscription row', async () => {
  const s = await env.req('/api/signup', { method: 'POST', body: signupAs(2) });
  const cookie = cookieOf(s);
  await env.req('/api/onboarding/state', { method: 'PUT', cookie, body: { step: 'product' } });
  const again = await env.req('/api/onboarding/subscription', { cookie });
  assert.strictEqual(again.data.state, 'trial');
  // Second business from the same account is refused outright (1:1 rule).
  const dup = await env.req('/api/signup', {
    method: 'POST', cookie,
    body: { ...signupAs(3), email: 'trial3b@example.com', username: 'trialowner3b' },
  });
  assert.strictEqual(dup.status, 403);
});

test('derivation walks trial → grace → expired; ordering stops, data stays', async () => {
  const s = await env.req('/api/signup', { method: 'POST', body: signupAs(4) });
  assert.strictEqual(s.status, 201);
  const slug = s.data.business.slug;
  const cookie = cookieOf(s);
  const cat = await env.req('/api/admin/categories', { method: 'POST', cookie, body: { name: 'Breads' } });
  const item = await env.req('/api/admin/items', {
    method: 'POST', cookie,
    body: { categoryId: cat.data.category.id, name: 'Loaf', priceCents: 400 },
  });
  const itemId = item.data.item.id;

  // Test-only clock travel: move the period end into the past, inside grace.
  await env.query(
    `UPDATE subscriptions SET current_period_end = now() - INTERVAL '1 day',
       grace_until = now() + INTERVAL '6 days'
     WHERE restaurant_id = (SELECT restaurant_id FROM users WHERE username = 'trialowner4')`
  );
  const grace = await env.req('/api/onboarding/subscription', { cookie });
  assert.strictEqual(grace.data.state, 'grace');
  const graceOrder = await env.req(`/api/restaurants/${slug}/orders`, {
    method: 'POST',
    body: { customerName: 'G', customerWhatsapp: '+15551234567', orderType: 'pickup', items: [{ itemId, quantity: 1 }] },
  });
  assert.strictEqual(graceOrder.status, 201, 'grace keeps ordering');

  // Past grace: expired — ordering blocked, reads and data intact.
  await env.query(
    `UPDATE subscriptions SET current_period_end = now() - INTERVAL '10 days',
       grace_until = now() - INTERVAL '1 day'
     WHERE restaurant_id = (SELECT restaurant_id FROM users WHERE username = 'trialowner4')`
  );
  const expired = await env.req('/api/onboarding/subscription', { cookie });
  assert.strictEqual(expired.data.state, 'expired');
  const blocked = await env.req(`/api/restaurants/${slug}/orders`, {
    method: 'POST',
    body: { customerName: 'G', customerWhatsapp: '+15551234567', orderType: 'pickup', items: [{ itemId, quantity: 1 }] },
  });
  assert.strictEqual(blocked.status, 403);
  const dash = await env.req('/api/admin/dashboard', { cookie });
  assert.strictEqual(dash.status, 200, 'dashboard reads stay reachable');
  const items = await env.req('/api/admin/items', { cookie });
  assert.ok(items.data.items.some((i) => i.name === 'Loaf'), 'menu data intact');
});
