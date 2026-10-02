# Quickstart: Marketing Homepage, SEO, Localization & Storefront UX

**Date**: 2026-10-02
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## Prerequisites

- Node.js 20+
- PostgreSQL 14+
- `DATABASE_URL` environment variable set
- `SESSION_SECRET` environment variable set (min 32 chars)
- Existing database with migrations 001-029 applied

## Setup

```bash
# 1. Install dependencies (no new deps needed)
npm install

# 2. Run existing migrations
npm run migrate

# 3. Run new migrations (030-033)
npm run migrate

# 4. Seed translations (if not auto-seeded by migration)
node database/seeds/seed-translations.js

# 5. Start the server
npm start
```

## Validation Scenarios

### 1. Marketing Homepage Loads

```bash
curl -s http://localhost:3000/ | grep -o '<title>[^<]*</title>'
# Expected: <title>Restivo — ...</title>

curl -s http://localhost:3000/ | grep -o 'rel="canonical"[^>]*'
# Expected: rel="canonical" href="http://localhost:3000/"

curl -s http://localhost:3000/ | grep -o 'property="og:title"[^>]*'
# Expected: property="og:title" content="Restivo — ..."
```

### 2. SEO Metadata for Business Pages

```bash
# Get SEO metadata for a business
curl -s http://localhost:3000/api/seo/business/test-restaurant | jq .
# Expected: JSON with title, description, canonical, ogTitle, ogDescription, structuredData

# Verify structured data is valid JSON
curl -s http://localhost:3000/api/seo/business/test-restaurant | jq '.structuredData'
# Expected: Valid Restaurant or LocalBusiness schema
```

### 3. Sitemap and Robots.txt

```bash
# Verify sitemap includes homepage and active businesses
curl -s http://localhost:3000/sitemap.xml | grep -c '<url>'
# Expected: > 0 (at least homepage + marketing pages)

# Verify sitemap excludes private routes
curl -s http://localhost:3000/sitemap.xml | grep -c 'admin.html'
# Expected: 0

# Verify robots.txt disallows private routes
curl -s http://localhost:3000/robots.txt | grep 'Disallow: /api/'
# Expected: Disallow: /api/
```

### 4. Translations API

```bash
# Get Arabic translations
curl -s 'http://localhost:3000/api/translations?locale=ar' | jq '.translations.hero_title'
# Expected: Arabic string

# Get English translations
curl -s 'http://localhost:3000/api/translations?locale=en' | jq '.translations.hero_title'
# Expected: English string

# Verify caching header
curl -sI 'http://localhost:3000/api/translations?locale=ar' | grep 'Cache-Control'
# Expected: Cache-Control: public, max-age=3600
```

### 5. Hero Image Management

```bash
# Login as owner (get session cookie)
curl -s -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"identifier":"owner","password":"password123"}'

# Upload a hero image
curl -s -b cookies.txt -X POST http://localhost:3000/api/owner/restaurants/{id}/hero-images \
  -F 'image=@/path/to/image.jpg'
# Expected: 201 with heroImage object

# List hero images
curl -s -b cookies.txt http://localhost:3000/api/owner/restaurants/{id}/hero-images | jq .
# Expected: Array of hero images

# Update hero image (set as primary)
curl -s -b cookies.txt -X PATCH http://localhost:3000/api/owner/restaurants/{id}/hero-images/{imageId} \
  -H 'Content-Type: application/json' \
  -d '{"isPrimary":true}'
# Expected: 200 with updated heroImage
```

### 6. Storefront Hero Carousel

```bash
# Get hero images for public storefront
curl -s http://localhost:3000/api/restaurants/test-restaurant/hero-images | jq .
# Expected: Array of active hero images ordered by position
```

### 7. Currency Formatting

```bash
# Verify business currency is returned in menu API
curl -s http://localhost:3000/api/restaurants/test-restaurant/menu | jq '.settings.currency'
# Expected: "SAR" (or whatever the business is configured with)
```

### 8. Storefront Language

```bash
# Update storefront language
curl -s -b cookies.txt -X PATCH http://localhost:3000/api/owner/restaurants/{id}/settings \
  -H 'Content-Type: application/json' \
  -d '{"storefrontLanguage":"en"}'
# Expected: 200 with updated settings
```

### 9. Private Routes Have Noindex

```bash
# Verify private routes include noindex
curl -s http://localhost:3000/admin.html | grep -o 'name="robots"[^>]*'
# Expected: name="robots" content="noindex, nofollow, noarchive"

curl -s http://localhost:3000/owner.html | grep -o 'name="robots"[^>]*'
# Expected: name="robots" content="noindex, nofollow, noarchive"
```

### 10. Existing Functionality Preserved

```bash
# Verify existing storefront still works
curl -s http://localhost:3000/api/restaurants/test-restaurant/menu | jq '.items | length'
# Expected: > 0 (existing menu items)

# Verify existing checkout still works
curl -s -X POST http://localhost:3000/api/restaurants/test-restaurant/orders \
  -H 'Content-Type: application/json' \
  -d '{"customerName":"Test","customerWhatsapp":"972567439846","orderType":"pickup","items":[{"itemId":"'$(curl -s http://localhost:3000/api/restaurants/test-restaurant/menu | jq -r '.items[0].id')'","quantity":1}]}'
# Expected: 201 with order object

# Verify pricing endpoint still works
curl -s http://localhost:3000/api/pricing | jq .
# Expected: Pricing object with pricing_cents, pricing_currency
```

## Expected Outcomes

- All curl commands return expected status codes and response structures
- No 404 or 500 errors on any endpoint
- Translations return correct locale-specific strings
- Hero images upload, list, update, and delete correctly
- SEO metadata is truthful and matches business data
- Sitemap includes public pages and excludes private routes
- Existing functionality (menu, checkout, pricing) remains intact
