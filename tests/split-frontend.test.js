'use strict';

/**
 * Split-frontend (Cloudflare Pages → Render API): CORS preflight, origin
 * allowlist, and Wasmer parity (evil origins still rejected, default cookie
 * stays SameSite=Lax). Needs TEST_DATABASE_URL (disposable database only).
 */

process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || '';
// Allowlisted split frontend for this suite only (node:test isolates files
// per process, so other suites keep the default same-origin behavior).
process.env.FRONTEND_URL = 'https://shop-pages-dev.pages.dev';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startApp } = require('./helpers');

let env;

before(async () => {
  env = await startApp();
});

after(async () => {
  if (env) await env.close();
});

test('preflight from the allowlisted frontend gets CORS headers', async () => {
  const res = await fetch(env.baseUrl + '/api/auth/login', {
    method: 'OPTIONS',
    headers: { Origin: 'https://shop-pages-dev.pages.dev' },
  });
  assert.strictEqual(res.status, 204);
  assert.strictEqual(res.headers.get('access-control-allow-origin'), 'https://shop-pages-dev.pages.dev');
  assert.strictEqual(res.headers.get('access-control-allow-credentials'), 'true');
});

test('mutating request from the allowlisted frontend is not BAD_ORIGIN', async () => {
  const res = await fetch(env.baseUrl + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://shop-pages-dev.pages.dev' },
    body: JSON.stringify({ identifier: 'nope', password: 'nope' }),
  });
  assert.notStrictEqual(res.status, 403);
});

test('evil origin is still rejected', async () => {
  const res = await fetch(env.baseUrl + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example.com' },
    body: JSON.stringify({ identifier: 'x', password: 'y' }),
  });
  assert.strictEqual(res.status, 403);
  assert.strictEqual((await res.json()).error.code, 'BAD_ORIGIN');
});

test('public GET echoes CORS headers for the allowlisted frontend', async () => {
  const res = await fetch(env.baseUrl + '/api/healthz', {
    headers: { Origin: 'https://shop-pages-dev.pages.dev' },
  });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.headers.get('access-control-allow-origin'), 'https://shop-pages-dev.pages.dev');
});

test('default session cookie stays SameSite=Lax (Wasmer parity)', async () => {
  await env.createPlatformOwner('cors-root', 'owner-password-123');
  const res = await fetch(env.baseUrl + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'cors-root', password: 'owner-password-123' }),
  });
  assert.strictEqual(res.status, 200);
  const cookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')];
  assert.ok(cookies.some((c) => c && /SameSite=Lax/i.test(c)), 'expected SameSite=Lax, got: ' + cookies.join(' | '));
});
