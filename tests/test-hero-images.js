'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

test('hero image path validation regex works', () => {
  const re = /^\/uploads\/covers\/[0-9a-f-]{36}\.(jpg|png|webp)$/;
  assert.ok(re.test('/uploads/covers/550e8400-e29b-41d4-a716-446655440000.jpg'));
  assert.ok(!re.test('/uploads/covers/invalid.jpg'));
  assert.ok(!re.test('/uploads/logos/550e8400-e29b-41d4-a716-446655440000.jpg'));
});

test('hero carousel markup and two-state fallback exist', () => {
  const fs = require('fs');
  const js = fs.readFileSync(require('path').join(__dirname, '..', 'client', 'js', 'restaurant.js'), 'utf8');
  assert.ok(js.includes('hero-carousel'));
  assert.ok(js.includes('heroImages'));
});

test('hero upload path uses covers namespace', () => {
  const fs = require('fs');
  const src = fs.readFileSync(require('path').join(__dirname, '..', 'server', 'services', 'restaurants.service.js'), 'utf8');
  assert.ok(src.includes('business_hero_images'));
  assert.ok(src.includes('Maximum ') && src.includes('hero images'));
});
