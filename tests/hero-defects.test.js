'use strict';

/**
 * Regression coverage for four live hero-image defects found while investigating
 * the reported "Unsupported image type" failure. That literal does not exist in
 * the source — the original cause was fixed in 08d495e — but four distinct
 * defects were live:
 *
 *   D1  add-after-remove reused a soft-deleted position and hit 23505
 *   D2  validateHeroImagePath accepted only /uploads/covers/, so every real
 *       /uploads/hero/ path was rejected
 *   D3  the owner hero route attached no upload middleware, so an arbitrary
 *       client string was written to business_hero_images.image_path
 *   D4  the dashboard picker had no `change` listener, so picking a file did
 *       nothing (client-side; asserted structurally)
 *
 * Requires a disposable TEST_DATABASE_URL — never point this at production.
 */

process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || '';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { startApp } = require('./helpers');

const UUID = '550e8400-e29b-41d4-a716-446655440000';
const PNG_HEX = '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c626001000000ffff03000006000557bfabd40000000049454e44ae426082';
const PNG = Buffer.from(PNG_HEX, 'hex');
// Sniffing only reads the first 3 bytes for JPEG.
const JPEG = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]),
  Buffer.alloc(64),
]);

let env;
let ownerCookie;

function uploadHero(cookie) {
  const fd = new FormData();
  fd.append('image', new Blob([PNG], { type: 'image/png' }), 'hero.webp');
  return env.req('/api/admin/images?type=hero', { method: 'POST', cookie, body: fd });
}

async function addHero(cookie) {
  const res = await uploadHero(cookie);
  assert.strictEqual(res.status, 201, `upload should succeed, got ${res.status} ${JSON.stringify(res.data)}`);
  return res.data.heroImage;
}

let slugSeq = 0;

/** A fresh tenant per test: node:test shares module state, so a shared fixture
 *  would leak cover photos between tests and eventually hit the platform cap. */
async function newTenant(prefix) {
  slugSeq += 1;
  return env.createRestaurantFixture(ownerCookie, {
    name: `${prefix} ${slugSeq}`,
    slug: `${prefix}-${slugSeq}`,
  });
}

before(async () => {
  env = await startApp({ orderRateMax: 1000, authRateMax: 1000 });
  await env.createPlatformOwner('root', 'owner-password-123');
  ownerCookie = await env.login('root', 'owner-password-123');
});

after(async () => {
  if (env) await env.close();
});

// --- D1 ------------------------------------------------------------------

test('D1: cover photo added immediately after a removal succeeds', async () => {
  const fx = await newTenant('cover-a');
  const first = await addHero(fx.adminCookie);
  const removed = await env.req(`/api/admin/hero-images/${first.id}`, { method: 'DELETE', cookie: fx.adminCookie });
  assert.strictEqual(removed.status, 204);

  // The regression: removeHeroImage soft-deletes but keeps the row and its
  // position, so deriving the next position from active rows alone returns an
  // occupied value and UNIQUE (business_id, position) rejects the insert.
  const second = await addHero(fx.adminCookie);

  const list = await env.req('/api/admin/hero-images', { cookie: fx.adminCookie });
  assert.strictEqual(list.data.heroImages.length, 1);
  assert.strictEqual(list.data.heroImages[0].id, second.id);
});

test('D1: repeated add/remove cycles never collide', async () => {
  const tenant = await newTenant('cover-cycle');
  for (let i = 0; i < 5; i += 1) {
    const added = await addHero(tenant.adminCookie);
    const removed = await env.req(`/api/admin/hero-images/${added.id}`, { method: 'DELETE', cookie: tenant.adminCookie });
    assert.strictEqual(removed.status, 204, `cycle ${i}: remove should succeed`);
  }
});

