'use strict';

/** 013 US3: interrupted onboarding resumes; abandonment is safe, never deleted. */

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

test('dropping off mid-wizard resumes with data intact and no duplicate business', async () => {
  const signup = await env.req('/api/signup', {
    method: 'POST',
    body: {
      email: 'resume@example.com', username: 'resumeowner', password: 'owner-password-123',
      businessName: 'Resume Kitchen', businessType: 'home_kitchen',
    },
  });
  assert.strictEqual(signup.status, 201);
  const slug = signup.data.business.slug;

  // Do two steps, then "close the browser" (drop the cookie).
  let cookie = cookieOf(signup);
  const cat = await env.req('/api/admin/categories', { method: 'POST', cookie, body: { name: 'Daily' } });
  assert.strictEqual(cat.status, 201);
  const put = await env.req('/api/onboarding/state', { method: 'PUT', cookie, body: { step: 'product' } });
  assert.strictEqual(put.status, 200);
  assert.strictEqual(put.data.onboardingStep, 'product');

  // Sign back in: exactly the same business, prior data intact.
  cookie = await env.login('resumeowner', 'owner-password-123');
  const state = await env.req('/api/onboarding/state', { cookie });
  assert.strictEqual(state.status, 200);
  assert.strictEqual(state.data.business.slug, slug);
  assert.strictEqual(state.data.onboardingStep, 'product');
  assert.deepStrictEqual(state.data.next, ['fulfillment', 'hours', 'review']);
  assert.ok(state.data.completeness > 0 && state.data.completeness < 100);
  const cats = await env.req('/api/admin/categories', { cookie });
  assert.ok(cats.data.categories.some((c) => c.name === 'Daily'));

  // Finish from the resumed session; still exactly one tenant.
  await env.req('/api/admin/settings', { method: 'PATCH', cookie, body: { deliveryEnabled: true } });
  await env.req('/api/admin/hours', { method: 'PUT', cookie, body: { hours: hours7() } });
  for (const step of ['fulfillment', 'hours', 'review']) {
    await env.req('/api/onboarding/state', { method: 'PUT', cookie, body: { step } });
  }
  const done = await env.req('/api/onboarding/complete', { method: 'POST', cookie });
  assert.strictEqual(done.status, 200);
  const again = await env.req('/api/onboarding/complete', { method: 'POST', cookie });
  assert.strictEqual(again.status, 200, 'double complete is idempotent');
});

test('abandoned setups persist and stay resumable; invalid steps rejected', async () => {
  const signup = await env.req('/api/signup', {
    method: 'POST',
    body: {
      email: 'abandon@example.com', username: 'abandonowner', password: 'owner-password-123',
      businessName: 'Abandoned Oven', businessType: 'cafe',
    },
  });
  assert.strictEqual(signup.status, 201);
  // No auto-delete: state is still there with zero progress.
  const cookie = await env.login('abandonowner', 'owner-password-123');
  const state = await env.req('/api/onboarding/state', { cookie });
  assert.strictEqual(state.data.onboardingStatus, 'in_progress');
  assert.deepStrictEqual(state.data.next, ['setup', 'product', 'fulfillment', 'hours', 'review']);

  const bad = await env.req('/api/onboarding/state', { method: 'PUT', cookie, body: { step: 'launch' } });
  assert.strictEqual(bad.status, 400);
  const done = await env.req('/api/onboarding/state', { method: 'PUT', cookie, body: { step: 'done' } });
  assert.strictEqual(done.status, 400);
  const anon = await env.req('/api/onboarding/state');
  assert.strictEqual(anon.status, 401);
});
