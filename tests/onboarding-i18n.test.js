'use strict';

/** 013 US5: wizard/banners speak plain Arabic + English — static DICT audit.
 *  No database needed: parses the shipped files. */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const i18nSrc = fs.readFileSync(path.join(ROOT, 'client/js/i18n.js'), 'utf8');

function dictKeys(region) {
  const m = region === 'ar'
    ? i18nSrc.split('\n    en: {')[0]
    : i18nSrc.split('\n    en: {')[1];
  assert.ok(m, region + ' dict found');
  const keys = new Set();
  for (const match of m.matchAll(/^\s{6}([A-Za-z0-9_]+):/gm)) keys.add(match[1]);
  return keys;
}

const ar = dictKeys('ar');
const en = dictKeys('en');

test('every wizard/banner key exists in both ar and en', () => {
  const signupJs = fs.readFileSync(path.join(ROOT, 'client/js/signup.js'), 'utf8');
  const adminJs = fs.readFileSync(path.join(ROOT, 'client/js/admin.js'), 'utf8');
  const html = fs.readFileSync(path.join(ROOT, 'client/signup.html'), 'utf8');
  const used = new Set();
  for (const src of [signupJs, adminJs]) {
    for (const match of src.matchAll(/I\.t\('([A-Za-z0-9_]+)'/g)) used.add(match[1]);
  }
  for (const match of html.matchAll(/data-i18n="([A-Za-z0-9_]+)"/g)) used.add(match[1]);
  // Server profile vocab consumed by the wizard (labels, hints, help).
  const profiles = fs.readFileSync(path.join(ROOT, 'server/services/business-types.service.js'), 'utf8');
  for (const match of profiles.matchAll(/Key': '([A-Za-z0-9_]+)'/g)) used.add(match[1]);
  for (const match of profiles.matchAll(/'(bt_[A-Za-z0-9_]+)'/g)) used.add(match[1]);
  // Dynamic day keys day_0..day_6.
  for (let d = 0; d < 7; d++) used.add('day_' + d);

  const missing = [...used].filter((k) => k.startsWith('su_') || k.startsWith('bt_') || k.startsWith('cap') || k === 'brand');
  assert.ok(missing.length > 0, 'wizard keys detected');
  for (const k of missing) {
    assert.ok(ar.has(k), `ar missing: ${k}`);
    assert.ok(en.has(k), `en missing: ${k}`);
  }
});

test('wizard/banners show no tenant/plan/capability jargon to owners', () => {
  for (const dict of [ar, en]) {
    for (const k of dict) {
      if (!(k.startsWith('su_') || k.startsWith('bt_') || k.startsWith('cap'))) continue;
      const line = i18nSrc.split('\n').find((l) => l.includes(k + ':'));
      assert.ok(line && !/tenant|plan|capabilit/i.test(line), `jargon in ${k}`);
    }
  }
});
