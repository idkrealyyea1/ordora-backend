# Feature Specification: Marketing Homepage, SEO, Localization & Storefront UX

**Feature Branch**: `015-marketing-localization`

**Created**: 2026-10-02

**Status**: Draft

**Input**: Combined Task 15 (marketing homepage, conversion funnel, public SEO, discoverability) + Task 16 (global localization, i18n, locale formatting, multi-currency readiness) + additional storefront/dashboard UX requirements.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Visitor discovers and understands the product (Priority: P1)

A visitor lands on the marketing homepage from a search engine or social link. Within seconds they understand what Restivo is, who it's for, and how to start. The page is fast on mobile, the CTA leads to the real onboarding flow, and the page is properly indexed by search engines.

**Why this priority**: This is the primary acquisition path. Without a clear, fast, discoverable homepage, no other feature matters.

**Independent Test**: Load `/` on a mobile device, verify all sections render, CTA links to `/signup.html`, page has correct meta/canonical/OG tags, sitemap includes the homepage.

**Acceptance Scenarios**:

1. **Given** a visitor opens `/`, **When** the page loads, **Then** they see: hero with clear value proposition, supported business types, how-it-works, features, pricing (connected to real plan data), FAQ, and final CTA — all within 3 seconds on a mid-range phone.
2. **Given** a visitor clicks the primary CTA, **When** the action fires, **Then** they are taken to the existing self-service onboarding flow (`/signup.html` → Task 13 flow).
3. **Given** a search engine crawls `/`, **When** it parses the HTML, **Then** it finds: unique title, meta description, canonical URL, Open Graph tags, semantic HTML, structured data (SoftwareApplication), and the page is included in sitemap.xml.
4. **Given** a visitor switches language to English, **When** the toggle is clicked, **Then** all marketing strings render in English, `dir="ltr"` is set, and the URL/canonical remain stable.

---

### User Story 2 — Business owner manages hero images and sees carousel (Priority: P1)

A business owner logs into their dashboard, navigates to store settings, and uploads multiple hero/cover images for their storefront. The public storefront displays these as an auto-advancing carousel with manual navigation and reduced-motion support.

**Why this priority**: The hero carousel is the most visible storefront improvement and directly impacts customer conversion.

**Independent Test**: Upload 3 images via dashboard, verify they appear in carousel on public storefront, test auto-advance, manual navigation, swipe, and reduced-motion behavior.

**Acceptance Scenarios**:

1. **Given** an owner uploads 3 hero images, **When** they save, **Then** the public storefront shows a carousel with all 3 images, auto-advancing every 5 seconds.
2. **Given** the carousel is displaying, **When** the user swipes or clicks navigation arrows, **Then** the carousel moves to the correct slide and pauses auto-advance.
3. **Given** the user has `prefers-reduced-motion` enabled, **When** the carousel loads, **Then** no auto-advance occurs; only manual navigation works.
4. **Given** a business has only 1 hero image, **When** the storefront loads, **Then** it displays as a single static image (no carousel chrome).
5. **Given** a business has 0 hero images, **When** the storefront loads, **Then** the existing fallback behavior is preserved.

---

### User Story 3 — Customer browses menu and orders via product detail (Priority: P1)

A customer opens a public storefront on their phone. The menu shows one item per row on mobile. Tapping a product card opens a focused product detail view with image, description, price, options, quantity selector, and add-to-cart. The cart and checkout flow remains the existing system.

**Why this priority**: This is the core ordering journey. Any regression here breaks the product.

**Independent Test**: Open storefront on mobile, tap a product, verify detail modal opens with correct data, add to cart, complete checkout.

**Acceptance Scenarios**:

1. **Given** a customer views the menu on a phone, **When** the page renders, **Then** each menu item occupies a full row (one per row).
2. **Given** a customer views the menu on desktop, **When** the page renders, **Then** menu items display two per row.
3. **Given** a customer taps a product card, **When** the tap registers, **Then** a product detail view opens showing: large image, name, description, price, availability, and (if they exist) sizes/options, quantity selector, and add-to-cart button.
4. **Given** a product has no options, **When** the detail view opens, **Then** no empty options section is displayed.
5. **Given** a customer adds an item to cart from the detail view, **When** they proceed to checkout, **Then** the existing cart and checkout flow works unchanged with server-side price validation.

