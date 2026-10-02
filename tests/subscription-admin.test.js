'use strict';

/** 014 US2: platform-admin lifecycle management with full audit; owners locked out. */

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

async function ownerBusiness(n) {
  const s = await env.req('/api/signup', {
    method: 'POST',
    body: {
      email: `adm${n}@example.com`, username: `admowner${n}`, password: 'owner-password-123',
      businessName: `Admin Shop ${n}`, businessType: 'restaurant',
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

test('plans are data-driven: list, create, edit, unknown keys rejected', async () => {
  const list = await env.req('/api/owner/plans', { cookie: ownerCookie });
  assert.strictEqual(list.status, 200);
  assert.ok(list.data.plans.some((p) => p.key === 'standard'));
  const std = list.data.plans.find((p) => p.key === 'standard');
  assert.strictEqual(std.priceCents, 1999);
  assert.strictEqual(std.capabilities.advanced_analytics, false);

  const bad = await env.req('/api/owner/plans', {
    method: 'POST', cookie: ownerCookie,
    body: { key: 'plus', name: 'Plus', priceCents: 2900, currency: 'USD', period: 'month', entitlements: { teleport: true } },
  });
  assert.strictEqual(bad.status, 400, 'unknown capability keys rejected');

  const created = await env.req('/api/owner/plans', {
    method: 'POST', cookie: ownerCookie,
    body: { key: 'plus', name: 'Plus', priceCents: 2900, currency: 'USD', period: 'month', entitlements: { preorders: false } },
  });
  assert.strictEqual(created.status, 201);
  assert.strictEqual(created.data.capabilities.preorders, false);
});

test('activate → extend (no lost days) → suspend → reactivate, all audited', async () => {
  const { id, cookie } = await ownerBusiness(10);
  const end = new Date(Date.now() + 30 * 864e5).toISOString();
  const act = await env.req(`/api/owner/restaurants/${id}/subscription/activate`, {
    method: 'POST', cookie: ownerCookie, body: { planKey: 'standard', periodEndsAt: end, reason: 'bank transfer #1' },
  });
  assert.strictEqual(act.status, 200);

  const ext = await env.req(`/api/owner/restaurants/${id}/subscription/extend`, {
    method: 'POST', cookie: ownerCookie, body: { extendDays: 30, reason: 'second payment' },
  });
  assert.strictEqual(ext.status, 200);
  assert.ok(new Date(ext.data.current_period_end).getTime() > new Date(end).getTime() + 29 * 864e5,
    'extends from current end, not from now');

  const sus = await env.req(`/api/owner/restaurants/${id}/subscription/suspend`, {
    method: 'POST', cookie: ownerCookie, body: { reason: 'chargeback review' },
  });
  assert.strictEqual(sus.status, 200);
  const blocked = await env.req('/api/admin/items', { method: 'POST', cookie, body: {} });
  assert.strictEqual(blocked.status, 403, 'suspended mutations blocked');

  const rea = await env.req(`/api/owner/restaurants/${id}/subscription/reactivate`, {
    method: 'POST', cookie: ownerCookie, body: { reason: 'review cleared' },
  });
  assert.strictEqual(rea.status, 200);

  const events = await env.req(`/api/owner/restaurants/${id}/subscription/events`, { cookie: ownerCookie });
  assert.strictEqual(events.status, 200);
  assert.ok(events.data.events.length >= 3);
  const e0 = events.data.events[0];
  assert.ok(e0.actor && e0.action && e0.at, 'audit carries actor/action/timestamp');
  assert.ok('reason' in e0, 'audit carries reason');
});

test('end-of-period cancel stays active until then; immediate cancel does not', async () => {
  const { id } = await ownerBusiness(11);
  const end = new Date(Date.now() + 30 * 864e5).toISOString();
  await env.req(`/api/owner/restaurants/${id}/subscription/activate`, {
    method: 'POST', cookie: ownerCookie, body: { planKey: 'standard', periodEndsAt: end },
  });
  const cancel = await env.req(`/api/owner/restaurants/${id}/subscription/cancel`, {
    method: 'POST', cookie: ownerCookie, body: { effective: 'period_end', reason: 'owner asked' },
  });
  assert.strictEqual(cancel.status, 200);
  const st = await env.req(`/api/owner/restaurants/${id}/subscription`, { cookie: ownerCookie });
  assert.strictEqual(st.data.state, 'active', 'paid-through access continues');

  const { id: id2 } = await ownerBusiness(12);
  await env.req(`/api/owner/restaurants/${id2}/subscription/activate`, {
    method: 'POST', cookie: ownerCookie, body: { planKey: 'standard', periodEndsAt: end },
  });
  await env.req(`/api/owner/restaurants/${id2}/subscription/cancel`, {
    method: 'POST', cookie: ownerCookie, body: { effective: 'now', reason: 'fraud' },
  });
  const st2 = await env.req(`/api/owner/restaurants/${id2}/subscription`, { cookie: ownerCookie });
  assert.strictEqual(st2.data.state, 'cancelled');
});

test('invalid transitions rejected; owners and strangers locked out', async () => {
  const { id, cookie } = await ownerBusiness(13);
  const bad = await env.req(`/api/owner/restaurants/${id}/subscription/extend`, {
    method: 'POST', cookie: ownerCookie, body: { reason: 'x' },
  });
  assert.strictEqual(bad.status, 400, 'extend needs exactly one of extendDays/newEndsAt');

  const selfServe = await env.req(`/api/owner/restaurants/${id}/subscription/activate`, {
    method: 'POST', cookie, body: { planKey: 'standard' },
  });
  assert.strictEqual(selfServe.status, 403, 'restaurant owners cannot touch subscriptions');

  const forged = await env.req(`/api/owner/restaurants/${id}/subscription/activate`, {
    method: 'POST', cookie: ownerCookie, body: { planKey: 'standard', subscriptionEndsAt: new Date(Date.now() + 999 * 864e5).toISOString() },
  });
  assert.ok([400, 200].includes(forged.status));
  if (forged.status === 200) {
    const st = await env.req(`/api/owner/restaurants/${id}/subscription`, { cookie: ownerCookie });
    assert.notStrictEqual(new Date(st.data.periodEndsAt).getFullYear(), new Date().getFullYear() + 2,
      'client-sent expiry never honored');
  }

  const other = await env.req('/api/owner/restaurants/11111111-1111-4111-8111-111111111111/subscription', { cookie: ownerCookie });
  assert.strictEqual(other.status, 404);
});
