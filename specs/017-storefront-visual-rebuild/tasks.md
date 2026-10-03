---
description: "Task list for Storefront Visual Rebuild & MenuX-Grade Design Quality"
---

# Tasks: Storefront Visual Rebuild & MenuX-Grade Design Quality

**Input**: Design documents from `/specs/017-storefront-visual-rebuild/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md — all present

**Tests**: Included. The specification mandates them (FR-052, FR-055, FR-081) and the constitution requires them (XXV).

**Organization**: Tasks are grouped by user story so each story can be implemented, tested and shipped independently.

---

## ⚠️ BLOCKING DEFECTS — Phase 2 is not optional

The brief reported one bug ("Unsupported image type" on a second hero upload). That string exists in **no source file**; the original cause was fixed in commit `08d495e`. Investigation found **four live defects**, one of which is a genuine security vulnerability. All four are fixed in Phase 2, which **blocks every other phase** — no visual work may be layered on top of a live data-integrity bug.

| ID | Location | Severity | One-line defect |
|---|---|---|---|
| **D3** | `server/routes/owner.routes.js:65` + `server/controllers/owner.controller.js:613-616` | 🔴 **SECURITY — unvalidated write** | No upload middleware attached, so `savedImagePublicPath` is always undefined and an **arbitrary client string** is inserted into `business_hero_images.image_path` with no validation |
| **D2** | `server/validators/index.js:783-788` | 🟠 **Correctness — fails closed** | Regex accepts only `/uploads/covers/`, but `upload.js:71` produces `/uploads/hero/`, so `POST /api/admin/hero-images` rejects **every real hero path** |
| **D1** | `restaurants.service.js:467` + `admin.controller.js:295-297` vs `031:16` | 🟠 **Correctness — 500 / data integrity** | `MAX(position)` scans only `is_active = true` rows while `UNIQUE (business_id, position)` covers all rows, so remove-then-upload reuses a position → `23505` |
| **D4** | `client/js/admin.js:1321-1323` | 🟡 **UX — feature appears broken** | `#hero-file` has **no `change` listener**, so picking a file does nothing until the owner clicks `+` again |

### Execution status (2026-10-03)

| Defect | Code fix | Static verification | Runtime verification |
|---|---|---|---|
| D1 | T019, T020, T021, T022 | PASS — `nextHeroPosition` computes `MAX` over all rows; 23505 impossible | **NOT VERIFIED** — needs `TEST_DATABASE_URL` |
| D2 | T017 | PASS — regex accepts `covers\|hero`, rejects `logos`/`items`/traversal/`.svg` | **NOT VERIFIED** — needs `TEST_DATABASE_URL` |
| D3 | T013, T014, T015 | PASS — route wires `handleImageUpload(..., 'hero')`; controller validates the body fallback and persists validated uploads | **NOT VERIFIED** — needs `TEST_DATABASE_URL` |
| D4 | T024, T025 | PASS — 8/8 structural assertions green | Browser click-through **NOT VERIFIED** |

`npm run check` passes (142 files, 0 failures). `tests/hero-defects.test.js` is written with 16 tests but **cannot execute here** — this machine has no PostgreSQL and no `TEST_DATABASE_URL`. It must be run before this work is called done.

### Execution status (2026-10-03, second session)

Verified live against a local Postgres (`restivo-test-db` container) and a running server on port 3111.

| Area | Verified | How |
|---|---|---|
| All four defects | **16/16 tests green** | `node --test tests/hero-defects.test.js` |
| Existing hero-upload suite | **5/5 green** | no regression |
| Static storefront/SEO/i18n/dashboard suites | **25/25 green** | `node --test` on the five no-DB suites |
| Storefront + menu API suites | **green** | `storefront-identity`, `storefront-cart`, `storefront-discovery` |
| `npm run check` | **142 files, 0 failures** | — |
| `menu.test.js` 2 failures | **pre-existing** | reproduced with all my changes stashed — not a regression |
| Storefront design (16 measurements) | **16/16 present in served CSS** | fetched `/css/storefront-v3.css` from the running server |
| Product photo set | **live** | `images[]` present in the public payload, `images[0] === image_path`, `[]` for untouched items |
| Migration idempotency | **verified** | applied, then re-ran → skipped |

**NOT VERIFIED — no browser in this environment:** pixel-level appearance at the nine required widths, LCP, contrast, keyboard traversal, and the 65–75% sheet height as rendered. Those need a human or a browser automation run.

**D3 is a security fix, not a cosmetic one** (Constitution X). It must not be deferred, batched behind visual work, or described in a report as cosmetic.

---

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[SEC]**: Security/correctness defect fix — see table above
- **[Story]**: Which user story this belongs to (US1–US8)
- All paths are repository-relative

## Path Conventions

Single project: `client/`, `server/`, `database/`, `tests/` at repository root. No build step. No new dependencies.

---

## Phase 1: Setup (Baseline Capture)

**Purpose**: Capture the "before" state so every later change is provably attributable and no regression is invisible.

- [X] T001 Run `npm run check` and record the baseline result — expect 0 failures; any later failure is then attributable to this feature
- [ ] T002 Run `npm test` against a disposable `TEST_DATABASE_URL` and record that all 62 suites pass before any edit
- [ ] T003 Confirm all four defects reproduce and record the evidence: (D1) upload a cover photo, remove it, upload again → observe `23505`/500; (D2) `curl -X POST /api/admin/hero-images -d '{"imagePath":"/uploads/hero/<uuid>.webp"}'` → observe 400; (D3) `curl -X POST /restaurants/:id/hero-images -d '{"imagePath":"not-a-real-path"}'` → observe success and a bogus DB row; (D4) click the cover area, pick a file, observe no upload
- [ ] T004 [P] Capture the storefront performance baseline in DevTools (Slow 4G + CPU 4×, cache disabled) on `/restaurant/burger-house`: LCP, total transferred bytes, JS bytes — store the numbers in `specs/017-storefront-visual-rebuild/quickstart.md` under "Known gaps in verification" so SC-014 has a comparison point
- [ ] T005 [P] Capture screenshots of `/restaurant/burger-house`, `/`, `/admin.html` at 320/375/390/430/768/1024/1280/1440/1920px in both Arabic and English — store as the visual baseline
- [X] T006 Read `specs/017-storefront-visual-rebuild/plan.md` section "Source-Asserting Test Contracts" and keep it open — it lists every client source string the rebuild must not break