---

### User Story 4 — Owner uses hamburger dashboard navigation (Priority: P2)

A business owner logs into the dashboard. On mobile, they see a hamburger menu button. Tapping it opens a navigation drawer with only the sections they're authorized to access. The drawer closes on navigation, overlay tap, or Escape.

**Why this priority**: Dashboard usability on mobile is critical for daily operations but less critical than the customer-facing ordering flow.

**Independent Test**: Log in as owner, open dashboard on mobile, verify hamburger opens drawer, navigate to each section, verify unauthorized sections are hidden.

**Acceptance Scenarios**:

1. **Given** an owner opens the dashboard on mobile, **When** the page loads, **Then** a hamburger button is visible and no horizontal navigation bar is shown.
2. **Given** the owner taps the hamburger, **When** the drawer opens, **Then** it shows only sections the owner's business type and subscription entitle them to.
3. **Given** the drawer is open, **When** the user taps a section, **Then** the drawer closes and the section loads.
4. **Given** the drawer is open, **When** the user presses Escape or taps the overlay, **Then** the drawer closes and focus returns appropriately.
5. **Given** an owner's subscription is expired, **When** they open the drawer, **Then** the subscription/renewal section is still accessible.

---

### User Story 5 — Platform supports Arabic and English with correct RTL/LTR (Priority: P1)

The entire platform — marketing homepage, storefront, onboarding, dashboard — supports Arabic (RTL) and English (LTR) with correct directional layout, localized formatting, and language persistence.

**Why this priority**: This is the core of Task 16 and affects every surface.

**Independent Test**: Switch between Arabic and English on every page, verify correct `dir` attribute, layout direction, string rendering, and persistence across navigation.

**Acceptance Scenarios**:

1. **Given** a user selects Arabic, **When** any page loads, **Then** `dir="rtl"` is set, text aligns right, and all strings render in Arabic.
2. **Given** a user selects English, **When** any page loads, **Then** `dir="ltr"` is set, text aligns left, and all strings render in English.
3. **Given** a user switches language, **When** they navigate to another page, **Then** the language preference persists (localStorage/cookie).
4. **Given** a user switches language on the storefront, **When** the page re-renders, **Then** cart state, current category, and search term are preserved.
5. **Given** a business has a storefront language configured, **When** a customer visits, **Then** the storefront displays in that language regardless of the customer's browser locale.

---

### User Story 6 — Per-business currency and locale-aware formatting (Priority: P1)

Each business has its own currency. Prices display with correct formatting for the business's locale. Dates, times, and numbers format according to the user's locale. No automatic currency conversion occurs.

**Why this priority**: Financial correctness is non-negotiable for a commercial platform.

**Independent Test**: Set business currency to JOD, verify prices display as Jordanian Dinar with correct decimal rules. Change user locale, verify date/number formatting changes.

**Acceptance Scenarios**:

1. **Given** a business has currency "JOD", **When** a customer views the storefront, **Then** prices display in Jordanian Dinar with 3 decimal rules (or correct Intl formatting).
2. **Given** a business changes its currency, **When** historical orders are viewed, **Then** they retain their original currency and amounts (no conversion).
3. **Given** a user's locale is "ar", **When** dates and numbers are displayed, **Then** they use Arabic locale formatting.
4. **Given** a user's locale is "en", **When** dates and numbers are displayed, **Then** they use English locale formatting.
5. **Given** an invalid currency code is submitted, **When** the server validates, **Then** it is rejected with a clear error.

---

### User Story 7 — Public business pages have unique SEO metadata (Priority: P1)

Each public business storefront has a unique title, meta description, canonical URL, and structured data based on the business name, type, description, and menu content.

**Why this priority**: Public business pages are the primary SEO assets for customer acquisition.

**Independent Test**: Visit two different business storefronts, verify they have different titles, descriptions, and canonical URLs. Verify structured data is valid and truthful.

