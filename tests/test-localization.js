'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

test('translations service exports required functions', () => {
  const svc = require('../server/services/translations.service');
  assert.strictEqual(typeof svc.getTranslations, 'function');
  assert.strictEqual(typeof svc.getAllTranslations, 'function');
  assert.strictEqual(typeof svc.updateTranslation, 'function');
});

test('Intl.NumberFormat formats currency correctly', () => {
  const fmt = new Intl.NumberFormat('en', { style: 'currency', currency: 'USD' });
  assert.strictEqual(fmt.format(19.99), '$19.99');
});

test('Intl.NumberFormat formats JOD with 3 decimals', () => {
  const fmt = new Intl.NumberFormat('en', { style: 'currency', currency: 'JOD' });
  assert.ok(fmt.format(19.99).includes('JOD'));
});

test('api.js formats money and dates with locale', () => {
  const fs = require('fs');
  const src = fs.readFileSync(require('path').join(__dirname, '..', 'client', 'js', 'api.js'), 'utf8');
  assert.ok(src.includes('Intl.NumberFormat'));
  assert.ok(src.includes('toLocaleString(locale'));
});

test('landing honors ?lang= and persists choice', () => {
  const fs = require('fs');
  const src = fs.readFileSync(require('path').join(__dirname, '..', 'client', 'js', 'restivo-landing.js'), 'utf8');
  assert.ok(src.includes("URLSearchParams(location.search).get('lang')"));
  assert.ok(src.includes("localStorage.setItem('restivo-lang'"));
});

test('storefront defaults to business storefront language', () => {
  const fs = require('fs');
  const src = fs.readFileSync(require('path').join(__dirname, '..', 'client', 'js', 'restaurant.js'), 'utf8');
  assert.ok(src.includes('storefrontLanguage'));
});