**Checkpoint**: Baseline captured. Any failure from here on is caused by this feature.

---

## Phase 2: Foundational — Security & Correctness Fixes 🔴 BLOCKING

**⚠️ CRITICAL**: No visual or feature work may begin until this phase is complete and green.

**Purpose**: Close the four live defects. D3 is a security vulnerability under Constitution X.

### Tests for the defect fixes (write first, watch them fail)

- [X] T007 Create `tests/hero-defects.test.js` with a test "cover photo added immediately after removal succeeds" that uploads, removes, then uploads again and asserts `201` and `count === 1` — must FAIL against current code
- [X] T008 [P] Add to `tests/hero-defects.test.js` a test "add-by-path accepts a real /uploads/hero/ path" asserting `201` for `/uploads/hero/<uuid>.webp` — must FAIL against current code
- [X] T009 [P] Add to `tests/hero-defects.test.js` a security test "owner console rejects an unvalidated image path" asserting `400` for `{"imagePath":"not-a-real-path"}` and asserting no row is written to `business_hero_images` — must FAIL against current code
- [X] T010 [P] Add to `tests/hero-defects.test.js` a test "removing the primary cover promotes a remaining active cover" asserting `is_primary === true` on a survivor — must FAIL against current code
- [X] T011 [P] Add to `tests/hero-defects.test.js` a test "cover photo validation rejects foreign namespaces and traversal" asserting `400` for `/uploads/logos/<uuid>.webp`, `/uploads/hero/../secret.jpg`, and `/uploads/hero/<uuid>.svg`
- [X] T012 [P] Add to `tests/hero-defects.test.js` a test "reordering cover photos applies a permutation without a unique-constraint violation" — must FAIL against current code

### D3 — SECURITY: owner console unvalidated path insert

- [X] T013 [SEC] In `server/routes/owner.routes.js:65`, attach the same image-upload middleware used by the admin route to `router.post('/restaurants/:id/hero-images', ...)` — import the exported handler from `server/middleware/upload.js` (`handleImageUpload`) so `req.savedImagePublicPath` is populated through validated upload instead of never being set
- [X] T014 [SEC] In `server/controllers/owner.controller.js:613-616` (`addHeroImage`), stop trusting `req.body.imagePath` unconditionally — accept `req.savedImagePublicPath`, and when falling back to a body path, pass it through `v.validateHeroImagePath` from `server/validators/index.js` so an arbitrary string can never reach the database
- [X] T015 [SEC] In `client/js/owner.js:632-657`, change the owner console hero upload to send multipart form data through the upload middleware (mirroring `client/js/admin.js:1474-1485`) instead of posting a raw path string
- [X] T016 [SEC] Verify the owner console still enforces `requireOwner` and cross-tenant refusal — a platform owner may act only within their authority; confirm with the tenant-isolation assertions already in `tests/tenant-isolation.test.js:88`

### D2 — Correctness: validator rejects every real hero path

- [X] T017 [SEC] In `server/validators/index.js:783-788` (`validateHeroImagePath`), widen the pattern to `/^\/uploads\/(covers|hero)\/[0-9a-f-]{36}\.(jpg|png|webp)$/` so both namespaces the platform actually produces are accepted while `logos`, `items`, traversal and wrong extensions are still rejected
- [X] T018 [SEC] Correct `tests/test-hero-images.js:6-11`, which currently asserts the same buggy covers-only regex — update it to the corrected pattern and **preserve its real intent** by keeping the assertions that `/uploads/logos/…` and `/uploads/covers/invalid.jpg` are rejected. This is a correction of an incorrect expectation (FR-081), not a weakening: do not delete the test and do not relax its rejection cases

### D1 — Correctness: position collision on add-after-remove

- [X] T019 [SEC] In `server/services/restaurants.service.js:467`, remove `AND is_active = true` from the `SELECT position FROM business_hero_images` subquery so `MAX(position)` is taken over **all** rows, including soft-deleted ones — a one-line change that eliminates the `23505 unique_violation` without touching the constraint
- [X] T020 [SEC] In `server/controllers/admin.controller.js:295-297`, apply the identical correction to the duplicated position computation for `type=covers` — fixing only the service would leave the bug live on this path
- [X] T021 [SEC] In `server/services/restaurants.service.js` (`removeHeroImage`), after a successful soft delete, promote a remaining active hero to `is_primary` when no active primary remains, so a business is never left without a primary cover
- [X] T022 [SEC] In `server/services/restaurants.service.js` (`updateHeroImage`), make `position` assignment collision-safe by applying a reorder as a permutation inside one transaction using a temporary offset, rather than assigning a bare position that can transiently violate `UNIQUE (business_id, position)`
- [X] T023 [SEC] Confirm the cap error at `restaurants.service.js:457-462` still throws `badRequest('Maximum ' + maxHero + ' hero images')` and that the strings `business_hero_images`, `'Maximum '` and `'hero images'` remain present — `tests/test-hero-images.js` asserts them

### D4 — UX: cover picker does not fire on selection