**Acceptance Scenarios**:

1. **Given** a business named "Shawarma Palace" with type "restaurant", **When** a crawler visits `/restaurant/shawarma-palace`, **Then** the title includes the business name and type, the description includes the business description, and the canonical URL is correct.
2. **Given** a business has menu items, **When** structured data is generated, **Then** it includes truthful Product/Restaurant schema with real prices and names — no fake ratings or reviews.
3. **Given** a business is a "home_kitchen", **When** structured data is generated, **Then** it uses LocalBusiness or Restaurant type — not a type that doesn't match.
4. **Given** a business is inactive or suspended, **When** a crawler visits, **Then** the page returns noindex or 404.

---

### User Story 8 — Sitemap and robots.txt correctly index public content (Priority: P2)

The sitemap includes all public marketing pages and active business storefronts. It excludes all private routes. The robots.txt correctly disallows private areas.

**Why this priority**: SEO discoverability depends on correct indexation rules.

**Independent Test**: Fetch `/sitemap.xml`, verify it includes homepage, marketing pages, and active business URLs. Verify it excludes `/admin.html`, `/owner.html`, `/api/*`. Fetch `/robots.txt`, verify correct Allow/Disallow rules.

**Acceptance Scenarios**:

1. **Given** a new business is created and activated, **When** the sitemap is regenerated, **Then** the new business URL appears without manual intervention.
2. **Given** a business is deactivated, **When** the sitemap is regenerated, **Then** the business URL is removed.
3. **Given** a crawler requests `/robots.txt`, **When** it reads the file, **Then** it disallows `/api/`, `/admin.html`, `/owner.html`, `/login.html`, and allows public pages.

---

### Edge Cases

- What happens when a business has no hero images? → Use existing fallback (food table image or brand color).
- What happens when a product has no image? → Use existing fallback image.
- What happens when a product has no options? → Do not render empty options section in detail view.
- What happens when a user's browser locale is unsupported? → Fall back to platform default (Arabic).
- What happens when a business's timezone is invalid? → Fall back to UTC.
- What happens when a currency code is invalid? → Reject with 400 error.
- What happens when a slug collision occurs during business creation? → Return 409 conflict with clear message.
- What happens when the sitemap has more than 500 businesses? → Paginate or cap at 500 most recently updated.
- What happens when a user manipulates the language parameter? → Server validates against supported locales, falls back to default.
- What happens when a user manipulates the currency parameter? → Server ignores client-provided currency; uses business's configured currency.
- What happens when a business has only 1 hero image? → Display as static image, no carousel controls.
- What happens when all hero images are removed? → Revert to fallback behavior.
- What happens when a product detail modal is open and user presses Escape? → Close modal, return focus to product card.
- What happens when the dashboard drawer is open and user resizes to desktop? → Drawer closes, desktop layout applies.

---

## Clarifications

### Session 2026-10-02

- Q: What presentation mode should the product detail experience use when a customer taps a menu item — a modal overlay, a bottom sheet, or a full-screen page? → A: Bottom sheet (slides up from bottom on mobile, modal-style centered dialog on desktop)
- Q: Where should platform translation strings be stored — in a database table or as a client-side JavaScript dictionary? → A: Database table with server-side API (allows admin-editable translations)

---

## Requirements *(mandatory)*

### Functional Requirements

#### Marketing Homepage (Task 15)

- **FR-001**: The marketing homepage MUST render a complete, mobile-first experience with: header/navigation, hero with primary CTA, secondary CTA, product demonstration, customer/business journey, value proposition, supported business types, how ordering works, key benefits/features, trust/social proof, pricing, FAQ, final CTA, and footer.
- **FR-002**: The primary CTA MUST link to the existing self-service onboarding flow (`/signup.html`). No separate onboarding system may be created.
- **FR-003**: The pricing section MUST consume real plan data from the existing Task 14 plan architecture via `GET /api/pricing` or the plans API. No hard-coded pricing logic may be added to the homepage.
- **FR-004**: The homepage MUST communicate that the platform serves all food business types (restaurant, cafe, bakery, dessert shop, home kitchen, cloud kitchen) without becoming vague or generic.
- **FR-005**: All marketing claims MUST be truthful. No fake testimonials, ratings, reviews, customer counts, or market leadership claims may be displayed.
- **FR-006**: The homepage MUST load in under 3 seconds on a mid-range mobile device with a 4G connection. No blocking scripts, oversized images, or excessive fonts may be used.
- **FR-007**: The homepage MUST support both Arabic (RTL) and English (LTR) with correct directional layout and localized strings.
- **FR-008**: The product demonstration section MUST use real product representations (existing storefront screenshots, live demo links, or actual product UI) — not fake decorative dashboards.

