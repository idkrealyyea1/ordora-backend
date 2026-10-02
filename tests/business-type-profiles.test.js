'use strict';

/** 013 US2: centralized business-type profiles drive the wizard, not branches. */

process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || '';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startApp } = require('./helpers');

let env;
let profileOf;

function cookieOf(res) {
  const cookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')];
  return cookies.find((c) => c && (c.startsWith('__Host-sid=') || c.startsWith('sid='))).split(';')[0];
}

const signupAs = (n, businessType) => ({
  email: `bt${n}@example.com`,
  username: `btowner${n}`,
  password: 'owner-password-123',
  businessName: `BT Shop ${n}`,
  businessType,
});

before(async () => {
  env = await startApp({ authRateMax: 1000 });
  const probe = await env.req('/api/signup', { method: 'POST', body: signupAs(1, 'bakery') });
  assert.strictEqual(probe.status, 201);
  profileOf = async (payload) => {
    const s = await env.req('/api/signup', { method: 'POST', body: payload });
    assert.strictEqual(s.status, 201);
    const p = await env.req('/api/onboarding/profile', { cookie: cookieOf(s) });
    assert.strictEqual(p.status, 200);
    return p.data;
  };
});

after(async () => {
  if (env) await env.close();
});

test('public chooser lists six named types plus other, no entitlement data', async () => {
  const res = await env.req('/api/business-types');
  assert.strictEqual(res.status, 200);
  const keys = res.data.types.map((t) => t.key);
  for (const k of ['restaurant', 'cafe', 'bakery', 'dessert_shop', 'home_kitchen', 'cloud_kitchen', 'other']) {
    assert.ok(keys.includes(k), k + ' listed');
  }
  assert.ok(res.data.types.every((t) => t.nameKey && t.icon));
  assert.ok(!('capabilities' in res.data) && !('plan' in res.data));
});

test('profiles differ meaningfully per type on the shared platform', async () => {
  const bakery = await profileOf(signupAs(10, 'bakery'));
  const home = await profileOf(signupAs(11, 'home_kitchen'));
  const cloud = await profileOf(signupAs(12, 'cloud_kitchen'));
  const cafe = await profileOf(signupAs(13, 'cafe'));
  assert.strictEqual(bakery.businessType, 'bakery');
  assert.ok(bakery.relevantCaps.includes('preorders'), 'bakery surfaces pre-orders');
  assert.strictEqual(cloud.defaults.fulfillment, 'delivery', 'cloud kitchen delivery-first');
  assert.strictEqual(cafe.defaults.fulfillment, 'pickup', 'cafe pickup-first');
  assert.notDeepStrictEqual(bakery.dashboardEmphasis, home.dashboardEmphasis, 'emphasis differs');
  assert.notStrictEqual(bakery.terminology.productLabelKey, cafe.terminology.productLabelKey, 'terminology differs');
});

test('other maps to the generic bucket with a safe generic profile', async () => {
  const other = await profileOf(signupAs(20, 'other'));
  assert.strictEqual(other.businessType, 'small_food_business');
  assert.ok(Array.isArray(other.flow) && other.flow.includes('review'));
});

test('profile reads are tenant-scoped; strangers need a session', async () => {
  const anon = await env.req('/api/onboarding/profile');
  assert.strictEqual(anon.status, 401);
});