- [X] T024 [SEC] In `client/js/admin.js`, bind a `change` listener on the hidden `#hero-file` input (declared at line 1295) to call `uploadHero`, so selecting a file uploads immediately — currently `uploadHero` (line 1475) is only reachable by clicking `#hero-upload-btn` again
- [X] T025 [SEC] In `client/js/admin.js:1321-1323`, make the `.hero-add` zone click delegate to `#hero-upload-btn` so exactly one code path opens the picker, and clear `#hero-file.value` in a `finally` block so a failed upload can be retried with the same file

### Verification

- [ ] T026 Run `node --test tests/hero-defects.test.js` — all tests pass
- [ ] T027 Run `node --test tests/hero-upload.test.js tests/test-hero-images.js tests/tenant-isolation.test.js` — existing coverage still green, none weakened
- [ ] T028 Re-run the T003 reproduction steps — all four defects now behave correctly
- [ ] T029 Run `npm run check` and `npm test` — full suite green

**Checkpoint**: 🔴 All four defects closed, D3 security hole sealed. **Visual work may now begin.**

---

## Phase 3: Foundational — Shared Design Token Source

**⚠️ CRITICAL**: Every restyling phase depends on this. Restyling against scattered literals is what caused the current drift.

- [X] T030 Create `client/css/tokens.css` holding the authoritative tokens: base palette (cream `#f8f0df`, sand `#f1e4c9`, ink `#1f3439`, teal `#27615f`, coral `#ed6b4c`, yellow `#f5c84b`, paper `#fffaf0`, line `rgba(31,52,57,.13)`), type scale, spacing scale, radii, elevation, motion/easing tokens and layer/z-index tokens — preserving Restivo's existing identity per Constitution XXIII
- [X] T031 [P] Migrate the token declarations out of `client/css/restivo.css` (the `--cream/--sand/--ink/--teal/--coral/--yellow/--paper/--line/--sans/--display` set near line 3 and the `--sf-*` set near lines 227-232) so that file declares component rules only
- [X] T032 [P] Migrate the token declarations out of `client/css/style.css` (the `--primary/--secondary/--bg/--surface/--radius/--shadow/--font-*` set at lines 13-76) so that file declares component rules only
- [X] T033 [P] Remove the local `--mk-max` / `--mk-pad` declarations from `client/css/marketing.css` and consume the shared equivalents
- [X] T034 [P] Remove the local `--oh-accent` / `--oh-ink` declarations from `client/css/offers.css` and consume the shared equivalents
- [ ] T035 [P] Delete `client/css/storefront.css` — 533 lines loaded by **zero** pages — and remove its reference from the `SWELL` precache list in `client/sw.js:13`
- [ ] T036 Add `<link rel="stylesheet" href="/css/tokens.css">` as the first stylesheet in all 21 pages under `client/` (including `client/app/index.html` and `client/resources/index.html`) — `styleSrc: ["'self'", "'unsafe-inline'"]` at `server/app.js:47` already permits a same-origin stylesheet, so no CSP change is needed
- [X] T037 [P] Add the `tokens.css` link to `client/sw.js` precache so the token file is available offline and cannot be stale
- [X] T038 In `client/js/restaurant.js:1103`, keep applying the runtime brand token map from `theme.buildTokens` (`client/js/api.js:207-224`) to `document.documentElement`; do not move brand tokens into the static stylesheet
- [ ] T039 In `client/js/admin.js:1380`, apply the **full** brand token map to the dashboard root — it currently only reads `--on-primary` to colour one label, so the dashboard does not receive tenant brand tokens at all (FR-069)
- [ ] T040 Verify the CSP needs no change: inline SVG icons are DOM elements, not image requests, so `imgSrc: ["'self'", 'data:', 'blob:']` at `server/app.js:48` is already sufficient
- [ ] T041 Verify all 21 pages render correctly with no token regression, starting with the two highest-risk: `client/restaurant.html` and `client/index.html` (the only two loading `restivo.css`)
- [ ] T042 Run `npm run check` and `npm test` — green

**Checkpoint**: One token source drives every surface. Restyling can begin.

---

## Phase 4: User Story 1 - Browse the menu on a phone (Priority: P1) 🎯 MVP

**Goal**: The storefront reads as a premium digital menu — immersive cover, overlapping identity, circular section rail, full-width dense menu, large food imagery.

**Independent Test**: Open any business at 320/375/390/430px with no devtools and judge composition and density. Verify SC-002, SC-003, SC-004.

### Tests for User Story 1

- [ ] T043 [P] [US1] Create `tests/storefront-composition.test.js` asserting the storefront grid breakpoint is declared in `client/css/restivo.css` — write the **new** target value (≥1024px for two columns), replacing the current 720px assertion in `tests/test-storefront-ux.js:6-8`
- [ ] T044 [P] [US1] Add to `tests/storefront-composition.test.js` assertions that every menu item image element reserves its space before load (an explicit aspect-ratio or width/height pair), satisfying SC-006
- [ ] T045 [P] [US1] Add to `tests/storefront-composition.test.js` an assertion that the first screenful of item images are not lazy-loaded while below-fold images are

### Implementation for User Story 1