#### SEO Architecture (Task 15)

- **FR-009**: Every public page MUST have a unique `<title>` and meta description. The homepage title MUST include the brand name and value proposition.
- **FR-010**: Every public page MUST have a canonical URL tag. The canonical URL MUST be absolute and match the page's public path.
- **FR-011**: Every public page MUST have Open Graph tags (og:title, og:description, og:type, og:image, og:url) and Twitter Card tags (twitter:card, twitter:title, twitter:description).
- **FR-012**: The homepage MUST include valid JSON-LD structured data (SoftwareApplication schema) with truthful fields only.
- **FR-013**: Public business storefronts MUST have unique title, meta description, and canonical URL based on the business name, type, and description.
- **FR-014**: Public business storefronts MUST include truthful structured data (Restaurant, LocalBusiness, or Product schema) based on the actual business type and available data. No fake ratings, reviews, or unsupported fields may be generated.
- **FR-015**: Private routes (owner dashboard, admin dashboard, login, signup internals, order management, private settings) MUST include `<meta name="robots" content="noindex, nofollow, noarchive">`.
- **FR-016**: The sitemap.xml MUST be dynamically generated and include: marketing pages, active public business storefronts, and other public indexable pages. It MUST exclude: admin, login, private dashboards, private operational pages.
- **FR-017**: The sitemap MUST NOT require manual updates when a business is created. It MUST be generated from the database at request time.
- **FR-018**: The robots.txt MUST disallow `/api/`, `/admin.html`, `/owner.html`, `/login.html`, and other private routes. It MUST allow public marketing pages and business storefronts.
- **FR-019**: The sitemap MUST cap at 500 URLs per sitemap file (matching existing behavior) and use the most recently updated businesses.
- **FR-020**: Semantic HTML MUST be used throughout: proper heading hierarchy (h1→h2→h3), landmark elements (header, main, nav, footer), and alt text on all images.
- **FR-021**: The homepage MUST include a favicon and site identity (icon.svg already exists).
- **FR-022**: Language metadata MUST be set correctly: `lang` and `dir` attributes on the HTML element, and `hreflang` tags when multiple languages are supported.

#### Localization Architecture (Task 16)

