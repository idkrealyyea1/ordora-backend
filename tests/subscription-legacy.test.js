'use strict';

/** 014 US3: pre-existing businesses survive the subscription model untouched. */

process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || '';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startApp } = require('./helpers');

let env;
let ownerCookie;

before(async () => {
  env = await startApp({ authRateMax: 1000 });
  await env.createPlatformOwner('root', 'owner-password-123');
  ownerCookie = await env.login('root', 'owner-password-123');
});

after(async () => {
  if (env) await env.close();
});

test('admin-created business gets exactly one subscription row, zero invented audits', async () => {
  const created = await env.req('/api/owner/restaurants', {
    method: 'POST', cookie: ownerCookie,
    body: { name: 'Legacy Diner', slug: 'legacy-diner', businessType: 'restaurant' },
  });
  assert.strictEqual(created.status, 201);
  const id = created.data.restaurant.id;

  const rows = await env.query('SELECT * FROM subscriptions WHERE restaurant_id = $1', [id]);
  assert.strictEqual(rows.rowCount, 1);
  assert.strictEqual(rows.rows[0].status, 'active');
  assert.strictEqual(rows.rows[0].current_period_end, null, 'NULL end stays NULL (open-ended)');

  const events = await env.query('SELECT * FROM subscription_events WHERE restaurant_id = $1', [id]);
  assert.strictEqual(events.rowCount, 0, 'no invented history');

  // Behaves exactly as before: an admin account works, dashboard reads work.
  await env.req(`/api/owner/restaurants/${id}/admins`, {
    method: 'POST', cookie: ownerCookie, body: { username: 'legacy-admin', password: 'admin-password-123' },
  });
  const adminCookie = await env.login('legacy-admin', 'admin-password-123');
  const dash = await env.req('/api/admin/dashboard', { cookie: adminCookie });
  assert.strictEqual(dash.status, 200);
  assert.strictEqual(dash.data.subscription.state, 'active');
});

test('business without a subscription row still serves via the legacy clock', async () => {
  const created = await env.req('/api/owner/restaurants', {
    method: 'POST', cookie: ownerCookie,
    body: { name: 'Rowless Cafe', slug: 'rowless-cafe', businessType: 'cafe' },
  });
  const id = created.data.restaurant.id;
  await env.query('DELETE FROM subscriptions WHERE restaurant_id = $1', [id]);

  // Storefront + dashboard keep working (legacy ends_at rule); status read degrades honestly.
  const menu = await env.req('/api/restaurants/rowless-cafe/menu');
  assert.strictEqual(menu.status, 200);
  const st = await env.req('/api/owner/restaurants/' + id + '/subscription', { cookie: ownerCookie });
  assert.ok([200, 404].includes(st.status));
  if (st.status === 200) assert.strictEqual(st.data.state, 'active');
});

test('historical orders stay readable across subscription changes', async () => {
  const fx = await env.createRestaurantFixture(ownerCookie, { name: 'History Joint', slug: 'history-joint' });
  const before = await env.req(`/api/restaurants/history-joint/orders`, {
    method: 'POST',
    body: { customerName: 'H', customerWhatsapp: '+15551234567', orderType: 'pickup', items: [{ itemId: fx.itemId, quantity: 1 }] },
  });
  assert.strictEqual(before.status, 201);
  const code = before.data.order.code;

  await env.req(`/api/owner/restaurants/${fx.restaurantId}/subscription/suspend`, {
    method: 'POST', cookie: ownerCookie, body: { reason: 'test' },
  });
  const track = await env.req('/api/orders/track/' + code);
  assert.strictEqual(track.status, 200, 'tracking survives suspension');
  await env.req(`/api/owner/restaurants/${fx.restaurantId}/subscription/reactivate`, {
    method: 'POST', cookie: ownerCookie, body: { reason: 'test' },
  });
});