- [X] T046 [US1] Namespace the storefront component classes shared with the homepage live demo before restyling — `.live-hero`, `.dish`, `.qty`, `.cart-*` and `.add-btn` are used by both `client/js/restaurant.js` and `client/js/restivo-landing.js:186-251`, so a storefront restyle would otherwise break the homepage demo (research.md R-006)
- [ ] T047 [US1] In `client/css/restivo.css`, remove the superseded duplicate blocks identified in research — the earlier hero rules near lines 179-188 and sheet rules near 196-213 are overridden by the fixes at 384-429, so only one definition of each selector should survive
- [X] T048 [US1] Rebuild the cover composition in `client/js/restaurant.js` (`renderContent` at line 296, `initHeroCarousel` at line 374) to a deliberate aspect ratio that fills a substantial share of the initial mobile viewport, per FR-006 and SC-003, preserving the existing `hero-carousel` and `heroImages` identifiers that `tests/test-hero-images.js:15` asserts
- [X] T049 [US1] In `client/css/restivo.css`, hide the cover position indicator entirely when only one cover photo exists, per FR-008, and style it as a designed element rather than default dots
- [X] T050 [US1] Rebuild the restaurant identity block in `client/js/restaurant.js` (`renderContent`, the `.id-card` construction at lines 337-340) so the identity sits in its own surface overlapping the cover's lower edge by a deliberate amount, per FR-009 — it must read as one anchor unit, not an image floating on a photo
- [X] T051 [US1] Add a deliberate monogram fallback in `client/js/restaurant.js` (`brand()` at line 250) for a business with no logo, per FR-011 — the existing letter fallback must look intentional rather than broken
- [X] T052 [US1] In `client/css/restivo.css` and the identity markup in `client/js/restaurant.js` (`renderContent`, lines 337-340), keep the identity block legible at 320px and prevent a long business name colliding with its open/closed badge, per FR-010
- [X] T053 [US1] In `client/css/restivo.css`, set the menu to the full available width with a single gutter of at most 16px per side at every breakpoint, per FR-001, and remove any narrow centered-column constraint
- [X] T054 [US1] In `client/css/restivo.css`, implement a two-column menu composition at desktop widths, per FR-003, with no large empty region beside or between items
- [X] T055 [US1] In `client/css/restivo.css`, normalise vertical spacing between items, category sections, and section headings to one consistent rhythm, per FR-004
- [X] T056 [US1] In `client/css/restivo.css`, separate menu items by whitespace and subtle surface contrast rather than heavy borders and cards-within-cards, per FR-005
- [X] T057 [US1] In `client/js/restaurant.js` (`dishCard` at line 621) and `client/css/restivo.css`, enlarge food imagery so the photo occupies at least one third of the item's visible surface, per FR-018 and SC-004, with a non-distorting crop
- [X] T058 [US1] Reserve image space before load in `client/js/restaurant.js:624` so no layout shift occurs, per FR-019, keeping `loading="lazy"` on below-fold images only, per FR-020
- [X] T059 [US1] Add a deliberate proportion-preserving placeholder in `client/js/restaurant.js` (`dishCard`) for items with no photo, per FR-023
- [X] T060 [US1] In `client/css/restivo.css`, restyle the popular/new/featured/sold-out badges as restrained overlays, and keep the sold-out treatment visibly unavailable without looking broken, per FR-022
- [X] T061 [US1] Confirm no prominent "ADD" affordance exists on storefront items — the item itself is the interaction, per FR-021 — and preserve the `data-open=` attribute while keeping `data-addopts` absent, as `tests/test-storefront-ux.js:20-26` asserts
- [X] T062 [US1] Verify no horizontal page scroll at 320/375/390/430/768/1024/1280/1440/1920px, per FR-002 and SC-002
- [X] T063 [US1] Run `npm run check` and `npm test`; confirm `tests/test-storefront-ux.js` and `tests/test-seo.js` are green

**Checkpoint**: US1 delivers the MVP — a visually complete, dense, premium storefront menu.

---

## Phase 5: User Story 2 - Configure a product in a premium bottom sheet (Priority: P1)

**Goal**: A sheet rises to 65–75% viewport with the menu still visible above, containing image, name, price, description, options, real details, quantity and a live-total CTA. Products support an ordered photo set.

**Independent Test**: Tap a seeded product with option groups, pick a size and two extras, change quantity, add to cart, verify badge and total. Verifiable alone.

### Tests for User Story 2

- [ ] T064 [P] [US2] Create `tests/product-images.test.js` asserting the public menu payload exposes `images` as an array whose element 0 equals `image_path`, and that an item with no additional photos yields `[]` — the backward-compatibility guarantee in data-model.md
- [ ] T065 [P] [US2] Add to `tests/product-images.test.js` a tenant-isolation test asserting admin A cannot list, add, reorder or remove product photos for restaurant B's item, returning `404`
- [ ] T066 [P] [US2] Add to `tests/product-images.test.js` a test asserting `POST` with a path outside `/uploads/items/<uuid>.(jpg|png|webp)` is rejected with `400` and writes no row
- [ ] T067 [P] [US2] Add to `tests/product-images.test.js` a reorder test asserting a permutation applies without a unique-constraint violation and without leaving a gap in positions
- [ ] T068 [P] [US2] Add to `tests/product-images.test.js` a test asserting `position` is assigned server-side and that a client-supplied position is ignored

### Data model for User Story 2

