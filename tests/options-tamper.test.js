'use strict';

/** Task 5 US2: tampered option submissions rejected or neutralized. */

process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || '';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startApp } = require('./helpers');

let env;
let ownerCookie;
let adminCookie;
let itemId;
let groupId;
let choiceId;
const slug = 'options-tamper';

before(async () => {
  env = await startApp();
  await env.createPlatformOwner('root', 'owner-password-123');
  ownerCookie = await env.login('root', 'owner-password-123');
  const fx = await env.createRestaurantFixture(ownerCookie, { name: 'Options Tamper', slug });
  adminCookie = fx.adminCookie;
  itemId = fx.itemId;

  const group = await env.req('/api/admin/option-groups', {
    method: 'POST', cookie: adminCookie,
    body: { menuItemId: itemId, name: 'Extras', maxPicks: 2 },
  });
  groupId = group.data.group.id;
  const choice = await env.req(`/api/admin/option-groups/${groupId}/choices`, {
    method: 'POST', cookie: adminCookie, body: { name: 'Dip', priceCents: 200 },
  });
  choiceId = choice.data.choice.id;
});

after(async () => {
  if (env) await env.close();
});

function orderBody(selections) {
  return {
    customerName: 'Tamperer', customerWhatsapp: '+15551234567', orderType: 'pickup',
    items: [{ itemId, quantity: 1, selections }],
  };
}

test('unknown group, unknown choice, and client prices rejected', async () => {
  const ghost = '11111111-1111-4111-8111-111111111111';
  for (const selections of [
    [{ groupId: ghost, choices: [{ choiceId, quantity: 1 }] }],
    [{ groupId, choices: [{ choiceId: ghost, quantity: 1 }] }],
    [{ groupId, choices: [{ choiceId, quantity: 1, priceCents: 1 }] }],
  ]) {
    const res = await env.req(`/api/restaurants/${slug}/orders`, {
      method: 'POST', body: orderBody(selections),
    });
    assert.notStrictEqual(res.status, 201, JSON.stringify(selections));
  }

  // Cross-tenant reference rejected.
  const other = await env.createRestaurantFixture(ownerCookie, { name: 'Tamper Other', slug: 'tamper-other' });
  const cross = await env.req('/api/restaurants/tamper-other/orders', {
    method: 'POST',
    body: {
      customerName: 'Tamperer', customerWhatsapp: '+15551234567', orderType: 'pickup',
      items: [{ itemId: other.itemId, quantity: 1, selections: [{ groupId, choices: [{ choiceId, quantity: 1 }] }] }],
    },
  });
  assert.notStrictEqual(cross.status, 201);
});

test('over-max picks, bad quantities, and unavailable choices refused', async () => {
  const many = await env.req(`/api/restaurants/${slug}/orders`, {
    method: 'POST', body: orderBody([{ groupId, choices: [{ choiceId, quantity: 99 }] }]),
  });
  assert.notStrictEqual(many.status, 201);

  await env.req(`/api/admin/option-groups/${groupId}/choices/${choiceId}`, {
    method: 'PATCH', cookie: adminCookie, body: { isAvailable: false },
  });
  const off = await env.req(`/api/restaurants/${slug}/orders`, {
    method: 'POST', body: orderBody([{ groupId, choices: [{ choiceId, quantity: 1 }] }]),
  });
  assert.notStrictEqual(off.status, 201);
});