test('D1: removing the primary promotes a remaining active cover', async () => {
  const fx = await newTenant('cover-primary');
  const first = await addHero(fx.adminCookie);
  const second = await addHero(fx.adminCookie);
  const removed = await env.req(`/api/admin/hero-images/${first.id}`, { method: 'DELETE', cookie: fx.adminCookie });
  assert.strictEqual(removed.status, 204);

  const list = await env.req('/api/admin/hero-images', { cookie: fx.adminCookie });
  const remaining = list.data.heroImages;
  assert.strictEqual(remaining.length, 1);
  assert.strictEqual(remaining[0].id, second.id);
  assert.strictEqual(remaining[0].is_primary, true, 'a survivor must be promoted to primary');
});

// --- D2 ------------------------------------------------------------------

test('D2: add-by-path accepts a real /uploads/hero/ path', async () => {
  const fx = await newTenant('cover-hero');
  const res = await env.req('/api/admin/hero-images', {
    method: 'POST', cookie: fx.adminCookie, body: { imagePath: `/uploads/hero/${UUID}.webp` },
  });
  assert.strictEqual(res.status, 201, 'a real hero path must be accepted');
  assert.ok(res.data.heroImage);
});

test('D2: add-by-path still accepts the /uploads/covers/ namespace', async () => {
  const tenant = await newTenant('cover-ns');
  const res = await env.req('/api/admin/hero-images', {
    method: 'POST', cookie: tenant.adminCookie, body: { imagePath: `/uploads/covers/${UUID}.jpg` },
  });
  assert.strictEqual(res.status, 201);
});

test('D2: cover path validation rejects foreign namespaces, traversal and bad extensions', async () => {
  const fx = await newTenant('cover-reject');
  const rejected = [
    `/uploads/logos/${UUID}.webp`,    // a different owner's namespace
    `/uploads/items/${UUID}.webp`,    // a different owner's namespace
    `/uploads/hero/../secret.jpg`,    // traversal
    `/uploads/hero/${UUID}.svg`,      // unsupported format
    '/uploads/hero/not-a-uuid.webp',  // malformed filename
    'not-a-real-path',
    '',
  ];
  for (const imagePath of rejected) {
    const res = await env.req('/api/admin/hero-images', {
      method: 'POST', cookie: fx.adminCookie, body: { imagePath },
    });
    assert.strictEqual(res.status, 400, `should reject: ${imagePath}`);
  }
});

// --- D3 (security) -------------------------------------------------------

test('D3 SECURITY: owner console rejects an unvalidated image path and writes no row', async () => {
  const fx = await newTenant('owner-deny');
  // Before the fix this returned 201 and persisted an arbitrary client string
  // into business_hero_images.image_path, because the route attached no upload
  // middleware so req.savedImagePublicPath was always undefined.
  const res = await env.req(`/api/owner/restaurants/${fx.restaurantId}/hero-images`, {
    method: 'POST', cookie: ownerCookie, body: { imagePath: 'not-a-real-path' },
  });
  assert.strictEqual(res.status, 400, 'an unvalidated path must be rejected');

  const list = await env.req(`/api/owner/restaurants/${fx.restaurantId}/hero-images`, { cookie: ownerCookie });
  assert.strictEqual(list.data.heroImages.filter((h) => !h.image_path.startsWith('/uploads/')).length, 0,
    'nothing unvalidated may be persisted');
});

test('D3: owner console accepts a validated body path', async () => {
  const fxB = await newTenant('owner-allow');
  const res = await env.req(`/api/owner/restaurants/${fxB.restaurantId}/hero-images`, {
    method: 'POST', cookie: ownerCookie, body: { imagePath: `/uploads/hero/${UUID}.webp` },
  });
  assert.strictEqual(res.status, 201);
});

// --- reorder -------------------------------------------------------------

test('reorder applies a permutation without a unique-constraint violation', async () => {
  const fx = await newTenant('reorder-ok');
  const a = await addHero(fx.adminCookie);
  const b = await addHero(fx.adminCookie);
  const c = await addHero(fx.adminCookie);
  const reversed = [c.id, a.id, b.id];

  const res = await env.req('/api/admin/hero-images/order', {
    method: 'PUT', cookie: fx.adminCookie, body: { order: reversed },
  });
  assert.strictEqual(res.status, 200);

  const list = await env.req('/api/admin/hero-images', { cookie: fx.adminCookie });
  assert.deepStrictEqual(list.data.heroImages.map((h) => h.id), reversed);
  assert.deepStrictEqual(list.data.heroImages.map((h) => h.position), [0, 1, 2]);
});