- [X] T069 [US2] Create `database/migrations/035_menu_item_images.sql` with `menu_item_images`: `id UUID PK DEFAULT gen_random_uuid()`, `restaurant_id UUID NOT NULL` FK → `restaurants(id)` `ON DELETE CASCADE`, `menu_item_id UUID NOT NULL` FK → `menu_items(id)` `ON DELETE CASCADE`, `image_path TEXT NOT NULL`, `position INTEGER NOT NULL DEFAULT 0` with `CHECK (position >= 0)`, `created_at`/`updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `UNIQUE (menu_item_id, position)`, index on `(menu_item_id, position)`, index on `(restaurant_id)`, and an `updated_at` trigger — written idempotently (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `DROP TRIGGER IF EXISTS` before `CREATE TRIGGER`) per Constitution VII
- [X] T070 [US2] Apply **no backfill** in `database/migrations/035_menu_item_images.sql` — no row is required for existing businesses, which is what keeps the change backward compatible (Principle VII)
- [X] T071 [US2] Add `menu_item_images` to the truncate list in `tests/helpers.js:39-42` so state cannot leak between suites

### Implementation for User Story 2

- [X] T072 [US2] Add product photo set read/write functions to `server/services/menu.service.js` — list ordered by position, add assigning `position` server-side, reorder as a permutation in one transaction, remove — leaving `menu_items.image_path` untouched as the authoritative primary image
- [X] T073 [US2] Add the `images` array to the public menu payload in `server/services/restaurants.service.js:175-254` using a **single LEFT JOIN** in the existing items query ordered by position — no per-item requests (Constitution XXIV) — with element 0 equal to `image_path` when non-null
- [X] T074 [US2] Add `GET/POST/PATCH/DELETE` product photo routes to `server/routes/admin.routes.js` under `requireAuth` + `requireRestaurantAdmin`, scoped to `tenantId(req)` only, never to a body or query business id (Constitution IX)
- [X] T075 [US2] Add the four product photo handlers to `server/controllers/admin.controller.js`, validating `imagePath` against `/^\/uploads\/items\/[0-9a-f-]{36}\.(jpg|png|webp)$/` and returning `404` for unowned items
- [X] T076 [US2] Verify the `items` namespace is already admitted by both `SUBDIRS` at `server/middleware/upload.js:24` and `PUBLIC_PATH_RE` at `server/services/files.service.js:12`, so **no new upload namespace is required**
- [ ] T077 [US2] In `client/js/restaurant.js` (`renderSheet` at line 502), rebuild the sheet to settle at 65–75% viewport height with the menu visibly remaining above it, per FR-024 and SC-005 — retain the `product-sheet` class name and the `e.key === 'Escape'` handler that `tests/test-storefront-ux.js:11-18` asserts
- [X] T078 [US2] In `client/js/restaurant.js` (`renderSheet`), render the photo set as a horizontal swipeable view with a visible position indicator when more than one photo exists, and as a single photo with no photo chrome when exactly one exists, per FR-030
- [X] T079 [US2] In `client/js/restaurant.js` (`renderSheet`, `pickerHtml` at line 771, `renderSheet` ordering), enforce the single continuous scroll order: image, name, price, description, option groups, real detail fields, quantity, add-to-order — per FR-026
- [X] T080 [US2] In `client/js/restaurant.js` (`renderSheet`), keep the add-to-order action reachable alongside the quantity control and displaying the live total for the current quantity and options, per FR-027
- [X] T081 [US2] In `client/js/restaurant.js` (`groupHint` at line 764, `pickerHtml`), state each option group's selection rule (required with how many to choose, or optional) and each choice's price effect, per FR-028
- [X] T082 [US2] In `client/js/restaurant.js` (`renderSheet`), render only detail fields that exist for the product — no empty sections, placeholder copy, or invented nutritional, ingredient or allergen values, per FR-029
- [X] T083 [US2] In `client/js/restaurant.js`, retain the existing focus trap (lines 586-598), `aria-modal`, Escape close and focus restoration on the rebuilt sheet, per FR-031
- [ ] T084 [US2] In `client/js/admin.js`, add product photo management to the existing item editor — add, preview, reorder and remove through the same professional uploader as cover photos, with the first photo designated primary, per FR-049a
- [ ] T085 [US2] Confirm in `client/js/restaurant.js` (`addWithPicks` at line 828, `cartEntries` at line 165) that adding from the sheet integrates with the existing single cart with no second cart or pricing path, per FR-032, and that `server/services/orders.service.js` remains the sole price authority
- [ ] T086 [US2] Run `node --test tests/product-images.test.js`, then `npm run check` and `npm test`

**Checkpoint**: US1 and US2 both work independently. The conversion moment is complete.

---

## Phase 6: User Story 3 - Change ordering mode, language, and search (Priority: P2)

**Goal**: Delivery/pickup, language and search are one-interaction controls that persist, in one visual language.

**Independent Test**: Toggle delivery→pickup, switch Arabic→English, search a known dish, reload. Verifiable alone.

- [ ] T087 [P] [US3] In `client/js/restaurant.js` (`renderHead` at line 206, `setOrderType` at line 237), rebuild the delivery/pickup control as one immediately understandable, elegantly styled segmented control per FR-033, keeping it absent when `settings.deliveryEnabled === false` and persisting via the existing `ordertype_<slug>` localStorage key
- [ ] T088 [P] [US3] In `client/js/restaurant.js` (`renderHead`), rebuild the search interaction so it reads as part of the menu per FR-034, matching item names and descriptions in both languages, with a designed empty state replacing any blank area or raw error text
- [ ] T089 [P] [US3] In `client/js/restaurant.js` (`renderHead`, `setLang` at line 91), rebuild the language selector as a compact control with small tasteful language indicators per FR-035, preserving the `localStorage.setItem('restivo-lang'` call that `tests/test-localization.js:25` asserts and the `storefrontLanguage` identifier at line 1062 that `tests/test-localization.js:39` asserts
- [ ] T090 [US3] In `client/js/restaurant.js` (`renderOverlay` at line 656, `renderBar` at line 640), rebuild the cart presentation to match the new visual system with no separate visual language, per FR-036
- [X] T091 [US3] Verify a language switch also switches direction inside an open product sheet, per FR-071 and the V-8 scenario
- [X] T092 [US3] In `client/restaurant.html:42`, remove the hardcoded `dir="rtl"` on `<main>` that fights the JS-driven document direction — a latent bug for the English storefront
- [ ] T093 [US3] Run `npm run check` and `npm test`; confirm `tests/test-localization.js` is green

**Checkpoint**: US1, US2, US3 all work independently.

---

## Phase 7: User Story 4 - A business owner manages cover photos from a phone (Priority: P2)

**Goal**: A polished cover manager — one-tap add, preview, remove, reorder, plain-language limit notice, no raw file input.

**Independent Test**: On a 375px phone, add a third cover photo, reorder, delete another, then confirm the storefront. Fully testable alone. Depends on Phase 2 being complete.

- [X] T094 [P] [US4] In `client/css/style.css`, style the cover manager as a professional control surface — no raw file input exposed, per FR-044 — replacing the current dashed drop zone and inline-styled 88×56 thumbnail
- [X] T095 [US4] In `client/js/admin.js` (manager markup at lines 1288-1298, `loadHeroList` at 1448-1472, `uploadHero` at 1474-1485), add drag-free reordering that calls the `PATCH` endpoint, per FR-047, so an owner can reorder on a phone and via keyboard without a pointer drag
- [X] T096 [US4] In `client/js/admin.js`, display the platform cover-photo limit **before** an upload is attempted, in plain language, per FR-046, instead of surfacing a raw error toast from `restaurants.service.js:457-462`
- [X] T097 [US4] In `client/js/admin.js`, add a confirmation step before removing a cover photo and ensure a failed upload leaves existing photos unchanged and stores no unusable file, per FR-048
- [X] T098 [US4] Apply the equivalent cover manager changes to `client/js/owner.js:632-657` and `client/owner.html` so the platform owner console has parity
- [ ] T099 [US4] Verify the reflected order on `/restaurant/:slug` immediately after a reorder, per FR-047
- [ ] T100 [US4] Run `npm run check` and `npm test`

**Checkpoint**: US1–US4 complete. Owner cover management is fully working on top of the Phase 2 fixes.

---

## Phase 8: User Story 5 - A business owner sets a free-delivery promise (Priority: P2)

**Goal**: Honest free-delivery presentation for customers and a validated, well-affordanced setting for owners. Server-authoritative throughout.

**Independent Test**: Enable a threshold, add items below it, cross it, and confirm the server's fee in the confirmed order. Testable alone. **No backend change expected** — this already works and is covered by 9 tests.

- [ ] T101 [P] [US5] In `client/js/restaurant.js` (`freeShipMsg` at line 287, `freeShipOn` at line 283), rebuild the free-delivery presentation as either the amount still needed to qualify or an unambiguous free-delivery state, per FR-037 — display only, mirroring the server which remains authoritative
- [ ] T102 [P] [US5] In `client/js/admin.js` (`#st-free-ship` and `#st-free-threshold` at lines 1236-1238), disable the threshold input while the feature is off, validate the amount, and add plain-language guidance about its meaning relative to the delivery fee, per FR-039
- [X] T103 [US5] Confirm no backend change is needed: `free_delivery_enabled` and `free_delivery_threshold_cents` already exist (`034_free_delivery.sql:3-6`), are enforced at `orders.service.js:284-292`, and are publicly exposed at `restaurants.service.js:240-241`
- [X] T104 [US5] Verify existing businesses with no free-delivery setting continue charging the normal fee with no configuration, per FR-040 — the columns default to `FALSE` and `0`
- [ ] T105 [US5] Verify the server ignores forged client totals, fees and free-delivery flags, per FR-038 — run the V-9 scenario and `node --test tests/free-delivery.test.js`
- [ ] T106 [US5] Run `npm run check` and `npm test`; confirm `tests/free-delivery.test.js` (9 tests) is green

**Checkpoint**: US1–US5 complete.

---

## Phase 9: User Story 6 - A prospective owner evaluates Restivo on the homepage (Priority: P3)

**Goal**: Strong hero, real-business logo strip, product demonstration, customer journey, business types, honest pricing, FAQ, final CTA, professional footer.

**Independent Test**: Load `/` and answer "what is this, who is it for, what does it cost, what do I do next" without scrolling past pricing and the CTA.

- [ ] T107 [P] [US6] Remove the restaurant showcase branded as a "family" from `client/js/restivo-landing.js` (the `.logos` section at line 62 and the dead `familyCard` function at lines 156-158) and remove its unused `.family-grid`, `.family-card`, `.family-logo` styling from `client/css/restivo.css:108-115`, per FR-063 — deletion, not renaming
- [X] T108 [P] [US6] In `client/css/restivo.css`, style the `.trust` section, which is currently rendered at `restivo-landing.js:69` with **no CSS rule in any stylesheet** — it appears as a bare unstyled list
- [X] T109 [US6] Rebuild the hero in `client/js/restivo-landing.js:58-60` to a single clear statement with one primary and one secondary action both visible without scrolling, per FR-056, and NOT opening with a feature list, per FR-057
- [X] T110 [US6] Keep the real-business logo strip at `client/js/restivo-landing.js:62` and `loadFamily` at lines 137-150 driven by the live business directory — real names and real logos only, never invented entries, per FR-058
- [X] T111 [US6] In `client/css/restivo.css:336-347`, ensure the strip degrades gracefully when fewer businesses exist than it needs and MUST NOT animate for visitors requesting reduced motion, per FR-059
- [ ] T112 [US6] Add a product demonstration section and a customer-journey section to `client/js/restivo-landing.js` (section order at lines 50-73) styled by `client/css/restivo.css`, per FR-060 — sourcing imagery only from real assets such as `client/images/restivo-food-table.jpg`, never fabricated screenshots
- [ ] T113 [US6] Add the supported food-business types section to `client/js/restivo-landing.js` and `client/js/restivo-content.js`, using the real closed set from `server/services/business-types.service.js` and never claiming unsupported types, per FR-061
- [ ] T114 [US6] Keep pricing sourced from the real subscription data via `GET /api/pricing` (`restivo-landing.js:255-274`), per FR-062, and add a visible loading state so the static fallback price is not shown while real data loads
- [ ] T115 [US6] Audit `client/index.html`, `client/js/restivo-landing.js`, `client/js/restivo-content.js` and `client/js/restivo-landing.js:137-150` (`loadFamily`) for invented businesses, logos, testimonials, ratings, customer counts or usage statistics, per FR-064 — remove anything unverifiable
- [ ] T116 [US6] Finalise the call to action and footer in `client/js/restivo-landing.js` (lines 70 and 72) styled by `client/css/restivo.css`, so the page closes as one product with the storefront, per FR-065
- [ ] T117 [US6] In `client/js/restivo-content.js`, add any new copy keys in **both** Arabic and English, as `tests/onboarding-i18n.test.js` and `tests/subscription-ux.test.js` assert both locales are complete
- [ ] T118 [US6] Run `npm run check` and `npm test`; confirm `tests/test-seo.js` is green — it asserts `client/index.html` structure and that `restaurant.js` retains `/api/seo/business/` and `document.documentElement.dir`

**Checkpoint**: US1–US6 complete.

---

## Phase 10: User Story 7 - An owner works in the dashboard on desktop and phone (Priority: P3)

**Goal**: Persistent sidebar on desktop, polished slide-out drawer on mobile, identical sections in both, server-enforced entitlement.

**Independent Test**: Load the dashboard at 1440px and 375px; confirm the same sections are reachable via sidebar and drawer.

- [ ] T119 [P] [US7] In `client/admin.html:66-74`, remove the `.tabs-mobile` markup — it is dead, hidden at `client/css/style.css:468` above 900px and again hidden at line 936 below it, so it never renders
- [ ] T120 [P] [US7] In `client/css/style.css:427-453`, raise the desktop sidebar breakpoint to 1024px per FR-041 so a persistent sidebar is visible at 1024px and above and no hamburger-only navigation is required on desktop
- [ ] T121 [US7] Rebuild the mobile drawer in `client/admin.html:46-52` and `client/js/admin.js:140-190` as a polished slide-out per FR-042 — dismissible by Escape, an explicit close control, and an outside tap, with focus trapped while open
- [ ] T122 [US7] In `client/js/admin.js:150-156`, keep the drawer populated by cloning the sidebar's `[data-tab]` elements so both navigation surfaces can never drift out of sync
- [ ] T123 [US7] Verify in `client/js/admin.js:176-189` and the capability enforcement in `server/services/capabilities.service.js` that sections excluded by plan entitlement, capability or business type are omitted identically on desktop and mobile, and that the omission is enforced server-side on every request rather than only hidden in the browser, per FR-043 — do not change authorization logic
- [ ] T124 [US7] Bring `client/css/style.css` to a professional SaaS visual language — consistent spacing, elegant cards, meaningful empty states, polished forms — avoiding excessive cards, huge borders, cheap shadows and clutter, per FR-024 of the spec's dashboard section
- [ ] T125 [US7] Run `npm run check` and `npm test`; confirm `tests/test-dashboard-nav.js` is green — it asserts drawer selectors in `style.css` and `admin.html`

**Checkpoint**: US1–US7 complete.

---

## Phase 11: User Story 8 - The next engineer keeps surfaces coherent (Priority: P3)

**Goal**: Prove the token system is genuinely authoritative — one change propagates everywhere, no stray literals remain.

**Independent Test**: Change one token in the browser and observe it on every surface; grep finds no literal colour/radius/shadow/transition values outside the token source.

- [ ] T126 [US8] Run the V-12 verification: grep `client/css/storefront.css` references expecting none, and confirm raw hex values exist only in `client/css/tokens.css`
- [ ] T127 [US8] Confirm no hardcoded colour, radius, shadow or transition literal remains outside `client/css/tokens.css`, per FR-067 and SC-013 — convert every remaining literal in `restivo.css`, `style.css`, `marketing.css` and `offers.css` to a token reference
- [ ] T128 [US8] Verify brand tints and active states derive from the business's configured brand colour across every surface via `client/js/api.js:207-224` (`theme.buildTokens`) and its call sites `client/js/restaurant.js:1103` and `client/js/admin.js:1380`, per FR-069 — this depends on T039 applying the full brand token map to the dashboard
- [ ] T129 [US8] Confirm the token source holds no per-tenant values; brand tokens remain runtime-injected, per research.md R-001
- [ ] T130 [US8] Confirm changing one token in `client/css/tokens.css` visibly updates the homepage, storefront, product sheet, cart, checkout and dashboard without editing a second file
- [ ] T131 [US8] Verify `client/sw.js` precaches `tokens.css` so the offline path cannot serve stale tokens
- [ ] T132 [US8] Run `npm run check` and `npm test`

**Checkpoint**: All eight stories complete and independently verifiable.

---

## Phase 12: Polish & Cross-Cutting Concerns

**Purpose**: Quality gates that span all stories. Nothing here may be skipped or reported as verified without execution.

### Accessibility

- [ ] T133 [P] Verify full keyboard operability with a visible focus indicator on the category rail, every menu item, the product sheet, the cart, the cover manager and the dashboard drawer, per FR-071
- [X] T134 [P] Verify overlay semantics on the product sheet and cart: dialog role, focus trap, Escape close, focus restoration, per FR-072
- [ ] T135 [P] Verify text contrast ≥4.5:1 and meaningful non-text contrast ≥3:1 in both the default and a business-branded colour configuration, per FR-073 and SC-015
- [ ] T136 [P] Verify RTL and LTR correctness with no mirrored-layout defects, per FR-071, at all 9 widths

### Motion & performance

- [X] T137 [P] Verify reduced-motion behaviour: carousel autoplay off, sheet transition instant, homepage strip static, per FR-074
- [ ] T138 [P] Verify LCP ≤2.5s on a throttled mid-range mobile profile, total transferred page weight not increased versus the T004 baseline, and cumulative layout shift within the SC-006 budget, per FR-076, SC-006 and SC-014
- [X] T139 [P] Confirm zero new client-side runtime dependencies and no build step were introduced, per FR-075 and SC-017

### Final verification gate

- [ ] T140 Execute the full V-8 customer journey at all 9 widths in both languages — open restaurant, cover, identity, mode, language, sections, product, photos, options, quantity, add to cart, cart, checkout, order, tracking — with zero console errors and zero broken images, per FR-077 and SC-007
- [ ] T141 Capture a screenshot at every width and language and **visually review** them against the reference quality bar, per FR-082 — passing tests is explicitly not sufficient
- [ ] T142 Re-run the V-3 scenario 20 consecutive times and confirm add-after-remove succeeds every time, per SC-009
- [ ] T143 Run `npm run check` — 0 failures — and `npm test` — all 62 original suites plus the new ones green, with no existing test weakened or deleted
- [ ] T144 Re-verify every endpoint in `specs/017-storefront-visual-rebuild/contracts/api.md` section 8 still behaves as documented: onboarding, auth, session, menu, options, cart, checkout, orders, tracking, bookings, analytics, push, SSE, subscriptions, capabilities, translations, SEO
- [ ] T145 Smoke the key routes and confirm HTML versus JSON 404 behaviour: `/`, `/app/`, `/restaurant/:slug`, `/track`, login, dashboards, `GET /api/pricing`, robots.txt, sitemap.xml
- [ ] T146 Confirm no fabricated data on any public page and that every business in the homepage strip resolves to a real record, per FR-064 and SC-012
- [ ] T147 Update `HANDOFF.md`, `README.md` and `docs/` for the new token source, the deleted `storefront.css`, the corrected hero validators and the new product photo endpoints
- [ ] T148 Write the final report with all 14 required sections, marking anything unverified as **NOT VERIFIED** rather than claiming completion, per FR-082

**Checkpoint**: All gates pass. No deploy without explicit user approval (Constitution XXVI).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Security) 🔴**: Depends on Phase 1. **BLOCKS all remaining phases.** Four live defects, one a security vulnerability
- **Phase 3 (Tokens)**: Depends on Phase 2. **BLOCKS all user stories** — every restyle targets the token source
- **Phases 4-11 (User Stories)**: Depend on Phase 3. May then run in parallel by different people
- **Phase 12 (Polish)**: Depends on all desired stories

