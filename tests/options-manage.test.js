'use strict';

/** Task 5 US3: owner-managed options, isolated per business, snapshots survive edits. */

process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || '';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startApp } = require('./helpers');

let env;
let ownerCookie;
let adminA;
let adminB;
let itemA;
const slugA = 'options-shop-a';
const slugB = 'options-shop-b';

before(async () => {
  env = await startApp();
  await env.createPlatformOwner('root', 'owner-password-123');
  ownerCookie = await env.login('root', 'owner-password-123');
  const fa = await env.createRestaurantFixture(ownerCookie, { name: 'Shop A', slug: slugA });
  const fb = await env.createRestaurantFixture(ownerCookie, { name: 'Shop B', slug: slugB });
  adminA = fa.adminCookie;
  adminB = fb.adminCookie;
  itemA = fa.itemId;
});

after(async () => {
  if (env) await env.close();
});

test('group/choice CRUD scoped to the owning business', async () => {
  const created = await env.req('/api/admin/option-groups', {
    method: 'POST', cookie: adminA,
    body: { menuItemId: itemA, name: 'Size', isRequired: true, maxPicks: 1, pricing: 'replace' },
  });
  assert.strictEqual(created.status, 201);
  const groupId = created.data.group.id;

  // Tenant B cannot touch tenant A's definitions.
  for (const probe of [
    ['GET', `/api/admin/option-groups/${groupId}`, undefined],
    ['PATCH', `/api/admin/option-groups/${groupId}`, { name: 'Hijacked' }],
    ['DELETE', `/api/admin/option-groups/${groupId}`, undefined],
  ]) {
    const res = await env.req(probe[1], { method: probe[0], cookie: adminB, body: probe[2] });
    assert.ok([403, 404].includes(res.status), probe[0] + ' denied, got ' + res.status);
  }

  const viewB = await env.req('/api/restaurants/' + slugB + '/menu');
  assert.deepStrictEqual(viewB.data.items.flatMap((i) => i.options || []), []);
});

test('snapshots survive definition edits and deletions', async () => {
  const group = await env.req('/api/admin/option-groups', {
    method: 'POST', cookie: adminA,
    body: { menuItemId: itemA, name: 'Top', maxPicks: 1 },
  });
  const groupId = group.data.group.id;
  const choice = await env.req(`/api/admin/option-groups/${groupId}/choices`, {
    method: 'POST', cookie: adminA, body: { name: 'Gold', priceCents: 500 },
  });
  const choiceId = choice.data.choice.id;

  const order = await env.req(`/api/restaurants/${slugA}/orders`, {
    method: 'POST',
    body: {
      customerName: 'Keeper', customerWhatsapp: '+15551234567', orderType: 'pickup',
      items: [{ itemId: itemA, quantity: 1, selections: [{ groupId, choices: [{ choiceId, quantity: 1 }] }] }],
    },
  });
  assert.strictEqual(order.status, 201);

  await env.req(`/api/admin/option-groups/${groupId}/choices/${choiceId}`, {
    method: 'PATCH', cookie: adminA, body: { name: 'Renamed', priceCents: 5 },
  });
  await env.req(`/api/admin/option-groups/${groupId}`, { method: 'DELETE', cookie: adminA });

  const track = await env.req('/api/orders/track/' + order.data.order.code);
  assert.strictEqual(track.status, 200);
  const line = track.data.order.items[0];
  assert.strictEqual(line.line_total_cents, 850 + 500);
  const snap = (line.options || [])[0];
  assert.strictEqual(snap.choice_name, 'Gold');
  assert.strictEqual(snap.unit_price_cents, 500);
});
