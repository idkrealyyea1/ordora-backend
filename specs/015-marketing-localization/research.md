# Research: Marketing Homepage, SEO, Localization & Storefront UX

**Date**: 2026-10-02
**Spec**: [spec.md](spec.md)

## R1: Translation Storage Approach

**Decision**: Database table (`translations`) with server-side API endpoint.

**Rationale**: The spec clarification chose DB-backed translations over client-side JS dictionaries. This allows admin-editable translations without code deploys, supports future languages without JS changes, and provides a single source of truth. The existing `i18n.js` will be refactored to fetch from the API instead of using hardcoded dictionaries.

**Alternatives considered**:
- Client-side JS dictionary (existing pattern) — rejected because it requires code deploys for every translation change and doesn't support admin editing.
- Hybrid approach — rejected as unnecessarily complex for 2 languages.

**Implementation notes**:
- New `translations` table with (key, locale, value) and unique constraint on (key, locale)
- `GET /api/translations?locale=ar` endpoint returns JSON map
- `POST /api/owner/translations` endpoint for admin editing (owner-only)
- Existing `i18n.js` refactored to fetch from API on boot, fall back to embedded dictionary if API unavailable
- All existing strings from `i18n.js` seeded into the table via migration

## R2: Product Detail Presentation Mode

**Decision**: Bottom sheet (slides up from bottom on mobile, modal-style centered dialog on desktop).

**Rationale**: The spec clarification chose bottom sheet. This is the standard pattern in mobile food ordering apps (Talabat, HungerStation, Jahez). It feels native on mobile, keeps the menu visible in the background, and integrates naturally with the existing cart overlay pattern.

**Alternatives considered**:
- Modal overlay — rejected because it covers the entire menu context.
- Full-screen page — rejected because it requires navigation state management and feels heavy for a product detail.

**Implementation notes**:
- Mobile: slides up from bottom, 90% height max, backdrop overlay, swipe-to-dismiss
- Desktop: centered modal with max-width 600px
- Focus trapping, Escape to close, aria-modal="true"
- Reuses existing `.backdrop` / `.modal` CSS patterns from `restivo.css`
- Product detail is UI state only — no URL change, no separate route

## R3: Platform Language Storage

**Decision**: Add `platform_language` column to `users` table.

**Rationale**: Simplest approach. One user = one platform language preference. No separate preferences table needed. Defaults to 'ar' for backward compatibility.

**Alternatives considered**:
- Separate `user_preferences` table — rejected as over-engineered for a single preference.
- Cookie-only storage — rejected because it doesn't persist across devices.

## R4: Hero Image Migration Strategy

**Decision**: Migrate existing `cover_path` to `business_hero_images` with position=0, is_primary=true. Keep `cover_path` as fallback.

**Rationale**: Zero-regression migration. Businesses with existing cover images immediately get a working 1-image hero. The `cover_path` column is preserved as fallback for businesses that haven't uploaded hero images yet.

**Alternatives considered**:
- Drop `cover_path` — rejected as destructive and unnecessary.
- Keep both in parallel — rejected as confusing; the new table is the single source of truth after migration.

## R5: Maximum Hero Images

**Decision**: Default 6, configurable via `platform_settings`.

**Rationale**: The spec says "approximately 3 images" as initial use case but requires a configurable maximum. 6 gives headroom for businesses that want more while preventing abuse. Stored in `platform_settings` so platform owner can adjust without code deploy.

## R6: SEO Metadata for Business Pages

**Decision**: Server-side generation in `seo.service.js`, consumed by `site.routes.js` and `public.routes.js`.

**Rationale**: Business metadata (name, type, description, menu) is already in the database. A service function generates title, description, canonical, OG tags, and structured data from the business record. This keeps the logic testable and reusable.

**Implementation notes**:
- Title: `{business_name} — {business_type_label} | Restivo`
- Description: business description or fallback to menu summary
- Canonical: `{origin}/restaurant/{slug}`
- Structured data: Restaurant schema for restaurant/cafe/bakery/dessert_shop/cake_business/cloud_kitchen; LocalBusiness for home_kitchen/small_food_business
- No fake ratings, reviews, or unsupported fields
- Only indexable when business is active and subscription allows

## R7: Currency Formatting Approach

**Decision**: Use `Intl.NumberFormat` with currency code and locale. Server sends ISO 4217 code; client formats.

**Rationale**: `Intl.NumberFormat` is built into Node 20+ and all modern browsers. It correctly handles decimal rules, symbol placement, and thousands separators for all ISO currencies. No external library needed.

**Implementation notes**:
- Server: validate currency code (3-letter ISO), store in `restaurant_settings.currency`
- Client: `new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100)`
- Fallback: if `Intl.NumberFormat` fails, display `{cents/100} {currency}`
- No FX conversion, no exchange rates

## R8: Timezone Handling

**Decision**: Use existing `datetime.js` utilities. Business timezone stored in `restaurant_settings.timezone`.

**Rationale**: The existing `isOpenNow()`, `isValidTimezone()`, and `localDayAndMinutes()` functions already handle IANA timezone validation and opening-hours calculation. No new timezone library needed.

**Implementation notes**:
- Server: validate timezone with `isValidTimezone()`, fall back to UTC
- Opening hours: use existing `isOpenNow(hours, timezone)` — already works
- Order timestamps: stored as TIMESTAMPTZ, displayed in business timezone
- Analytics periods: calculated in business timezone

## R9: Dashboard Hamburger Navigation

**Decision**: Client-side drawer pattern using existing CSS. Hamburger button toggles a slide-in panel.

**Rationale**: The existing dashboard uses a horizontal tab bar (`.tabs-mobile`) and a sidebar (`.dash-side`). The hamburger pattern replaces these with a single button + drawer. This is a client-side only change — no backend API changes needed.

**Implementation notes**:
- Hamburger button in topbar, visible on all screen sizes
- Drawer slides in from the side (left in LTR, right in RTL)
- Contains navigation links filtered by capability
- Closes on: navigation, overlay tap, Escape, resize to desktop
- Focus management: focus trapped in drawer, returns to hamburger on close
- Body scroll locked when drawer open
- Uses CSS logical properties for RTL/LTR support

## R10: Menu Grid Responsive Behavior

**Decision**: CSS media queries. 1 column below 720px, 2 columns at 720px and above.

**Rationale**: Pure CSS approach — no JavaScript viewport detection. The existing `.dish-grid` class already uses CSS grid. Only the `grid-template-columns` value needs to change responsively.

**Implementation notes**:
- Mobile: `grid-template-columns: 1fr`
- Desktop: `grid-template-columns: repeat(2, 1fr)`
- Breakpoint: 720px (consistent with existing design system)
- No JavaScript changes needed for the grid itself
