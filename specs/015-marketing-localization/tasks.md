# Tasks: Marketing Homepage, SEO, Localization & Storefront UX

**Input**: Design documents from `/specs/015-marketing-localization/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Test tasks included per spec requirement for comprehensive automated tests.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create migration files, new service stubs, and test file structure

- [X] T001 Create migration 030_translations.sql with `translations` table (key TEXT, locale TEXT, value TEXT, updated_at TIMESTAMPTZ, PRIMARY KEY (key, locale), CHECK (locale IN ('ar', 'en')))
- [X] T002 Create migration 031_business_hero_images.sql with `business_hero_images` table (id UUID PK, business_id UUID FK, image_path TEXT, position INTEGER, is_primary BOOLEAN, is_active BOOLEAN, created_at, updated_at, UNIQUE (business_id, position))
- [X] T003 Create migration 032_storefront_language.sql adding `storefront_language` column to `restaurant_settings` (TEXT NOT NULL DEFAULT 'ar')
- [X] T004 Create migration 033_platform_language.sql adding `platform_language` column to `users` (TEXT NOT NULL DEFAULT 'ar')
- [X] T005 [P] Create server/services/translations.service.js with CRUD functions for translations table
- [X] T006 [P] Create server/services/seo.service.js with generateBusinessMetadata(business) function
- [X] T007 [P] Create tests/test-seo.js with SEO metadata test stubs
- [X] T008 [P] Create tests/test-localization.js with translation/currency/timezone test stubs
- [X] T009 [P] Create tests/test-hero-images.js with hero image CRUD test stubs
- [X] T010 [P] Create tests/test-storefront-ux.js with menu grid/product detail test stubs
- [X] T011 [P] Create tests/test-dashboard-nav.js with hamburger navigation test stubs

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T012 Run migrations 030-033 and verify they are idempotent (run twice, no errors)
- [ ] T013 Seed translations table with all existing strings from client/js/i18n.js for both Arabic and English
- [X] T014 Migrate existing cover_path values to business_hero_images records (position=0, is_primary=true)
- [X] T015 Implement translations.service.js: getTranslations(locale), updateTranslation(key, locale, value), getAllTranslations()
- [X] T016 [P] Add translation validation to server/validators/index.js: validateLocale(value) checking against ('ar', 'en')
- [X] T017 [P] Add hero image validation to server/validators/index.js: validateHeroImagePath(value) checking against /^\/uploads\/covers\/[0-9a-f-]{36}\.(jpg|png|webp)$/
- [X] T018 Update client/js/i18n.js to fetch translations from GET /api/translations?locale={locale} on boot, fall back to embedded dictionary if API unavailable
- [X] T019 [P] Add GET /api/translations endpoint to server/routes/public.routes.js (locale query param, returns JSON map)
- [X] T020 [P] Add GET /api/seo/business/:slug endpoint to server/routes/public.routes.js (returns SEO metadata JSON)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 — Visitor discovers and understands the product (Priority: P1) 🎯 MVP

**Goal**: Marketing homepage with real plan data, complete SEO architecture, and correct indexation

**Independent Test**: Load `/` on mobile, verify all sections render, CTA links to `/signup.html`, page has correct meta/canonical/OG tags, sitemap includes homepage

### Tests for User Story 1

- [X] T021 [P] [US1] Test homepage loads with correct title and meta description in tests/test-seo.js
- [X] T022 [P] [US1] Test homepage includes canonical URL tag in tests/test-seo.js
- [X] T023 [P] [US1] Test homepage includes Open Graph tags in tests/test-seo.js
- [X] T024 [P] [US1] Test homepage includes valid JSON-LD structured data in tests/test-seo.js
- [X] T025 [P] [US1] Test sitemap.xml includes homepage and marketing pages in tests/test-seo.js
- [X] T026 [P] [US1] Test robots.txt disallows private routes in tests/test-seo.js

### Implementation for User Story 1

- [X] T027 [US1] Update client/index.html with complete SEO meta tags: title, description, canonical, OG tags, Twitter cards, JSON-LD SoftwareApplication schema, hreflang
- [X] T028 [US1] Update client/js/restivo-landing.js to fetch plan data from GET /api/pricing and render pricing section dynamically
- [X] T029 [US1] Update client/js/restivo-content.js with new content sections: trust/social proof (truthful only), FAQ, final CTA
- [X] T030 [US1] Update server/routes/site.routes.js sitemap.xml to include hreflang tags and business metadata
- [X] T031 [US1] Update server/routes/site.routes.js robots.txt to disallow /login.html and other private routes
- [X] T032 [US1] Add noindex meta tag to private pages: client/login.html, client/signup.html (internal sections)
- [ ] T033 [US1] Verify homepage loads in under 3 seconds with no blocking scripts

**Checkpoint**: User Story 1 fully functional — homepage is fast, discoverable, and converts visitors to onboarding

---

## Phase 4: User Story 2 — Business owner manages hero images and sees carousel (Priority: P1)

**Goal**: Multiple hero images per business with auto-advancing carousel on public storefront

**Independent Test**: Upload 3 images via dashboard, verify carousel on public storefront with auto-advance, manual navigation, swipe, and reduced-motion support

### Tests for User Story 2

- [X] T034 [P] [US2] Test hero image upload creates business_hero_images record in tests/test-hero-images.js
- [X] T035 [P] [US2] Test hero image upload rejects invalid file type in tests/test-hero-images.js
- [X] T036 [P] [US2] Test hero image upload enforces maximum count (6) in tests/test-hero-images.js
- [X] T037 [P] [US2] Test hero image reorder updates position in tests/test-hero-images.js
- [X] T038 [P] [US2] Test hero image removal sets is_active=false in tests/test-hero-images.js
- [X] T039 [P] [US2] Test hero image set primary updates all other images to is_primary=false in tests/test-hero-images.js
- [X] T040 [P] [US2] Test existing cover_path migration creates hero image record in tests/test-hero-images.js

### Implementation for User Story 2

- [X] T041 [US2] Implement hero image CRUD in server/services/restaurants.service.js: getHeroImages(businessId), addHeroImage(businessId, imagePath), updateHeroImage(businessId, imageId, patch), removeHeroImage(businessId, imageId)
- [X] T042 [US2] Add hero image API endpoints to server/routes/owner.routes.js: GET/POST /api/owner/restaurants/:id/hero-images, PATCH/DELETE /api/owner/restaurants/:id/hero-images/:imageId
- [X] T043 [US2] Add hero image upload endpoint to server/routes/admin.routes.js: POST /api/admin/images?type=covers (reuse existing upload middleware)
- [X] T044 [US2] Add GET /api/restaurants/:slug/hero-images endpoint to server/routes/public.routes.js (public storefront data)
- [X] T045 [US2] Update client/js/restaurant.js to render hero carousel: auto-advance every 5s, manual navigation arrows, touch/swipe support, pause on interaction
- [X] T046 [US2] Add carousel CSS to client/css/restivo.css: .hero-carousel, .hero-slide, .hero-nav, .hero-dots, reduced-motion support
- [X] T047 [US2] Update client/js/admin.js to add hero image management UI in settings tab: upload, preview, reorder, remove, set primary
- [X] T048 [US2] Update client/js/owner.js to add hero image management in restaurant settings modal
- [X] T049 [US2] Verify carousel displays 1 image as static (no chrome), 0 images as fallback

**Checkpoint**: User Story 2 fully functional — owners can manage multiple hero images, customers see carousel

---

## Phase 5: User Story 3 — Customer browses menu and orders via product detail (Priority: P1)

**Goal**: Responsive menu grid (1-col mobile, 2-col desktop) with product detail bottom sheet replacing "Add" button

**Independent Test**: Open storefront on mobile, tap product, verify bottom sheet opens with correct data, add to cart, complete checkout

### Tests for User Story 3

- [X] T050 [P] [US3] Test menu grid displays 1 column on mobile width in tests/test-storefront-ux.js
- [X] T051 [P] [US3] Test menu grid displays 2 columns on desktop width in tests/test-storefront-ux.js
- [X] T052 [P] [US3] Test clicking product card opens bottom sheet in tests/test-storefront-ux.js
- [X] T053 [P] [US3] Test bottom sheet shows correct product data (name, price, description) in tests/test-storefront-ux.js
- [X] T054 [P] [US3] Test bottom sheet hides empty options section when product has no options in tests/test-storefront-ux.js
- [X] T055 [P] [US3] Test bottom sheet add-to-cart integrates with existing cart in tests/test-storefront-ux.js
- [X] T056 [P] [US3] Test bottom sheet Escape key closes and returns focus in tests/test-storefront-ux.js

### Implementation for User Story 3

- [X] T057 [US3] Update client/css/restivo.css .dish-grid: 1fr below 720px, repeat(2, 1fr) at 720px and above
- [X] T058 [US3] Remove "Add" button from dishCard in client/js/restaurant.js — make entire card clickable
- [X] T059 [US3] Create product detail bottom sheet in client/js/restaurant.js: opens on card click, shows image/name/description/price/options/quantity/add-to-cart
- [X] T060 [US3] Add bottom sheet CSS to client/css/restivo.css: .product-sheet, .product-sheet-backdrop, mobile slide-up animation, desktop centered modal
- [X] T061 [US3] Add bottom sheet accessibility: focus trapping, Escape closes, aria-modal, aria-label on controls
- [X] T062 [US3] Integrate bottom sheet add-to-cart with existing cart system (localStorage cart_{slug})
- [X] T063 [US3] Verify server-side price validation remains authoritative (no client trust)

**Checkpoint**: User Story 3 fully functional — menu is responsive, product detail works, cart/checkout preserved

---

## Phase 6: User Story 4 — Owner uses hamburger dashboard navigation (Priority: P2)

**Goal**: Hamburger menu button opens navigation drawer with entitlement-aware sections

**Independent Test**: Log in as owner, open dashboard on mobile, verify hamburger opens drawer, navigate to each section, verify unauthorized sections hidden

### Tests for User Story 4

- [X] T064 [P] [US4] Test hamburger button opens drawer on mobile in tests/test-dashboard-nav.js
- [X] T065 [P] [US4] Test drawer closes on navigation in tests/test-dashboard-nav.js
- [X] T066 [P] [US4] Test drawer closes on overlay tap in tests/test-dashboard-nav.js
- [X] T067 [P] [US4] Test drawer closes on Escape key in tests/test-dashboard-nav.js
- [X] T068 [P] [US4] Test drawer shows only entitled sections in tests/test-dashboard-nav.js
- [X] T069 [P] [US4] Test drawer closes on resize to desktop in tests/test-dashboard-nav.js

### Implementation for User Story 4

- [X] T070 [US4] Update client/owner.html: add hamburger button in topbar, create drawer container
- [X] T071 [US4] Update client/admin.html: add hamburger button in topbar, create drawer container
- [X] T072 [US4] Add drawer CSS to client/css/style.css: .nav-drawer, .nav-drawer-overlay, slide-in animation, RTL/LTR support
- [X] T073 [US4] Implement drawer JS in client/js/owner.js: open/close, focus management, body scroll lock, Escape/overlay close
- [X] T074 [US4] Implement drawer JS in client/js/admin.js: open/close, focus management, body scroll lock, Escape/overlay close
- [X] T075 [US4] Add entitlement-aware filtering: fetch /api/onboarding/capabilities, hide unauthorized sections
- [X] T076 [US4] Ensure subscription section is always accessible (even when expired)

**Checkpoint**: User Story 4 fully functional — dashboard uses hamburger nav, sections are entitlement-aware

---

## Phase 7: User Story 5 — Platform supports Arabic and English with correct RTL/LTR (Priority: P1)

**Goal**: All pages support Arabic (RTL) and English (LTR) with correct directional layout and localized strings

**Independent Test**: Switch between Arabic and English on every page, verify correct dir attribute, layout direction, string rendering, and persistence

### Tests for User Story 5

- [X] T077 [P] [US5] Test Arabic renders with dir="rtl" in tests/test-localization.js
- [X] T078 [P] [US5] Test English renders with dir="ltr" in tests/test-localization.js
- [X] T079 [P] [US5] Test language switch preserves cart state in tests/test-localization.js
- [X] T080 [P] [US5] Test language switch preserves current route in tests/test-localization.js
- [X] T081 [P] [US5] Test unsupported locale falls back to Arabic in tests/test-localization.js
- [X] T082 [P] [US5] Test all new strings exist in both Arabic and English in tests/test-localization.js

### Implementation for User Story 5

- [X] T083 [US5] Update client/js/i18n.js: load translations from API, set document.documentElement.lang and dir on switch
- [X] T084 [US5] Add language toggle to client/index.html (if not present), client/restaurant.html, client/owner.html, client/admin.html
- [X] T085 [US5] Add RTL/LTR CSS logical properties to client/css/restivo.css: margin-inline, padding-inline, inset-inline, text-align: start/end
- [X] T086 [US5] Add RTL/LTR CSS logical properties to client/css/style.css: same properties for dashboard
- [X] T087 [US5] Store language preference in localStorage and users.platform_language
- [X] T088 [US5] Verify language switch preserves cart, category, search term in storefront

**Checkpoint**: User Story 5 fully functional — Arabic and English both work correctly on every page

---

## Phase 8: User Story 6 — Per-business currency and locale-aware formatting (Priority: P1)

**Goal**: Each business has its own currency, prices format correctly, dates/times are locale-aware, no FX conversion

**Independent Test**: Set business currency to JOD, verify prices display correctly. Change user locale, verify date/number formatting changes. Verify historical orders retain original currency.

### Tests for User Story 6

- [X] T089 [P] [US6] Test currency formatting with Intl.NumberFormat for USD, EUR, ILS, JOD, SAR, AED, EGP in tests/test-localization.js
- [X] T090 [P] [US6] Test per-business currency is returned in menu API in tests/test-localization.js
- [X] T091 [P] [US6] Test historical orders retain original currency after business changes currency in tests/test-localization.js
- [X] T092 [P] [US6] Test invalid currency code is rejected with 400 error in tests/test-localization.js
- [X] T093 [P] [US6] Test date/time formatting uses Intl.DateTimeFormat with correct locale in tests/test-localization.js
- [X] T094 [P] [US6] Test business timezone affects opening hours calculation in tests/test-localization.js
- [X] T095 [P] [US6] Test invalid timezone falls back to UTC in tests/test-localization.js

### Implementation for User Story 8

- [X] T096 [US6] Update client/js/api.js fmtMoney to use Intl.NumberFormat with locale parameter: new Intl.NumberFormat(locale, { style: 'currency', currency })
- [X] T097 [US6] Update client/js/restaurant.js to pass locale to fmtMoney based on storefront language
- [X] T098 [US6] Update client/js/admin.js to pass locale to fmtMoney based on platform language
- [X] T099 [US6] Update client/js/owner.js to pass locale to fmtMoney based on platform language
- [X] T100 [US6] Verify existing orders.currency is preserved (no conversion) — no code change needed, just verification
- [X] T101 [US6] Update client/js/api.js fmtDateTime to use Intl.DateTimeFormat with locale parameter
- [X] T102 [US6] Verify business timezone is used for opening hours (existing isOpenNow already handles this)

**Checkpoint**: User Story 6 fully functional — currency and locale formatting work correctly per business

---

## Phase 9: User Story 7 — Public business pages have unique SEO metadata (Priority: P1)

**Goal**: Each public business storefront has unique title, meta description, canonical URL, and truthful structured data

**Independent Test**: Visit two different business storefronts, verify different titles/descriptions/canonical URLs. Verify structured data is valid and truthful.

### Tests for User Story 7

- [X] T103 [P] [US7] Test business SEO metadata includes name and type in tests/test-seo.js
- [X] T104 [P] [US7] Test business SEO metadata includes canonical URL in tests/test-seo.js
- [X] T105 [P] [US7] Test structured data is valid JSON-LD in tests/test-seo.js
- [X] T106 [P] [US7] Test structured data has no fake ratings or reviews in tests/test-seo.js
- [X] T107 [P] [US7] Test home_kitchen uses LocalBusiness schema (not Restaurant) in tests/test-seo.js
- [X] T108 [P] [US7] Test inactive business returns noindex in tests/test-seo.js

### Implementation for User Story 7

- [X] T109 [US7] Implement server/services/seo.service.js: generateBusinessMetadata(business) returns { title, description, canonical, ogTitle, ogDescription, ogType, ogImage, structuredData }
- [X] T110 [US7] Add structured data generation: Restaurant schema for restaurant/cafe/bakery/dessert_shop/cake_business/cloud_kitchen; LocalBusiness for home_kitchen/small_food_business
- [X] T111 [US7] Add GET /api/seo/business/:slug endpoint to server/routes/public.routes.js
- [X] T112 [US7] Update client/restaurant.html to include business-specific SEO meta tags (server-rendered or client-side from API)
- [X] T113 [US7] Verify structured data includes only truthful fields (name, address, servesCuisine — no ratings/reviews)

**Checkpoint**: User Story 7 fully functional — each business page has unique, truthful SEO metadata

---

## Phase 10: User Story 8 — Sitemap and robots.txt correctly index public content (Priority: P2)

**Goal**: Sitemap includes all public pages and active businesses, excludes private routes. Robots.txt correctly disallows private areas.

**Independent Test**: Fetch /sitemap.xml, verify includes homepage + active businesses, excludes /admin.html + /owner.html + /api/*. Fetch /robots.txt, verify correct Allow/Disallow.

### Tests for User Story 8

- [X] T114 [P] [US8] Test sitemap includes active business URLs in tests/test-seo.js
- [X] T115 [P] [US8] Test sitemap excludes private routes in tests/test-seo.js
- [X] T116 [P] [US8] Test sitemap caps at 500 URLs in tests/test-seo.js
- [X] T117 [P] [US8] Test robots.txt disallows /api/ in tests/test-seo.js
- [X] T118 [P] [US8] Test robots.txt disallows /admin.html and /owner.html in tests/test-seo.js
- [X] T119 [P] [US8] Test private pages include noindex meta tag in tests/test-seo.js

### Implementation for User Story 8

- [X] T120 [US8] Update server/routes/site.routes.js sitemap.xml: add hreflang tags, include business metadata in lastmod
- [X] T121 [US8] Update server/routes/site.routes.js robots.txt: add Disallow for /login.html, /signup.html (internal sections)
- [X] T122 [US8] Verify sitemap is generated dynamically from database (no manual updates needed)
- [X] T123 [US8] Verify sitemap excludes deactivated businesses
- [X] T124 [US8] Add noindex meta tag to all private pages: client/login.html, client/signup.html

**Checkpoint**: User Story 8 fully functional — sitemap and robots.txt correctly index public content

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T125 [P] Run all tests: node --test tests/ — fix any failures
- [X] T126 [P] Run npm run check — fix any syntax errors
- [ ] T127 Run quickstart.md validation scenarios — fix any issues
- [ ] T128 [P] Performance audit: verify homepage JS bundle < 100KB gzipped, no image > 200KB
- [ ] T129 [P] Accessibility audit: verify all new UI elements have proper ARIA labels, focus states, keyboard navigation
- [ ] T130 [P] Security audit: verify no private data in SEO endpoints, no client-trust for currency/locale/plan
- [ ] T131 [P] RTL/LTR audit: verify all new UI elements render correctly in both directions
- [ ] T132 [P] Regression test: verify Task 13 onboarding, Task 14 subscription, customer checkout, Web Push all still work
- [X] T133 Update README.md with new features and architecture changes
- [X] T134 Update HANDOFF.md with new features and runtime behavior

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - US1 (P1): Can start after Foundational — no dependencies on other stories
  - US2 (P1): Can start after Foundational — depends on T002 (hero images table)
  - US3 (P1): Can start after Foundational — no dependencies on other stories
  - US4 (P2): Can start after Foundational — no dependencies on other stories
  - US5 (P1): Can start after Foundational — depends on T015 (translations service)
  - US6 (P1): Can start after Foundational — depends on T018 (i18n.js update)
  - US7 (P1): Can start after Foundational — depends on T006 (seo.service.js)
  - US8 (P2): Can start after Foundational — depends on T020 (SEO endpoint)
- **Polish (Phase 11)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: Can start after Foundational — no dependencies on other stories
- **US2 (P1)**: Can start after Foundational — no dependencies on other stories
- **US3 (P1)**: Can start after Foundational — no dependencies on other stories
- **US4 (P2)**: Can start after Foundational — no dependencies on other stories
- **US5 (P1)**: Can start after Foundational — no dependencies on other stories
- **US6 (P1)**: Can start after Foundational — no dependencies on other stories
- **US7 (P1)**: Can start after Foundational — no dependencies on other stories
- **US8 (P2)**: Can start after Foundational — no dependencies on other stories

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Models before services
- Services before endpoints
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- All tests for a user story marked [P] can run in parallel
- Models within a story marked [P] can run in parallel
- Different user stories can be worked on in parallel by different team members

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Test homepage loads with correct title and meta description in tests/test-seo.js"
Task: "Test homepage includes canonical URL tag in tests/test-seo.js"
Task: "Test homepage includes Open Graph tags in tests/test-seo.js"
Task: "Test homepage includes valid JSON-LD structured data in tests/test-seo.js"
Task: "Test sitemap.xml includes homepage and marketing pages in tests/test-seo.js"
Task: "Test robots.txt disallows private routes in tests/test-seo.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Add User Story 4 → Test independently → Deploy/Demo
6. Add User Story 5 → Test independently → Deploy/Demo
7. Add User Story 6 → Test independently → Deploy/Demo
8. Add User Story 7 → Test independently → Deploy/Demo
9. Add User Story 8 → Test independently → Deploy/Demo
10. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (Marketing Homepage)
   - Developer B: User Story 2 (Hero Images)
   - Developer C: User Story 3 (Menu & Product Detail)
3. After US1-US3 complete:
   - Developer A: User Story 5 (Localization)
   - Developer B: User Story 6 (Currency)
   - Developer C: User Story 7 (SEO Metadata)
4. After US5-US7 complete:
   - Developer A: User Story 4 (Dashboard Nav)
   - Developer B: User Story 8 (Sitemap & Robots)
5. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence

---

## Phase 12: Convergence

- [X] T135 Add absolute canonical `<link>` to static HTML of all public pages (index, pricing, features, how-it-works, for-*, contact, restaurant) per FR-010 (partial)
- [X] T136 Add missing `og:url` and complete Twitter Card sets to all public pages and to the SEO metadata injection in client/js/restaurant.js per FR-011 (partial)
- [X] T137 Persist platform UI language in users.platform_language on change and honor it at login render per FR-026, FR-028, FR-070 (partial)
- [X] T138 Build owner-dashboard translation editing UI backed by /api/owner/translations per FR-032c, FR-023 (missing)
- [X] T139 Make /api/translations unsupported-locale input fall back to Arabic (200 with ar map) instead of 400 per FR-031 (contradicts)
- [X] T140 Add availability state, category context, conditional sizes section, and live calculated total to the product bottom sheet per FR-055 (partial)
- [X] T141 Route hero uploads through the existing type=covers upload path to create business_hero_images records while preserving cover_path fallback per FR-052 (partial)
- [X] T142 Add hreflang alternate links to storefront HTML head per FR-022 (partial)
- [X] T143 Move new hero-management UI strings into both ar/en dictionaries and translations seed per SC-016 (partial)
- [X] T144 Lazy-load non-first hero carousel slides and add image dimensions per FR-049 (partial)
- [X] T145 Make the 6-image hero cap configurable via platform setting per FR-051, FR-068b (partial)
- [X] T146 Fall back to UTC and log a warning on invalid timezone values per FR-045 (missing)
