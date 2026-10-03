'use strict';

/**
 * Hero image upload regression tests.
 *
 * Root cause of the reported "Unsupported image type" bug: the dashboard
 * posts to POST /api/admin/images?type=hero, but the server-side allowlists
 * (SUBDIRS in middleware/upload.js, PUBLIC_PATH_RE in files.service.js)
 * only knew logos|covers|items — every hero upload died at validation.
 * The fix allowlists `hero` while keeping MIME + magic-byte sniffing.
 */

process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || '';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startApp } = require('./helpers');

const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c626001000000ffff03000006000557bfabd40000000049454e44ae426082',
  'hex'
);
// Minimal valid headers: SOI + JFIFỆN minimalism — sniffing only checks the first 3 bytes.
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]), Buffer.alloc(64)]);
// RIFF....WEBP header; sniffing checks bytes 0-3 and 8-11.
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(32)]);
const HTML = Buffer.from('<html><body>x</body></html>');

let env;
let fx;
let fxB;

function uploadHero(cookie, blob, filename) {
  const fd = new FormData();
  fd.append('image', blob, filename);
  return env.req('/api/admin/images?type=hero', { method: 'POST', cookie, body: fd });
}

before(async () => {
  env = await startApp({ orderRateMax: 1000 });
  await env.createPlatformOwner('root', 'owner-password-123');
  const ownerCookie = await env.login('root', 'owner-password-123');
  fx = await env.createRestaurantFixture(ownerCookie, { name: 'Hero Diner', slug: 'hero-diner' });
  fxB = await env.createRestaurantFixture(ownerCookie, { name: 'Hero Diner B', slug: 'hero-diner-b' });
});

after(async () => {
  if (env) await env.close();
});

test('PNG hero upload persists, registers a hero row, and is served', async () => {
  const fd = new FormData();
  fd.append('image', new Blob([PNG], { type: 'image/png' }), 'hero.png');
  const res = await env.req('/api/admin/images?type=hero', {
    method: 'POST', cookie: fx.adminCookie, body: fd,
  });
  assert.strictEqual(res.status, 201, 'hero upload accepted, got ' + res.status);
  assert.match(res.data.path, /^\/uploads\/hero\/[0-9a-f-]+\.png$/);
  assert.ok(res.data.heroImage && res.data.heroImage.id, 'hero row returned');

  const list = await env.req('/api/admin/hero-images', { cookie: fx.adminCookie });
  assert.ok(list.data.heroImages.some((h) => h.id === res.data.heroImage.id));

  const img = await fetch(env.baseUrl + res.data.path);
  assert.strictEqual(img.status, 200);
  assert.strictEqual(img.headers.get('content-type'), 'image/png');
});

test('JPEG and WebP hero uploads are accepted', async () => {
  const j = await uploadHero(fx.adminCookie, new Blob([JPEG], { type: 'image/jpeg' }), 'hero.jpg');
  assert.strictEqual(j.status, 201, 'jpeg accepted, got ' + j.status);
  assert.match(j.data.path, /\.jpg$/);

  const w = await uploadHero(fx.adminCookie, new Blob([WEBP], { type: 'image/webp' }), 'hero.webp');
  assert.strictEqual(w.status, 201, 'webp accepted, got ' + w.status);
  assert.match(w.data.path, /\.webp$/);
});

test('invalid, spoofed, and mistyped hero uploads are rejected', async () => {
  const badMime = await uploadHero(fx.adminCookie, new Blob([HTML], { type: 'text/html' }), 'evil.html');
  assert.strictEqual(badMime.status, 400);

  const spoofed = await uploadHero(fx.adminCookie, new Blob([HTML], { type: 'image/png' }), 'evil.png');
  assert.strictEqual(spoofed.status, 400, 'magic-byte sniffing beats declared MIME');

  const badType = await (async () => {
    const fd = new FormData();
    fd.append('image', new Blob([PNG], { type: 'image/png' }), 'ok.png');
    return env.req('/api/admin/images?type=hero2', { method: 'POST', cookie: fx.adminCookie, body: fd });
  })();
  assert.strictEqual(badType.status, 400);
});

test('multiple hero uploads accumulate; remove works', async () => {
  const before = await env.req('/api/admin/hero-images', { cookie: fxB.adminCookie });
  const n0 = before.data.heroImages.length;

  await uploadHero(fxB.adminCookie, new Blob([PNG], { type: 'image/png' }), 'a.png');
  await uploadHero(fxB.adminCookie, new Blob([JPEG], { type: 'image/jpeg' }), 'b.jpg');
  const list = await env.req('/api/admin/hero-images', { cookie: fxB.adminCookie });
  assert.strictEqual(list.data.heroImages.length, n0 + 2);

  const victim = list.data.heroImages[0];
  const del = await env.req('/api/admin/hero-images/' + victim.id, {
    method: 'DELETE', cookie: fxB.adminCookie,
  });
  assert.strictEqual(del.status, 204);
  const afterList = await env.req('/api/admin/hero-images', { cookie: fxB.adminCookie });
  assert.ok(!afterList.data.heroImages.some((h) => h.id === victim.id));
});

test('tenant isolation: admin A cannot touch restaurant B hero images', async () => {
  const bList = await env.req('/api/admin/hero-images', { cookie: fxB.adminCookie });
  assert.ok(bList.data.heroImages.length > 0, 'B needs a hero to attack');
  const target = bList.data.heroImages[0].id;

  const del = await env.req('/api/admin/hero-images/' + target, {
    method: 'DELETE', cookie: fx.adminCookie,
  });
  assert.strictEqual(del.status, 404, 'cross-tenant delete denied, got ' + del.status);

  const patch = await env.req('/api/admin/hero-images/' + target, {
    method: 'PATCH', cookie: fx.adminCookie, body: { isPrimary: true },
  });
  assert.strictEqual(patch.status, 404, 'cross-tenant primary denied, got ' + patch.status);

  const still = await env.req('/api/admin/hero-images', { cookie: fxB.adminCookie });
  assert.ok(still.data.heroImages.some((h) => h.id === target), 'B hero untouched');
});
