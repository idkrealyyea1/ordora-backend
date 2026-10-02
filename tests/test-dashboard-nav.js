'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

test('dashboard nav drawer CSS exists', () => {
  const css = require('fs').readFileSync(require('path').join(__dirname, '..', 'client', 'css', 'style.css'), 'utf8');
  assert.ok(css.includes('.dash-side'));
});

test('nav drawer markup exists in admin and owner pages', () => {
  const fs = require('fs');
  const path = require('path');
  for (const page of ['admin.html', 'owner.html']) {
    const html = fs.readFileSync(path.join(__dirname, '..', 'client', page), 'utf8');
    assert.ok(html.includes('id="nav-drawer"'));
    assert.ok(html.includes('id="nav-burger"'));
  }
  const css = fs.readFileSync(path.join(__dirname, '..', 'client', 'css', 'style.css'), 'utf8');
  assert.ok(css.includes('.nav-drawer-overlay'));
});

test('admin side links are capability-tagged', () => {
  const fs = require('fs');
  const html = fs.readFileSync(require('path').join(__dirname, '..', 'client', 'admin.html'), 'utf8');
  assert.ok(html.includes('data-cap='));
});