- **FR-023**: A centralized translation architecture MUST exist. All user-facing strings MUST be stored in a database table (`translations`) with columns: key, locale, value. A server-side API endpoint MUST serve translations by locale. Translations MUST be admin-editable without code deploys.
- **FR-024**: The system MUST support Arabic (`ar`) and English (`en`) as the first two languages. The architecture MUST allow adding future languages without rewriting the product. Adding a new language MUST only require: (1) adding a new locale code to the supported locales list, (2) adding translation rows to the translations table, (3) adding the language to the language toggle UI.
- **FR-025**: Arabic MUST render with `dir="rtl"` and English with `dir="ltr"`. CSS logical properties (margin-inline, padding-inline, inset-inline, text-align: start/end) MUST be used where appropriate instead of physical left/right properties. The `dir` attribute MUST be set on the `<html>` element and MUST cascade to all child elements.
- **FR-026**: Language preference MUST be stored in localStorage (client-side) for immediate persistence and in `users.platform_language` (database) for cross-device consistency. The default language MUST be Arabic.
- **FR-027**: Language switching MUST NOT lose: cart state, onboarding state, form data, current business, or current route. Language preference MUST be stored in localStorage for client-side persistence and in the database for cross-device consistency.
- **FR-028**: The system MUST distinguish between PLATFORM UI LANGUAGE (owner dashboard, marketing pages) and BUSINESS STOREFRONT LANGUAGE (customer-facing storefront). A merchant may operate their dashboard in one language while presenting their storefront in another. Platform UI language is stored per-user (`users.platform_language`), storefront language is stored per-business (`restaurant_settings.storefront_language`).
- **FR-029**: Business storefront language MUST be configurable per-business. The storefront MUST display in the business's configured language regardless of the customer's browser locale. The storefront language MUST be stored in `restaurant_settings.storefront_language` and MUST default to 'ar' for existing businesses.
- **FR-030**: Merchant-created content (business name, product names, descriptions, category names, notes, policies) MUST NOT be automatically translated. The platform MUST distinguish between PLATFORM TRANSLATIONS (stored in the translations table) and MERCHANT CONTENT (stored in business-specific tables).
- **FR-031**: Unsupported locale input MUST fall back to the platform default (Arabic) without breaking the page. The fallback MUST be deterministic and MUST NOT expose internal error details to the client.
- **FR-032**: All new strings introduced by this feature MUST exist in both Arabic and English in the translations table.
- **FR-032a**: A server-side API endpoint MUST serve translations by locale (e.g., `GET /api/translations?locale=ar`). The response MUST be a JSON object mapping translation keys to translated values.
- **FR-032b**: The translations table MUST be seeded with all existing strings from `i18n.js` for both Arabic and English.
- **FR-032c**: An admin interface MUST allow editing translations without code deploys. The interface MUST be accessible from the owner dashboard.

#### Currency Architecture (Task 16)

- **FR-033**: Each business MUST have its own configured currency stored in `restaurant_settings.currency` (ISO 4217 code). The existing validation in `validators/index.js` MUST be used to validate currency codes.
- **FR-034**: Currency formatting MUST use `Intl.NumberFormat` with the appropriate locale. No manual per-currency formatting logic may be implemented.
- **FR-035**: The authoritative monetary value MUST remain numeric (integer minor units/cents). Formatted currency strings MUST NOT be stored as the authoritative value.
- **FR-036**: Historical orders MUST retain their original currency and amounts. A currency change MUST NOT silently convert historical order totals.
- **FR-037**: No automatic FX, exchange-rate API, or currency conversion may be implemented. A business has its own configured currency.
- **FR-038**: Invalid currency codes MUST be rejected by server-side validation with a clear error message. The validation MUST check against ISO 4217 format (3-letter code) and MUST verify the code is supported by Intl.NumberFormat.
- **FR-039**: The currency symbol/code, decimal rules, thousands separators, and placement MUST be determined by `Intl.NumberFormat` based on the currency code and locale. The formatting MUST be consistent across server-side and client-side rendering.

#### Timezone & Date/Time Formatting (Task 16)

- **FR-040**: Each business MUST have a configurable timezone stored in `restaurant_settings.timezone` (IANA format). The existing `isValidTimezone()` function in `datetime.js` MUST be used for validation.
- **FR-041**: Business-local time MUST affect: opening hours calculations, order timestamps display, analytics periods, and storefront open/closed status. The existing `isOpenNow()` function in `datetime.js` MUST be used for opening hours calculations.
- **FR-042**: The business's operating timezone MUST be authoritative for business operations. Browser local time MUST NOT be used for business logic. The server MUST use the business's timezone for all time-dependent calculations (opening hours, order timestamps, analytics periods).
- **FR-043**: Date, time, and number formatting MUST be locale-aware using `Intl.DateTimeFormat` and `Intl.NumberFormat`. The locale MUST be derived from the user's language preference (ar → ar, en → en).
- **FR-044**: Subscription dates and trial countdowns MUST display in the user's locale format while remaining calculated server-side. The server MUST send ISO 8601 dates and the client MUST format them using Intl.DateTimeFormat with the user's locale.
- **FR-045**: Invalid timezone values MUST fall back to UTC. The fallback MUST be logged server-side for debugging purposes.

#### Storefront UX — Hero Image Carousel

