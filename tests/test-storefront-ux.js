'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

test('menu grid breakpoint is 720px', () => {
  const css = require('fs').readFileSync(require('path').join(__dirname, '..', 'client', 'css', 'restivo.css'), 'utf8');
  assert.ok(css.includes('720px'));
});

test('product sheet markup and accessibility hooks exist', () => {
  const fs = require('fs');
  const js = fs.readFileSync(require('path').join(__dirname, '..', 'client', 'js', 'restaurant.js'), 'utf8');
  assert.ok(js.includes('product-sheet'));
  assert.ok(js.includes('aria-modal'));
  assert.ok(js.includes("e.key === 'Escape'"));
  const css = fs.readFileSync(require('path').join(__dirname, '..', 'client', 'css', 'restivo.css'), 'utf8');
  assert.ok(css.includes('.product-sheet'));
});

test('dish card is clickable, Add button removed', () => {
  const fs = require('fs');
  const js = fs.readFileSync(require('path').join(__dirname, '..', 'client', 'js', 'restaurant.js'), 'utf8');
  assert.ok(js.includes('data-open='));
  assert.ok(!js.includes('data-addopts'));
});
