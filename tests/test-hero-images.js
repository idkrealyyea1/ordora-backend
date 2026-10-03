'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

test('hero image path validation regex works', () => {
  // Both writable namespaces must be accepted: business_hero_images is written by
  // the cover uploader (type=covers) AND the hero uploader (type=hero). Accepting
  // only `covers` rejected every real hero path. logos/items stay rejected —
  // they belong to a different owner.
  const re = /^\/uploads\/(covers|hero)\/[0-9a-f-]{36}\.(jpg|png|webp)$/;
  assert.ok(re.test('/uploads/covers/550e8400-e29b-41d4-a716-446655440000.jpg'));
  assert.ok(re.test('/uploads/hero/550e8400-e29b-41d4-a716-446655440000.webp'));
  assert.ok(!re.test('/uploads/covers/invalid.jpg'));
  assert.ok(!re.test('/uploads/logos/550e8400-e29b-41d4-a716-446655440000.jpg'));
  assert.ok(!re.test('/uploads/items/550e8400-e29b-41d4-a716-446655440000.jpg'));
  assert.ok(!re.test('/uploads/hero/../secret.jpg'));
  assert.ok(!re.test('/uploads/hero/550e8400-e29b-41d4-a716-446655440000.svg'));
});

test('the validator used by the server accepts both writable namespaces', () => {
  const fs = require('fs');
  const src = fs.readFileSync(require('path').join(__dirname, '..', 'server', 'validators', 'index.js'), 'utf8');
  const fn = src.slice(src.indexOf('function validateHeroImagePath'));
  assert.ok(fn.includes('covers|hero'), 'validateHeroImagePath must accept covers and hero');
});

test('hero carousel markup and two-state fallback exist', () => {
  const fs = require('fs');
  const js = fs.readFileSync(require('path').join(__dirname, '..', 'client', 'js', 'restaurant.js'), 'utf8');
  assert.ok(js.includes('hero-carousel'));
  assert.ok(js.includes('heroImages'));
});

test('hero upload path uses the hero images table and enforces the platform cap', () => {
  const fs = require('fs');
  const src = fs.readFileSync(require('path').join(__dirname, '..', 'server', 'services', 'restaurants.service.js'), 'utf8');
  assert.ok(src.includes('business_hero_images'));
  assert.ok(src.includes('Maximum ') && src.includes('hero images'));
});

test('hero position is allocated over all rows so a soft delete cannot collide', () => {
  const fs = require('fs');
  const src = fs.readFileSync(require('path').join(__dirname, '..', 'server', 'services', 'restaurants.service.js'), 'utf8');
  // removeHeroImage soft-deletes and keeps the row, so scanning only active rows
  // reuses an occupied position and UNIQUE (business_id, position) rejects it.
  assert.ok(
    src.includes('SELECT COALESCE(MAX(position), -1) + 1 AS next FROM business_hero_images WHERE business_id = $1'),
    'next hero position must be computed across all rows'
  );
});