- **FR-046**: A business owner MUST be able to upload multiple hero/cover images for their storefront via the existing dashboard.
- **FR-047**: The hero image carousel MUST auto-advance with smooth transitions, support manual navigation (arrows/dots), support touch/swipe on mobile, and pause on user interaction.
- **FR-048**: The carousel MUST respect `prefers-reduced-motion` — no auto-animation when reduced motion is preferred.
- **FR-049**: The carousel MUST use optimized images (lazy loading for non-first slides, appropriate sizing).
- **FR-050**: A business with 1 hero image MUST display it as a static image (no carousel chrome). A business with 0 hero images MUST use the existing fallback (existing cover_path or default food image).
- **FR-051**: The owner MUST be able to reorder, remove, and set a primary/default hero image from the dashboard without editing database records. The maximum number of hero images per business MUST be enforced server-side (default: 6, configurable via platform setting).
- **FR-052**: Hero image uploads MUST follow existing upload security rules: ownership validation, file type validation (JPEG/PNG/WebP), file size limits, server-side authorization. The upload endpoint MUST accept a `type=covers` parameter and associate the image with the authenticated user's business.

#### Storefront UX — Menu Grid & Product Detail

- **FR-053**: The public menu MUST display one item per row on mobile (below 720px) and two items per row on desktop (720px and above). This MUST be achieved with CSS media queries, not JavaScript viewport detection.
- **FR-054**: The old "Add" button on menu cards MUST be removed. The product card itself MUST be the interaction target — clicking/tapping it opens the product detail experience.
- **FR-055**: The product detail experience MUST be a bottom sheet (slides up from bottom on mobile, modal-style centered dialog on desktop) containing: large product image, name, description, price, availability, category context, sizes (if available), options/modifiers (if available), quantity selector, final calculated price, and add-to-cart action.
- **FR-056**: If a product has no sizes, the sizes section MUST NOT be displayed. If a product has no options, the options section MUST NOT be displayed. The interface MUST adapt to actual product data.
- **FR-057**: The product detail MUST integrate with the existing cart/order system. No second cart, second checkout, or duplicate order creation may be introduced.
- **FR-058**: Server-side price validation MUST remain authoritative. The client MUST NOT be trusted for price, total, product availability, business ownership, option price, or quantity limits.
- **FR-059**: The product detail bottom sheet MUST be accessible: focus trapping, Escape key closes, screen-reader labels, image alt text, keyboard navigation, visible focus states.
- **FR-060**: Product detail states MUST NOT create duplicate indexable URLs. The product detail is a UI state over the canonical storefront URL. The bottom sheet MUST NOT change the browser URL or create a separate route.

#### Dashboard Navigation — Hamburger Menu

- **FR-061**: The owner/admin dashboard MUST use a hamburger menu button that opens a navigation drawer, especially on mobile. No large horizontal dashboard navigation bar may be displayed.
- **FR-062**: The dashboard navigation MUST show only sections the current user/business is authorized and entitled to use, based on the existing capability/entitlement system from Task 13/14.
- **FR-063**: The hamburger drawer MUST: close after navigation, close on overlay tap, close on Escape, handle body scrolling correctly, and manage focus correctly.
- **FR-064**: On desktop, a compact navigation/drawer model may remain appropriate. No cluttered horizontal navigation may be forced.
- **FR-065**: Subscription-related screens MUST be accessible from the dashboard navigation even when the subscription is expired or restricted.
- **FR-066**: Hiding UI sections based on entitlements MUST NOT be the only security — server-side authorization MUST still be enforced. The existing `requireCapability` middleware MUST be used for all capability-gated routes.

#### Database & Migrations

