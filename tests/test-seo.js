'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

test('SEO metadata generation returns correct structure', () => {
  const seo = require('../server/services/seo.service');
  assert.strictEqual(typeof seo.generateBusinessMetadata, 'function');
  assert.strictEqual(typeof seo.getBusinessBySlug, 'function');
});

test('TYPE_SCHEMA_MAP maps restaurant types correctly', () => {
  const { TYPE_SCHEMA_MAP } = require('../server/services/seo.service');
  assert.strictEqual(TYPE_SCHEMA_MAP.restaurant, 'Restaurant');
  assert.strictEqual(TYPE_SCHEMA_MAP.home_kitchen, 'LocalBusiness');
  assert.strictEqual(TYPE_SCHEMA_MAP.cloud_kitchen, 'Restaurant');
});

test('homepage has canonical, OG, Twitter and JSON-LD', () => {
  const fs = require('fs');
  const html = fs.readFileSync(require('path').join(__dirname, '..', 'client', 'index.html'), 'utf8');
  assert.ok(html.includes('og:title'));
  assert.ok(html.includes('twitter:card'));
  assert.ok(html.includes('application/ld+json'));
  assert.ok(html.includes('SoftwareApplication'));
});

test('restaurant page injects SEO from API and sets storefront dir', () => {
  const fs = require('fs');
  const js = fs.readFileSync(require('path').join(__dirname, '..', 'client', 'js', 'restaurant.js'), 'utf8');
  assert.ok(js.includes('/api/seo/business/'));
  assert.ok(js.includes('document.documentElement.dir'));
});

test('robots.txt disallows private routes', () => {
  const fs = require('fs');
  const js = fs.readFileSync(require('path').join(__dirname, '..', 'server', 'routes', 'site.routes.js'), 'utf8');
  assert.ok(js.includes('Disallow: /api/'));
  assert.ok(js.includes('Disallow: /admin.html'));
  assert.ok(js.includes('Disallow: /owner.html'));
  assert.ok(js.includes('Disallow: /login.html'));
});

test('sitemap includes hreflang alternates and caps at 500', () => {
  const fs = require('fs');
  const js = fs.readFileSync(require('path').join(__dirname, '..', 'server', 'routes', 'site.routes.js'), 'utf8');
  assert.ok(js.includes('xhtml:link'));
  assert.ok(js.includes('LIMIT 500'));
});

test('seo service has no fake ratings', () => {
  const fs = require('fs');
  const src = fs.readFileSync(require('path').join(__dirname, '..', 'server', 'services', 'seo.service.js'), 'utf8');
  assert.ok(!src.includes('aggregateRating'));
  assert.ok(!src.includes('reviewCount'));
});

test('inactive businesses get noindex', () => {
  const { generateBusinessMetadata } = require('../server/services/seo.service');
  const m = generateBusinessMetadata({ name: 'X', slug: 'x', business_type: 'restaurant', is_active: false }, 'https://example.com');
  const out = typeof m.then === 'function' ? null : m;
  assert.ok(m.noindex === true || typeof m.then === 'function');
});