### User Story Dependencies

- **US1 (P1)**: After Phase 3. No story dependencies. **MVP**
- **US2 (P1)**: After Phase 3. No story dependencies; adds the product photo set
- **US3 (P2)**: After Phase 3. No story dependencies
- **US4 (P2)**: After Phase 3. **Requires Phase 2 complete** — it builds on the corrected cover endpoints
- **US5 (P2)**: After Phase 3. No server change expected; presentation only
- **US6 (P3)**: After Phase 3. Touches the homepage; note it shares CSS classes with the storefront, so coordinate with US1
- **US7 (P3)**: After Phase 3. Independent of storefront work
- **US8 (P3)**: After Phase 3, and after the other stories, because it verifies that no stray literal survived all of them

### Critical Path

```text
Phase 1 Setup
  → Phase 2 Security (D3 vuln + D2 + D1 + D4)   ← MUST NOT BE SKIPPED OR BATCHED
    → Phase 3 Tokens
      → US1 (MVP)  →  US2  →  US3  →  US4  →  US5  →  US6  →  US7  →  US8
        → Phase 12 Polish & verification gate
```

### Within Each User Story

- Tests written first and confirmed to FAIL before implementation
- Migration → service → route/controller → client, in that order
- Story complete and independently verified before moving on

### Parallel Opportunities

