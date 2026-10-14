'use strict';

/** Trial-expiry dashboard lock + Start-free CTA — static audit, no database. */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const adminSrc = fs.readFileSync(path.join(ROOT, 'client/js/admin.js'), 'utf8');
const i18nSrc = fs.readFileSync(path.join(ROOT, 'client/js/i18n.js'), 'utf8');
const appSrc = fs.readFileSync(path.join(ROOT, 'client/app.js'), 'utf8');

function dictKeys(region) {
  const m = region === 'ar'
    ? i18nSrc.split('\n    en: {')[0]
    : i18nSrc.split('\n    en: {')[1];
  assert.ok(m, region + ' dict found');
  const keys = new Set();
  for (const match of m.matchAll(/^\s{6}([A-Za-z0-9_]+):/gm)) keys.add(match[1]);
  return keys;
}

test('expired tenants get a full dashboard lock, not the data views', () => {
  assert.ok(adminSrc.includes('/api/onboarding/subscription'), 'lock checks subscription state');
  assert.ok(adminSrc.includes('sub_lockTitle'), 'lock screen rendered');
  assert.ok(adminSrc.includes('graceUntil'), 'data-retention date shown');
  assert.ok(adminSrc.includes('972567439846'), 'WhatsApp reactivation path');
});

test('lock copy exists in both ar and en', () => {
  const ar = dictKeys('ar');
  const en = dictKeys('en');
  for (const k of ['sub_lockTitle', 'sub_lockDesc', 'sub_lockStore', 'sub_lockData', 'sub_lockPrice', 'sub_lockWa']) {
    assert.ok(ar.has(k), `ar missing: ${k}`);
    assert.ok(en.has(k), `en missing: ${k}`);
  }
});

test('landing top CTA starts the free-trial signup', () => {
  assert.ok(appSrc.includes('/signup.html'), 'CTA links the signup wizard');
  assert.ok(appSrc.includes('startFree'), 'CTA copy key present');
});