test('reorder rejects an unknown id, a non-array, and an empty list', async () => {
  const fxB = await newTenant('reorder-bad');
  const unknown = await env.req('/api/admin/hero-images/order', {
    method: 'PUT', cookie: fxB.adminCookie, body: { order: [UUID] },
  });
  assert.strictEqual(unknown.status, 400);

  const notArray = await env.req('/api/admin/hero-images/order', {
    method: 'PUT', cookie: fxB.adminCookie, body: { order: 'nope' },
  });
  assert.strictEqual(notArray.status, 400);

  const empty = await env.req('/api/admin/hero-images/order', {
    method: 'PUT', cookie: fxB.adminCookie, body: { order: [] },
  });
  assert.strictEqual(empty.status, 400);
});

test('reorder is tenant-scoped: admin A cannot reorder admin B covers', async () => {
  const fx = await newTenant('reorder-a');
  const fxB = await newTenant('reorder-b');
  const added = await addHero(fxB.adminCookie);
  const res = await env.req('/api/admin/hero-images/order', {
    method: 'PUT', cookie: fx.adminCookie, body: { order: [added.id] },
  });
  assert.strictEqual(res.status, 400, 'a foreign id must not be reorderable');
});

// --- D4 (client-side, structural) ---------------------------------------

test('D4: the cover picker uploads on selection, not on a second click', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'client', 'js', 'admin.js'), 'utf8');
  assert.match(src, /getElementById\('hero-file'\)\.addEventListener\('change',\s*uploadHero\)/,
    'the hidden input must listen for change and call uploadHero');
  assert.match(src, /hero-upload-btn'\)\.addEventListener\('click',\s*openHeroPicker\)/,
    'the button must open the picker rather than upload directly');
  // Retrying the same file after a failure requires clearing the value unconditionally.
  assert.match(src, /finally\s*\{[\s\S]{0,200}input\.value = ''/,
    'the input value must be cleared in a finally block so a retry fires change');
});

test('D4: the owner console also uploads on selection', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'client', 'js', 'owner.js'), 'utf8');
  assert.match(src, /getElementById\('oh-file'\)\.addEventListener\('change'/,
    'the owner console input must upload on change');
  assert.ok(!/id="owner-hero-form"/.test(src), 'the raw form + submit flow should be gone');
});

test('the cover validator accepts both writable namespaces and nothing else', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'server', 'validators', 'index.js'), 'utf8');
  const fn = src.slice(src.indexOf('function validateHeroImagePath'), src.indexOf('function validateHeroImagePath') + 600);
  assert.match(fn, /covers\|hero/, 'both writable namespaces must be accepted');
  assert.ok(!/covers\|hero\|/.test(fn), 'no third namespace may be admitted');
});

test('next hero position is derived from all rows, not only active ones', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'server', 'services', 'restaurants.service.js'), 'utf8'
  );
  assert.match(src, /SELECT COALESCE\(MAX\(position\), -1\) \+ 1 AS next FROM business_hero_images WHERE business_id = \$1/,
    'the MAX must not be filtered to is_active = true');
});

test('JPEG and PNG uploads are both accepted (formats unchanged by the fixes)', async () => {
  const tenant = await newTenant('formats');
  const fd = new FormData();
  fd.append('image', new Blob([JPEG], { type: 'image/jpeg' }), 'cover.jpg');
  const res = await env.req('/api/admin/images?type=hero', { method: 'POST', cookie: tenant.adminCookie, body: fd });
  assert.strictEqual(res.status, 201);
  assert.match(res.data.path, /^\/uploads\/hero\/[0-9a-f-]{36}\.jpg$/,
    'the extension is derived from the sniffed bytes, not the filename');
});
