'use strict';

/** 014 US6: subscription copy is plain, bilingual, and jargon-free — static audit.
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

const WANTED = [
  'sub_trial_left', 'sub_active_until', 'sub_active_open', 'sub_grace',
  'sub_expired_renew', 'sub_cancelled', 'sub_suspended',
  'subTrial', 'subGrace', 'subCancelled', 'subSuspended',
  'mSubscription', 'mSubState', 'mSubPlan', 'mSubEnds', 'mSubOpen', 'mSubDays',
  'mSubReason', 'mSubReasonReq', 'mSubExtend', 'mSubReactivate', 'mSubCancelEnd',
  'mSubSuspend', 'mSubHistory',
];

test('every subscription key exists in both ar and en', () => {
  assert.ok(WANTED.length > 0);
  for (const k of WANTED) {
    assert.ok(ar.has(k), `ar missing: ${k}`);
    assert.ok(en.has(k), `en missing: ${k}`);
  }
});

test('owner-facing subscription strings carry no internals jargon', () => {
  for (const k of WANTED) {
    const line = i18nSrc.split('\n').find((l) => l.includes(k + ':'));
    assert.ok(line && !/entitlement|plan ID|state-internal|subscription state internal/i.test(line), `jargon in ${k}`);
  }
});