- **FR-067**: A new table `business_hero_images` MUST be created to store multiple hero images per business with: business_id, image_path, position, is_primary, is_active, created_at, updated_at.
- **FR-068**: The `business_hero_images` table MUST reference `uploaded_files` by path (not duplicate binary storage). Existing image storage architecture MUST be preserved.
- **FR-068a**: The existing `cover_path` on `restaurant_settings` MUST be migrated: if a business has a cover_path set, a corresponding `business_hero_images` record MUST be created with position=0 and is_primary=true. The original cover_path MUST be preserved as fallback.
- **FR-068b**: The maximum number of hero images per business MUST be configurable via a platform setting, with a default of 6.
- **FR-069**: A migration MUST add `storefront_language` column to `restaurant_settings` (default: 'ar' for backward compatibility).
- **FR-069a**: A migration MUST create a `translations` table with columns: key (text), locale (text), value (text), updated_at (timestamptz). A unique constraint on (key, locale) MUST exist.
- **FR-069b**: The translations table MUST be seeded with all existing strings from `i18n.js` for both Arabic and English.
- **FR-070**: A migration MUST add `platform_language` column to the users table (default: 'ar').
- **FR-071**: All migrations MUST be idempotent, backward-compatible, and preserve existing data. Existing businesses MUST receive deterministic defaults.
- **FR-072**: No existing business's currency, language, timezone, prices, or ordering behavior may change as a result of these migrations.

#### Security & Tenant Isolation

- **FR-073**: Public marketing routes MUST NOT expose private information: customer data, order data, private business settings, admin information, subscription internals, or private analytics.
- **FR-074**: SEO endpoints MUST NOT leak private data.
- **FR-075**: Language/currency parameters MUST NOT become injection vectors. All client-provided values MUST be validated server-side.
- **FR-076**: Client-provided business_id, currency, locale, timezone, subscription state, entitlement, or plan MUST NOT be trusted. Server-side validation remains authoritative.
- **FR-077**: Public business pages MUST still resolve the correct tenant. A user MUST NOT be able to manipulate slug, business ID, language, or query parameters to retrieve another tenant's private data. Tenant resolution MUST use the existing slug-based lookup with server-side validation.

#### Performance

- **FR-078**: The homepage MUST NOT introduce huge JavaScript bundles, unnecessary animation libraries, autoplay heavy video, oversized images, blocking scripts, excessive fonts, or third-party trackers.
- **FR-079**: Dynamic public pages, sitemap generation, and metadata generation MUST use simple, reliable caching approaches. No distributed caching may be introduced unless actually necessary.
- **FR-080**: Translation loading MUST NOT load every translation into memory unnecessarily. Only the active locale's translations should be loaded. The API endpoint MUST support caching headers (e.g., Cache-Control: public, max-age=3600) for translation responses.

### Key Entities

- **Business (Restaurant)**: Multi-tenant root entity. Has: name, slug, business_type, currency, timezone, storefront_language, platform_language, settings (logo, cover, colors, description, phone, whatsapp, address).
- **HeroImage**: Business hero/cover image. Has: business_id (FK), image_path (FK to uploaded_files), position (int), is_primary (bool), is_active (bool), created_at, updated_at.
- **Translation**: Platform UI string. Has: key (text), locale (text: ar/en), value (text). Stored in a translations table or as a JavaScript dictionary.
- **Plan**: SaaS subscription plan. Has: key, name, description, price_cents, currency, period, trial_eligible, capabilities, is_active. (Existing from Task 14.)
- **Subscription**: Per-business subscription state. Has: restaurant_id, plan_id, status, current_period_start, current_period_end, grace_until, cancel_effective_at. (Existing from Task 14.)
- **BusinessType**: Food business category. Has: key, name, description, icon, supported capabilities, onboarding flow. (Existing from Task 13.)
- **MenuOptionGroup**: Product option group (sizes, modifiers). Has: menu_item_id, name, is_required, min_picks, max_picks, pricing (replace/adjust), position. (Existing from Task 9.)
- **MenuOptionChoice**: Individual option choice. Has: group_id, name, price_cents, max_quantity, is_available, position. (Existing from Task 9.)

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A visitor can load the marketing homepage on a mid-range mobile device in under 3 seconds (Largest Contentful Paint).
- **SC-002**: A visitor can understand what the product is, who it's for, and how to start within 5 seconds of landing on the homepage.
- **SC-003**: The primary CTA leads directly to the existing onboarding flow — 100% of CTA clicks reach `/signup.html` or the Task 13 flow.
- **SC-004**: Every public page has a unique title, meta description, canonical URL, and Open Graph tags — verified by automated tests.
- **SC-005**: The sitemap includes all active business storefronts and excludes all private routes — verified by automated tests.
- **SC-006**: All private routes include `noindex, nofollow, noarchive` meta tags — verified by automated tests.
- **SC-007**: Arabic and English both render correctly on every page with proper `dir` attribute and localized strings — verified by automated tests.
- **SC-008**: Language switching preserves cart state, current route, and form data — verified by automated tests.
- **SC-009**: Currency formatting is correct for at least USD, EUR, ILS, JOD, SAR, AED, EGP — verified by automated tests.
- **SC-010**: Historical orders retain their original currency and amounts after a business changes currency — verified by automated tests.
- **SC-011**: The hero image carousel auto-advances, responds to manual navigation, and respects reduced-motion — verified by automated tests.
- **SC-012**: The menu displays one item per row on mobile and two per row on desktop — verified by automated tests.
- **SC-013**: Tapping a product card opens the product detail with correct data — verified by automated tests.
- **SC-014**: The product detail integrates with the existing cart and checkout — verified by automated tests.
- **SC-015**: The dashboard hamburger navigation opens, closes, and navigates correctly on mobile and desktop — verified by automated tests.
- **SC-016**: All new strings exist in both Arabic and English — verified by automated tests.
- **SC-017**: No regression in existing functionality: Task 13 onboarding, Task 14 subscription, customer checkout, Web Push notifications, dashboard features — verified by automated tests.
- **SC-018**: The homepage contains no fake testimonials, ratings, reviews, or customer counts — verified by code review.
- **SC-019**: The homepage loads with no JavaScript bundle exceeding 100KB (gzipped) and no single image exceeding 200KB.
- **SC-020**: A business with 0, 1, or 3+ hero images all render correctly without errors — verified by automated tests.

