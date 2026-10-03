'use strict';

/**
 * Task 17 FR-007/FR-009: liveness stays a static process check while
 * readiness verifies the database with a bounded probe. Neither endpoint
 * exposes secrets, credentials, hosts, or tenant data.
 */

process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || '';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startApp } = require('./helpers');

let env;

before(async () => {
  env = await startApp({ orderRateMax: 1000 });
});

after(async () => {
  // The final test intentionally kills the pool; close tolerates the double-end.
  if (env) await env.close().catch(() => {});
});

const SECRET_RE = /postgres(?:ql)?:\/\/|secret|password\s*[:=]|BEGIN [A-Z ]*PRIVATE KEY|db_host|db_password/i;

test('liveness answers without touching the database', async () => {
  const res = await env.req('/api/healthz');
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(res.data, { ok: true });
});

test('readiness passes when the database answers', async () => {
  const res = await env.req('/api/readyz');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.data.ok, true);
  assert.strictEqual(res.data.checks.db, 'up');
});

test('readiness and liveness bodies expose no secrets', async () => {
  for (const path of ['/api/healthz', '/api/readyz']) {
    const res = await env.req(path);
    assert.ok(!SECRET_RE.test(JSON.stringify(res.data)), path + ' leaks internals: ' + JSON.stringify(res.data));
  }
});

test('readiness fails safe when the pool cannot reach the database', async () => {
  await env.pool.end();
  const res = await env.req('/api/readyz');
  assert.strictEqual(res.status, 503);
  assert.strictEqual(res.data.ok, false);
  assert.strictEqual(res.data.checks.db, 'down');
  assert.ok(!SECRET_RE.test(JSON.stringify(res.data)), 'down body leaks internals');
});
