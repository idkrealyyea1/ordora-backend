# Data Model: Marketing Homepage, SEO, Localization & Storefront UX

**Date**: 2026-10-02
**Spec**: [spec.md](spec.md)

## New Tables

### translations

Stores all platform UI strings for all supported locales.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| key | TEXT | NOT NULL | Translation key (e.g., "hero_title") |
| locale | TEXT | NOT NULL | Locale code: "ar" or "en" |
| value | TEXT | NOT NULL | Translated string value |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | Last update timestamp |

**Constraints**:
- PRIMARY KEY (key, locale)
- CHECK (locale IN ('ar', 'en'))

**Indexes**:
- Primary key on (key, locale) provides lookup by locale

**Seed data**: All existing strings from `client/js/i18n.js` for both Arabic and English.

### business_hero_images

Stores multiple hero/cover images per business.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY DEFAULT gen_random_uuid() | Unique identifier |
| business_id | UUID | NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE | Owning business |
| image_path | TEXT | NOT NULL | Path to image in uploaded_files (e.g., "/uploads/covers/{uuid}.jpg") |
| position | INTEGER | NOT NULL DEFAULT 0 | Display order (0 = first) |
| is_primary | BOOLEAN | NOT NULL DEFAULT false | Primary/default image flag |
| is_active | BOOLEAN | NOT NULL DEFAULT true | Active state |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | Creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | Last update timestamp |

**Constraints**:
- UNIQUE (business_id, position)
- CHECK (position >= 0)

**Indexes**:
- `idx_business_hero_images_business` on (business_id, position)
- `idx_business_hero_images_active` on (business_id) WHERE is_active = true

**Migration**: Existing `cover_path` on `restaurant_settings` is migrated: if set, a `business_hero_images` record is created with position=0, is_primary=true. The original `cover_path` is preserved as fallback.

## Modified Tables

### restaurant_settings (existing)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| storefront_language | TEXT | NOT NULL DEFAULT 'ar' | Storefront display language (ar/en) |

**Migration**: `ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS storefront_language TEXT NOT NULL DEFAULT 'ar';`

### users (existing)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| platform_language | TEXT | NOT NULL DEFAULT 'ar' | Platform UI language preference (ar/en) |

**Migration**: `ALTER TABLE users ADD COLUMN IF NOT EXISTS platform_language TEXT NOT NULL DEFAULT 'ar';`

## Existing Tables (Referenced, Not Modified)

### uploaded_files (existing)

Stores image binary data as bytea. Referenced by `business_hero_images.image_path`.

| Column | Type | Description |
|--------|------|-------------|
| path | TEXT PRIMARY KEY | Public path (e.g., "/uploads/covers/{uuid}.jpg") |
| mime | TEXT | MIME type (image/jpeg, image/png, image/webp) |
| bytes | BYTEA | Binary image data |
| size_bytes | INTEGER | File size in bytes |
| created_at | TIMESTAMPTZ | Creation timestamp |

### platform_settings (existing)

Stores platform-wide settings including pricing and hero image limit.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY | Always 1 |
| pricing_cents | INTEGER | Plan price in cents |
| pricing_currency | CHAR(3) | Plan currency |
| pricing_period | TEXT | "month" or "year" |
| trial_days | INTEGER | Trial period in days |
| brand_name | TEXT | Platform brand name |

**New setting**: `max_hero_images` (INTEGER, default 6) — added via migration or seed.

### restaurants (existing)

Multi-tenant root entity. No structural changes.

### plans (existing)

SaaS subscription plans. No changes.

### plan_entitlements (existing)

Plan-to-capability mappings. No changes.

### subscriptions (existing)

Per-business subscription state. No changes.

### menu_items (existing)

Products with price_cents, image_path, is_available, is_popular, is_preorder. No changes.

### option_groups / option_choices (existing)

Product option groups and choices. No changes.

## Entity Relationships

```
restaurants (1) ──→ (N) business_hero_images
       │                    │
       │                    └──→ (1) uploaded_files (by path)
       │
       ├──→ (1) restaurant_settings (1:1, extended with storefront_language)
       │
       ├──→ (1) subscriptions (1:1)
       │         └──→ (1) plans
       │               └──→ (N) plan_entitlements
       │
       ├──→ (N) menu_items
       │         └──→ (N) option_groups
       │                   └──→ (N) option_choices
       │
       └──→ (N) users (platform_language on each user)

translations (standalone, keyed by locale)
```

## State Translations

### business_hero_images.is_active

```
true ──(owner deactivates)──→ false
false ──(owner activates)──→ true
```

### business_hero_images.is_primary

```
false ──(owner sets as primary)──→ true (all other images for same business set to false)
true ──(owner unsets)──→ false (another image must become primary)
```

## Validation Rules

- `translations.key`: 1-100 chars, lowercase with underscores
- `translations.locale`: must be 'ar' or 'en'
- `translations.value`: 1-500 chars
- `business_hero_images.image_path`: must match `/^\/uploads\/covers\/[0-9a-f-]{36}\.(jpg|png|webp)$/`
- `business_hero_images.position`: 0-9999
- `restaurant_settings.storefront_language`: must be 'ar' or 'en'
- `users.platform_language`: must be 'ar' or 'en'
- Max hero images per business: 6 (configurable via platform_settings)
