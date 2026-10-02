'use strict';

/** 013 US1: public self-service signup — account + tenant created atomically. */

process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || '';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startApp } = require('./helpers');

let env;

function cookieOf(res) {
  const cookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')];
  const sessionCookie = cookies.find((c) => c && (c.startsWith('__Host-sid=') || c.startsWith('sid=')));
  assert.ok(sessionCookie, 'signup sets a session cookie');
  return sessionCookie.split(';')[0];
}

const newAccount = (n) => ({
  email: `owner${n}@example.com`,
  username: `owner${n}`,
  password: 'owner-password-123',
  businessName: `Test Kitchen ${n}`,
  businessType: 'restaurant',
});

before(async () => {
  env = await startApp({ authRateMax: 1000 });
});

after(async () => {
  if (env) await env.close();
});

test('successful signup creates account + tenant and signs in', async () => {
  const res = await env.req('/api/signup', { method: 'POST', body: newAccount(1) });
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.data.user.role, 'admin');
  assert.strictEqual(res.data.business.slug, 'test-kitchen-1');
  assert.strictEqual(res.data.business.businessType, 'restaurant');
  assert.strictEqual(res.data.business.onboardingStatus, 'in_progress');
  assert.strictEqual(res.data.business.onboardingStep, 'info');
  assert.ok(!('password_hash' in (res.data.user || {})));
  const endsAt = new Date(res.data.trialEndsAt).getTime();
  assert.ok(endsAt > Date.now() + 6 * 24 * 3600 * 1000 && endsAt <= Date.now() + 8 * 24 * 3600 * 1000);

  // Session works: onboarding state is reachable.
  const cookie = cookieOf(res);
  const state = await env.req('/api/onboarding/state', { cookie });
  assert.strictEqual(state.status, 200);
  assert.strictEqual(state.data.business.slug, 'test-kitchen-1');
});

test('duplicate email is refused safely with no partial rows', async () => {
  const dup = await env.req('/api/signup', { method: 'POST', body: { ...newAccount(2), email: 'owner1@example.com' } });
  assert.strictEqual(dup.status, 409);
  assert.strictEqual(dup.data.error.code, 'DUPLICATE');
  // The colliding account cannot sign in (nothing half-created for it).
  const login = await env.req('/api/auth/login', { method: 'POST', body: { identifier: 'owner2', password: 'owner-password-123' } });
  assert.strictEqual(login.status, 401);
});

test('invalid business type, reserved slug, and short password are rejected', async () => {
  const badType = await env.req('/api/signup', { method: 'POST', body: { ...newAccount(3), businessType: 'nightclub' } });
  assert.strictEqual(badType.status, 400);
  const reserved = await env.req('/api/signup', { method: 'POST', body: { ...newAccount(4), slug: 'admin' } });
  assert.strictEqual(reserved.status, 400);
  const weak = await env.req('/api/signup', { method: 'POST', body: { ...newAccount(5), password: 'short' } });
  assert.strictEqual(weak.status, 400);
});

test('slug collision resolves to a free numeric variant', async () => {
  const a = await env.req('/api/signup', { method: 'POST', body: { ...newAccount(6), businessName: 'Dupe Diner', slug: 'dupe-diner' } });
  assert.strictEqual(a.status, 201);
  assert.strictEqual(a.data.business.slug, 'dupe-diner');
  const b = await env.req('/api/signup', { method: 'POST', body: { ...newAccount(7), businessName: 'Dupe Diner', slug: 'dupe-diner' } });
  assert.strictEqual(b.status, 201);
  assert.strictEqual(b.data.business.slug, 'dupe-diner-2');
});

test('other maps to the generic stored bucket; raw stored-only values rejected', async () => {
  const res = await env.req('/api/signup', { method: 'POST', body: { ...newAccount(8), businessType: 'other' } });
  assert.strictEqual(res.status, 201);
  const raw = await env.req('/api/signup', { method: 'POST', body: { ...newAccount(9), businessType: 'small_food_business' } });
  assert.strictEqual(raw.status, 400);
});

test('an account that already owns a business cannot create a second one', async () => {
  const first = await env.req('/api/signup', { method: 'POST', body: newAccount(10) });
  assert.strictEqual(first.status, 201);
  const cookie = cookieOf(first);
  const second = await env.req('/api/signup', {
    method: 'POST', cookie, body: { ...newAccount(11), email: 'owner11b@example.com', username: 'owner11b' },
  });
  assert.strictEqual(second.status, 403);
  assert.strictEqual(second.data.error.code, 'BUSINESS_ALREADY_EXISTS');
});

test('client-sent plan/capability/tenant claims are rejected, never honored', async () => {
  const forgeries = [{ plan: 'pro' }, { capabilities: ['everything'] }, { restaurant_id: 'x' }, { role: 'owner' }];
  for (let i = 0; i < forgeries.length; i++) {
    const res = await env.req('/api/signup', { method: 'POST', body: { ...newAccount(20 + i), ...forgeries[i] } });
    assert.strictEqual(res.status, 400);
  }
});

test('slug availability reports free, taken with suggestion, and invalid', async () => {
  const free = await env.req('/api/signup/slug-availability?name=Fresh Falafel House');
  assert.deepStrictEqual([free.status, free.data.available], [200, true]);
  const taken = await env.req('/api/signup/slug-availability?slug=dupe-diner');
  assert.strictEqual(taken.status, 200);
  assert.strictEqual(taken.data.available, false);
  assert.ok(taken.data.suggestion && taken.data.suggestion !== 'dupe-diner');
  const invalid = await env.req('/api/signup/slug-availability?slug=admin');
  assert.strictEqual(invalid.status, 400);
});