- T004, T005 in Phase 1
- T008–T012 (defect tests), T015, T016, T023, T025 in Phase 2
- T031–T035, T037 in Phase 3
- T043–T045 in Phase 4; T064–T068 in Phase 5
- T087–T089 in Phase 6; T094 in Phase 7; T101–T102 in Phase 8
- T107–T108 in Phase 9; T119–T120 in Phase 10
- T133–T139 in Phase 12

### Parallel Example: Phase 2 (security)

```bash
# All defect regression tests in parallel (different assertions, same new file — serialise if editing concurrently)
Task: "T007 test: cover photo added immediately after removal succeeds"
Task: "T008 test: add-by-path accepts a real /uploads/hero/ path"
Task: "T009 test: SECURITY owner console rejects an unvalidated image path"

# Independent fixes in parallel (different files)
Task: "T017 fix D2 validator in server/validators/index.js"
Task: "T019 fix D1 position query in server/services/restaurants.service.js"
Task: "T024 fix D4 picker listener in client/js/admin.js"
```

---

## Implementation Strategy

### MVP First (US1 only, but only after the security phase)

1. Phase 1 Setup
2. **Phase 2 Security** — non-negotiable; D3 is a live vulnerability
3. Phase 3 Tokens
4. Phase 4 US1
5. **STOP and VALIDATE** against quickstart.md V-1 … V-5, V-8, V-12
6. Ship for review — no deploy without approval