---

## Assumptions

- The existing Restivo design system (CSS variables, typography, color palette) is preserved and extended, not replaced.
- The existing `uploaded_files` table and `files.service.js` continue to be the image storage mechanism. No CDN or object storage is introduced.
- The existing `i18n.js` client-side dictionary approach is extended to cover all new strings. No server-side rendering or build pipeline is introduced.
- The existing `restivo-landing.js` and `restivo-content.js` pattern (client-side rendering with language dictionaries) is preserved for the marketing homepage.
- The existing cart (localStorage-based) and checkout (server-validated) flow is preserved. No second cart or checkout is created.
- The existing capability/entitlement system from Task 13/14 is the single authority for feature visibility. No second entitlement system is created.
- The existing subscription lifecycle from Task 14 is not modified. Marketing pages may read plan data but cannot modify subscriptions.
- The existing slug-based storefront routing (`/restaurant/:slug`) is preserved. No URL migration is needed.
- The existing `platform_settings` table and `GET /api/pricing` endpoint provide the public pricing data for the marketing homepage.
- The existing `plans` table and `plan_entitlements` provide the plan/capability data for the marketing homepage.
- The existing business type profiles in `business-types.service.js` are the single authority for type-specific UX differences.
- The existing `options.service.js` and option group/choice validators are reused for product detail options. No new product customization system is created.
- The existing `express.static` file serving and `client/` directory structure is preserved. No build pipeline or bundler is introduced.
- The existing CSP (Content Security Policy) headers are preserved. All new client-side code must comply with the existing CSP (no inline scripts, no eval).
- The existing `helmet` security headers are preserved.
- The existing rate limiting middleware is preserved.
- The existing session-based authentication is preserved. No JWT or token-based auth is introduced.
- The existing PostgreSQL-only image storage is preserved. No migration to external storage occurs.
- The existing `Intl.NumberFormat` and `Intl.DateTimeFormat` APIs (available in Node 20+ and all modern browsers) are used for locale-aware formatting. No external formatting library is introduced.
- The existing `prefers-reduced-motion` CSS media query support is extended for all new animations.
- The existing skeleton loader pattern is preserved for new pages.
- The existing PWA manifest and service worker are preserved.
- The existing `qrcode` library is used for QR code generation. No new QR library is introduced.
- The existing `web-push` library is used for notifications. No new push library is introduced.
