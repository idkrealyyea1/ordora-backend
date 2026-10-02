# API Contracts: Marketing Homepage, SEO, Localization & Storefront UX

**Date**: 2026-10-02
**Spec**: [spec.md](spec.md)

## 1. GET /api/translations

Returns all platform translations for a given locale.

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| locale | string | Yes | Locale code: "ar" or "en" |

**Response 200**:
```json
{
  "locale": "ar",
  "translations": {
    "hero_title": "منيو يلفت الانتباه",
    "hero_subtitle": "وطلب أسهل لضيوفك",
    "pricing_title": "خطة واحدة",
    "...": "..."
  }
}
```

**Error Responses**:
- 400: Invalid locale code
- 404: Locale not found

**Caching**: `Cache-Control: public, max-age=3600`

---

## 2. GET /api/seo/business/:slug

Returns SEO metadata for a public business storefront.

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| slug | string | Business URL slug |

**Response 200**:
```json
{
  "title": "Shawarma Palace — Restaurant | Restivo",
  "description": "Order from Shawarma Palace. Browse the menu and place your order online.",
  "canonical": "https://restivo.example.com/restaurant/shawarma-palace",
  "ogTitle": "Shawarma Palace — Restaurant | Restivo",
  "ogDescription": "Order from Shawarma Palace...",
  "ogType": "restaurant",
  "ogImage": "https://restivo.example.com/uploads/covers/abc-123.jpg",
  "structuredData": {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    "name": "Shawarma Palace",
    "servesCuisine": ["Arabic", "Shawarma"],
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Riyadh"
    }
  }
}
```

**Error Responses**:
- 404: Business not found or not active
- 403: Business suspended (returns noindex metadata)

---

## 3. GET /api/restaurants/:slug/hero-images

Returns active hero images for a business storefront.

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| slug | string | Business URL slug |

**Response 200**:
```json
{
  "heroImages": [
    {
      "imagePath": "/uploads/covers/abc-123.jpg",
      "position": 0,
      "isPrimary": true
    },
    {
      "imagePath": "/uploads/covers/def-456.jpg",
      "position": 1,
      "isPrimary": false
    }
  ]
}
```

**Error Responses**:
- 404: Business not found

---

## 4. GET /api/owner/restaurants/:id/hero-images

Returns all hero images for a business (owner view, includes inactive).

**Authentication**: Required (owner/admin role)

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| id | UUID | Business ID |

**Response 200**:
```json
{
  "heroImages": [
    {
      "id": "uuid",
      "imagePath": "/uploads/covers/abc-123.jpg",
      "position": 0,
      "isPrimary": true,
      "isActive": true,
      "createdAt": "2026-10-02T12:00:00Z"
    }
  ],
  "maxHeroImages": 6
}
```

---

## 5. POST /api/owner/restaurants/:id/hero-images

Upload a new hero image for a business.

**Authentication**: Required (owner/admin role)

**Content-Type**: multipart/form-data

**Form Fields**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| image | file | Yes | Image file (JPEG/PNG/WebP, max 2MB) |

**Response 201**:
```json
{
  "heroImage": {
    "id": "uuid",
    "imagePath": "/uploads/covers/abc-123.jpg",
    "position": 2,
    "isPrimary": false,
    "isActive": true
  }
}
```

**Error Responses**:
- 400: Invalid file type or size
- 403: Not authorized for this business
- 409: Maximum hero images reached
- 413: File too large

---

## 6. PATCH /api/owner/restaurants/:id/hero-images/:imageId

Update a hero image (reorder, set primary, activate/deactivate).

**Authentication**: Required (owner/admin role)

**Body**:
```json
{
  "position": 1,
  "isPrimary": true,
  "isActive": true
}
```

**Response 200**:
```json
{
  "heroImage": {
    "id": "uuid",
    "imagePath": "/uploads/covers/abc-123.jpg",
    "position": 1,
    "isPrimary": true,
    "isActive": true
  }
}
```

---

## 7. DELETE /api/owner/restaurants/:id/hero-images/:imageId

Remove a hero image.

**Authentication**: Required (owner/admin role)

**Response 204**: No content

**Error Responses**:
- 403: Not authorized
- 404: Image not found
- 409: Cannot delete the only active hero image (must have at least one)

---

## 8. GET /api/owner/translations

Returns all translations for all locales (admin editing view).

**Authentication**: Required (owner role only)

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| locale | string | No | Filter by locale |

**Response 200**:
```json
{
  "translations": [
    {
      "key": "hero_title",
      "locale": "ar",
      "value": "منيو يلفت الانتباه",
      "updatedAt": "2026-10-02T12:00:00Z"
    }
  ]
}
```

---

## 9. PUT /api/owner/translations/:key

Update a translation value.

**Authentication**: Required (owner role only)

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| key | string | Translation key |

**Body**:
```json
{
  "locale": "ar",
  "value": "منيو يلفت الانتباه"
}
```

**Response 200**:
```json
{
  "key": "hero_title",
  "locale": "ar",
  "value": "منيو يلفت الانتباه",
  "updatedAt": "2026-10-02T12:00:00Z"
}
```

**Error Responses**:
- 400: Invalid locale or empty value
- 404: Translation key not found

---

## 10. PATCH /api/owner/restaurants/:id/settings

Update business settings including storefront_language.

**Authentication**: Required (owner/admin role)

**Body**:
```json
{
  "storefrontLanguage": "en"
}
```

**Response 200**:
```json
{
  "settings": {
    "storefrontLanguage": "en",
    "currency": "SAR",
    "timezone": "Asia/Riyadh"
  }
}
```

**Error Responses**:
- 400: Invalid language code
- 403: Not authorized