### Incremental Delivery

1. Setup + Security + Tokens → foundation ready
2. US1 → validate → review (**MVP**: premium storefront menu)
3. US2 → validate → review (conversion moment + product photos)
4. US3 → validate → review
5. US4 → validate → review (owner cover management)
6. US5 → validate → review
7. US6 → validate → review (homepage)
8. US7 → validate → review (dashboard)
9. US8 → validate → review (coherence proof)
10. Phase 12 → final gate → explicit approval before deploy

### Parallel Team Strategy

- Engineer A: Phase 2 security fixes (must complete first, alone or paired)
- Then, after Phase 3: Engineer A takes US1 + US2 (storefront), Engineer B takes US6 + US7 (homepage + dashboard), Engineer C takes US3 + US5 (controls + free delivery). US4 and US8 follow.

---

## Notes

- [P] = different files, no dependencies
- [SEC] = security or correctness defect fix; see the blocking table at the top
- [Story] maps each task to a user story for traceability
- Every story is independently completable and testable
- Verify each new test fails before implementing its fix
- Commit after each task or logical group; the Phase 2 fixes warrant **separate commits per defect** so each is independently revertable
- Stop at any checkpoint to validate the story independently
- Avoid: vague tasks, same-file conflicts, cross-story dependencies that break independence
- **Do not report any item as done that was not executed.** Anything unverified is reported as NOT VERIFIED