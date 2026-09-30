'use strict';

/** Task 5 US2: example option kinds order correctly with server-truth pricing. */

process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || '';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startApp } = require('./helpers');

let env;
let adminCookie;
let pizzaId;
let burgerId;
let cakeId;
const slug = 'options-kinds';

async function api(path, { method = 'GET', body } = {}) {
  return env.req(path, { method, cookie: adminCookie, body });
}

async function makeItem(name, priceCents) {
  const cat = await api('/api/admin/categories', { method: 'POST', body: { name: name + ' Cat' } });
  const item = await api('/api/admin/items', {
    method: 'POST',
    body: { categoryId: cat.data.category.id, name, priceCents },
  });
  return item.data.item.id;
}

async function makeGroup(menuItemId, body) {
  const res = await api('/api/admin/option-groups', {
    method: 'POST', body: { menuItemId, ...body },
  });
  assert.strictEqual(res.status, 201);
  return res.data.group.id;
}

async function makeChoice(groupId, body) {
  const res = await api(`/api/admin/option-groups/${groupId}/choices`, {
    method: 'POST', body,
  });
  assert.strictEqual(res.status, 201);
  return res.data.choice.id;
}

before(async () => {
  env = await startApp();
  await env.createPlatformOwner('root', 'owner-password-123');
  const ownerCookie = await env.login('root', 'owner-password-123');
  const fx = await env.createRestaurantFixture(ownerCookie, { name: 'Options Kinds', slug });
  adminCookie = fx.adminCookie;

  // Pizza: required single-pick replace sizes.
  pizzaId = await makeItem('Pizza', 1000);
  const size = await makeGroup(pizzaId, { name: 'Size', isRequired: true, maxPicks: 1, pricing: 'replace' });
  await makeChoice(size, { name: 'Small', priceCents: 800 });
  await makeChoice(size, { name: 'Large', priceCents: 1400 });

  // Burger: optional add-ons.
  burgerId = await makeItem('Burger', 900);
  const adds = await makeGroup(burgerId, { name: 'Add-ons', maxPicks: 3 });
  await makeChoice(adds, { name: 'Cheese', priceCents: 150, maxQuantity: 2 });

  // Cake: required multi-pick (min 1, max 2) adjust group.
  cakeId = await makeItem('Cake', 2000);
  const flavors = await makeGroup(cakeId, { name: 'Flavors', isRequired: true, minPicks: 1, maxPicks: 2 });
  await makeChoice(flavors, { name: 'Vanilla', priceCents: 0 });
  await makeChoice(flavors, { name: 'Berry', priceCents: 300 });
});

after(async () => {
  if (env) await env.close();
});

async function groupIdFor(menuItemId, name) {
  const view = await env.req('/api/restaurants/' + slug + '/menu');
  const item = view.data.items.find((i) => i.id === menuItemId);
  return item.options.find((g) => g.name === name).id;
}

async function choiceIdFor(menuItemId, groupName, choiceName) {
  const view = await env.req('/api/restaurants/' + slug + '/menu');
  const item = view.data.items.find((i) => i.id === menuItemId);
  return item.options.find((g) => g.name === groupName).choices.find((c) => c.name === choiceName).id;
}

test('size variant replaces base price; add-ons and multi-choice adjust', async () => {
  const sizeId = await groupIdFor(pizzaId, 'Size');
  const largeId = await choiceIdFor(pizzaId, 'Size', 'Large');
  const pizza = await env.req(`/api/restaurants/${slug}/orders`, {
    method: 'POST',
    body: {
      customerName: 'Size Fan', customerWhatsapp: '+15551234567', orderType: 'pickup',
      items: [{ itemId: pizzaId, quantity: 1, selections: [{ groupId: sizeId, choices: [{ choiceId: largeId, quantity: 1 }] }] }],
    },
  });
  assert.strictEqual(pizza.status, 201);
  assert.strictEqual(pizza.data.order.totalCents, 1400);

  const addsId = await groupIdFor(burgerId, 'Add-ons');
  const cheeseId = await choiceIdFor(burgerId, 'Add-ons', 'Cheese');
  const burger = await env.req(`/api/restaurants/${slug}/orders`, {
    method: 'POST',
    body: {
      customerName: 'Extra Fan', customerWhatsapp: '+15551234567', orderType: 'pickup',
      items: [{ itemId: burgerId, quantity: 1, selections: [{ groupId: addsId, choices: [{ choiceId: cheeseId, quantity: 2 }] }] }],
    },
  });
  assert.strictEqual(burger.status, 201);
  assert.strictEqual(burger.data.order.totalCents, 900 + 150 * 2);
});

test('required groups block; min-max enforced', async () => {
  const bare = await env.req(`/api/restaurants/${slug}/orders`, {
    method: 'POST',
    body: {
      customerName: 'Rushed', customerWhatsapp: '+15551234567', orderType: 'pickup',
      items: [{ itemId: pizzaId, quantity: 1 }],
    },
  });
  assert.notStrictEqual(bare.status, 201);

  const flavorsId = await groupIdFor(cakeId, 'Flavors');
  const vanillaId = await choiceIdFor(cakeId, 'Flavors', 'Vanilla');
  const berryId = await choiceIdFor(cakeId, 'Flavors', 'Berry');
  const over = await env.req(`/api/restaurants/${slug}/orders`, {
    method: 'POST',
    body: {
      customerName: 'Greedy', customerWhatsapp: '+15551234567', orderType: 'pickup',
      items: [{ itemId: cakeId, quantity: 1, selections: [{ groupId: flavorsId, choices: [
        { choiceId: vanillaId, quantity: 1 }, { choiceId: berryId, quantity: 1 },
      ] }] }],
    },
  });
  assert.strictEqual(over.status, 201);
  assert.strictEqual(over.data.order.totalCents, 2000 + 300);
});
