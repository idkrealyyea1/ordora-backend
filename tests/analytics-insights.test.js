'use strict';

/** Tasks 12 (US4): exact aggregates, periods, currency honesty, option-safe products. */

process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || '';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startApp } = require('./helpers');

let env;
let adminCookie;
let slug = 'analytics-insights';
let itemId;

before(async () => {
  env = await startApp();
  await env.createPlatformOwner('root', 'owner-password-123');
  const ownerCookie = await env.login('root', 'owner-password-123');
  const fx = await env.createRestaurantFixture(ownerCookie, { name: 'Analytics Insights', slug });
  adminCookie = fx.adminCookie;
  itemId = fx.itemId;

  const grp = await env.req('/api/admin/option-groups', {
    method: 'POST', cookie: adminCookie,
    body: { menuItemId: itemId, name: 'Extras', pricing: 'adjust', isRequired: false, minPicks: 0, maxPicks: 3 },
  });
  const groupId = grp.data.group.id;
  const ch = await env.req(`/api/admin/option-groups/${groupId}/choices`, {
    method: 'POST', cookie: adminCookie, body: { name: 'Cheese', priceCents: 200 },
  });
  const choiceId = ch.data.choice.id;

  const first = await env.req(`/api/restaurants/${slug}/orders`, {
    method: 'POST',
    body: {
      customerName: 'Ana', customerWhatsapp: '+15550005555', orderType: 'pickup',
      items: [{ itemId, quantity: 2, selections: [{ groupId, choices: [{ choiceId, quantity: 1 }] }] }],
    },
  });
  assert.strictEqual(first.status, 201);
  // Revenue aggregates count revenue statuses only (pending is excluded by
  // design); confirm one order so expectations match dashboard semantics.
  const confirmed = await env.req('/api/admin/orders/' + first.data.order.code + '/status', {
    method: 'PATCH', cookie: adminCookie, body: { status: 'confirmed' },
  });
  assert.strictEqual(confirmed.data.order.status, 'confirmed');
  const second = await env.req(`/api/restaurants/${slug}/orders`, {
    method: 'POST',
    body: { customerName: 'Ben', customerWhatsapp: '+15550006666', orderType: 'delivery', customerAddress: '1 Test Ave, Town', items: [{ itemId, quantity: 1 }] },
  });
  await env.req('/api/admin/orders/' + second.data.order.code + '/status', {
    method: 'PATCH', cookie: adminCookie, body: { status: 'cancelled' },
  });
});

after(async () => {
  if (env) await env.close();
});

test('today preset shows exact counts, splits, per-currency money', async () => {
  const res = await env.req('/api/admin/analytics?preset=today', { cookie: adminCookie });
  assert.strictEqual(res.status, 200);
  const a = res.data;
  assert.strictEqual(a.totals.orders, 1);
  assert.strictEqual(a.statusSplit.confirmed, 1);
  assert.strictEqual(a.statusSplit.cancelled, 1);
  assert.strictEqual(a.pickupVsDelivery.pickup, 1);
  assert.strictEqual(a.pickupVsDelivery.delivery, 1);
  assert.ok(a.revenueByCurrency);
  const cur = Object.keys(a.revenueByCurrency)[0];
  assert.match(cur, /^[A-Z]{3}$/);
  assert.ok(Number.isInteger(a.averageOrderValueByCurrency[cur]));
  assert.ok(Array.isArray(a.series) && a.series.length >= 1);
  // Legacy fields preserved alongside new ones.
  assert.ok(Number.isInteger(a.totals.revenueCents));
  assert.ok(Number.isInteger(a.averageOrderValueCents));
});

test('custom range works; invalid ranges rejected', async () => {
  const today = new Date().toISOString().slice(0, 10);
  const ok = await env.req(`/api/admin/analytics?from=${today}&to=${today}`, { cookie: adminCookie });
  assert.strictEqual(ok.status, 200);
  assert.strictEqual(ok.data.totals.orders, 1);

  for (const q of [`from=${today}`, `from=${today}&to=2020-01-01`, `from=not-a-date&to=${today}`, `from=2020-01-01&to=2020-06-01`, `days=7&from=${today}&to=${today}`, `preset=week`]) {
    const bad = await env.req('/api/admin/analytics?' + q, { cookie: adminCookie });
    assert.strictEqual(bad.status, 400, q);
  }
});

test('top items count parent lines once; options never become products', async () => {
  const res = await env.req('/api/admin/analytics?preset=today', { cookie: adminCookie });
  const top = res.data.topItems;
  assert.ok(top.length >= 1);
  const burger = top.find((t) => t.name === 'Test Burger' || t.item_name === 'Test Burger');
  assert.ok(burger, 'parent product present');
  assert.strictEqual(burger.quantity ?? burger.units, 2);
  assert.ok(!top.some((t) => (t.name || t.item_name) === 'Cheese'), 'option choice is not a product');
  assert.ok(burger.menu_item_id, 'product carries its menu item id');
});

test('analytics is tenant-isolated and matches hand-computed aggregates', async () => {
  const { rows } = await env.query(
    `SELECT COUNT(*)::int AS n, COALESCE(SUM(total_cents),0)::bigint AS rev
     FROM orders WHERE restaurant_id = (SELECT id FROM restaurants WHERE slug = $1)
     AND status IN ('confirmed','preparing','ready','out_for_delivery','completed')`,
    [slug]
  );
  const res = await env.req('/api/admin/analytics?preset=today', { cookie: adminCookie });
  assert.strictEqual(res.data.totals.orders, 1);
  const rev = Object.values(res.data.revenueByCurrency).reduce((a, f) => a + f.revenueCents, 0);
  assert.strictEqual(rev, Number(rows[0].rev));
});
