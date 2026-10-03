# Implementation Plan: Storefront Visual Rebuild & MenuX-Grade Design Quality

**Branch**: `017-storefront-visual-rebuild` | **Date**: 2026-10-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/017-storefront-visual-rebuild/spec.md`

## Summary

Rebuild Restivo's storefront presentation — plus the homepage and dashboard — so that visual quality matches the commercial menu benchmark, while every backend contract, authorization rule and money calculation stays exactly as it is. The work is sequenced **defects → tokens → presentation**, because the four live hero-image defects are correctness bugs that must not be buried inside a visual rewrite, and the shared token source must exist before any surface is restyled against it.

The only schema change is an **additive** per-product photo set that leaves `menu_items.image_path` authoritative for the primary image, so every existing consumer keeps working untouched.

**Technical approach**: One new universal stylesheet (`client/css/tokens.css`) holds the authoritative palette, spacing, type scale, radii, elevation, motion and layer values, loaded by all 21 pages. Per-tenant brand tokens continue to be injected at runtime by the existing `theme.buildTokens`. `restivo.css`, `style.css`, `marketing.css` and `offers.css` keep their page-specific component rules but stop declaring tokens. The dead 533-line `storefront.css` is deleted and unlinked from the service worker. The storefront's 1179-line single-IIFE script is restructured in place — no framework, no build step, no new dependency.

## Technical Context

**Language/Version**: Node.js 20 (server); vanilla ES2020 JavaScript, no build step, no TypeScript (client)

**Primary Dependencies**: express 4.21, pg, express-session + connect-pg-simple, helmet, express-rate-limit, bcryptjs, qrcode, web-push, multer 2.0. No new dependency permitted (FR-075)

**Storage**: PostgreSQL. Uploaded images are stored as `bytea` in `uploaded_files`, served by `server/app.js:78-91`. No ephemeral disk

**Testing**: `node --test tests/` (`npm test`) with mandatory `TEST_DATABASE_URL` on a disposable database; `npm run check` = `node scripts/check-syntax.js` (parse-only, all `.js`). 62 test files run; `tests/helpers.js` is the shared harness

**Target Platform**: Linux server, Node 20, deployed to Wasmer Edge (`app.yaml`). Clients: mobile browsers 320px+, desktop browsers

**Project Type**: Single-service web application — `express.static(client)` serving a vanilla multi-page front end plus JSON API

**Performance Goals**: Storefront first screenful usable ≤2.5s on a mid-range phone over 4G; transferred page weight must not increase; zero new client runtime dependencies; no layout shift >2px on the storefront (SC-006, SC-014, SC-017)

**Constraints**: Strict CSP with `default-src 'self'` and `script-src 'self'` (no inline scripts) — `style-src` permits `'unsafe-inline'`; `img-src 'self' data: blob:`; `font-src 'self'` so fonts must stay self-hosted; no build step; no horizontal page scroll at any of 9 required widths

**Scale/Scope**: Moderate — hundreds of businesses, ~1,000 orders/day, burst ~50 concurrent checkouts. Touches ~10 client files, ~6 server files, 1 new migration, 1 new stylesheet, 1 deleted stylesheet, 7 test files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Verdict | Evidence |
|---|---|---|---|
| I. Preserve Working Functionality | No user-visible behaviour removed unless demonstrably broken | **PASS** | The Current State Baseline in `spec.md` enumerates 13 working features that are re-skinned, not rebuilt. FR-078 names all 21 capabilities to preserve |
| II. No React Migration | Stay vanilla HTML/CSS/JS, no build | **PASS** | FR-075 forbids a new dependency and build step. The `restivo-landing-frontend/` React scaffold stays untouched and unreferenced |
| III. No Architecture Rebuild Without Evidence | No rewrite absent evidence architecture cannot cope | **PASS with justification** | This *is* a presentation rebuild, which is what the architecture is for. No route, controller, service or auth path is restructured. The one schema addition is additive only |
| IV. Inspect Before Deciding | Inspect code, migrations, tests, runtime before deciding | **PASS** | Two full codebase surveys, the reference-site design extraction, and five targeted verification passes were completed before this plan was written. All four defects verified at file:line |
| V. Code Is Source Of Truth | Current code beats stale docs | **PASS** | The reference's own repo is instructive: its `single.php` comment explicitly documents a refactor rationale that contradicts an inline comment elsewhere. `spec.md` follows code, and notes the reference's own inconsistency |
| VI. No Guessing on Shared Code | Trace all references before changing shared code | **PASS** | `menu_items.image_path` traced through 8 call sites; shared CSS classes between storefront and homepage demo identified; all 7 source-asserting test suites enumerated |
| VII. Safe Migration Strategy | Idempotent migrations, safe defaults, backward compatible | **PASS** | One additive migration. `menu_item_images` starts empty; the primary photo remains `menu_items.image_path`. Existing businesses change nothing |
| VIII. No Destructive Migrations | No `DROP`/`TRUNCATE`/lossy alter | **PASS** | No destructive statement in the plan. The position-collision fix is a one-line query change, not a constraint drop |
| IX. Tenant Isolation (NON-NEGOTIABLE) | Identity only from the authenticated DB record | **PASS** | No new tenant-scoped read path. Product-photo and hero-photo writes reuse `tenantId(req)`. A new tenant-isolation test is required (FR-055) |
| X. Do Not Weaken Security | No weakening of validation, sessions, CSP, uploads | **PASS — actively improves** | FR-051/FR-054 close an unvalidated-path insert in the owner console. FR-052 tightens rather than removes upload validation. CSP unchanged; new stylesheet is same-origin |
| XI. Dependencies Require Value | No new dependency without clear value | **PASS** | Zero new dependencies. Icons are hand-authored inline SVG; carousels and sheets reuse existing hand-rolled code, not a library |
| XII. Simplicity Over Abstraction | No single-use abstraction | **PASS** | The icon set is a flat literal replacing a flat literal. Photo sets reuse the existing hero-image service pattern rather than inventing a media abstraction |
| XIII. No Speculative Features | Nothing built "because it's possible" | **PASS** | Category photographs, nutrition fields and AVIF are explicitly deferred with recorded rationale rather than built speculatively |
| XIV. Purpose-Gated Features | Every feature has a named beneficiary | **PASS** | Customer (browse/configure/track), owner (manage cover, set free delivery, work in dashboard), prospective owner (evaluate honestly) |
| XV. Extremely Simple Customer Experience | Fewest steps, largest targets, plain language | **PASS** | FR-045 (one selection to upload), FR-014 (≥44px targets), FR-046 (limit explained before upload) |
| XVI. Guest Checkout Is Core | Ordering must not require an account | **PASS** | Untouched. The product sheet continues to add to a guest cart |
| XVII. No Payment Gateway | Out of scope | **PASS** | Not touched |
| XVIII. One System for All Food Businesses | No per-type forks | **PASS** | One storefront for all business types |
| XIX. Configurable Capabilities | Vary by config, not forks | **PASS** | Free-delivery threshold reuses the existing settings column pair |
| XX. i18n Foundations, No Premature System | No full i18n framework | **PASS** | No new framework. Storefront language persistence is reused verbatim |
| XXI. Honest SEO | Honest metadata, no fake structured data | **PASS** | FR-064 forbids fabricated proof. `test-seo.js` assertions preserved |
| XXII. No Fabricated Proof | No invented logos, testimonials, statistics | **PASS** | FR-064 plus the honest-empty-state requirement for the logo strip |
| XXIII. Preserve Restivo Visual Identity | Evolve within the system, no rebrand | **PASS** | Dark teal/navy, coral, warm yellow, cream retained as the token palette; the reference supplies *structure and quality*, not colours |
| XXIV. Reliability Over Feature Count | No N+1, unbounded loops, unsafe shared state | **PASS** | Photo sets load in the single existing menu query via one LEFT JOIN, not per-item requests |
| XXV. Tests Required; Never Weaken Tests | Every implementation has tests; fix code not expectations | **PASS with declared exception** | One test (`tests/test-hero-images.js:6-11`) asserts a regex that is itself the defect. FR-081 requires correcting that expectation *together with* the behaviour. It is corrected, not deleted or relaxed. Every other test is preserved — including 9 source-asserting string contracts the rebuild must not break |
| XXVI. Verify Against Spec and Plan | `npm run check` must pass; smoke key routes | **PASS** | `quickstart.md` defines the gate. No deploy without explicit approval |
| XXVII. Flag Weak Approaches | Flag rather than blindly implement | **PASS** | Three flagged: (1) the reported upload bug is already fixed server-side and the live defects are different ones; (2) category photographs would render empty and are deferred; (3) the reference's own product sheet is full-screen, conflicting with the brief's 65–75% — the brief wins |
| XXVIII. Ask When Ambiguous | Stop rather than invent semantics | **PASS** | Three questions were raised; the user delegated the decisions, which are recorded in `spec.md` Clarifications with rationale |

**Gate result: PASS.** One declared, justified exception (XXV) and three flagged observations (XXVII).

**Complexity Tracking** — no unjustified violations. One entry recorded for transparency:

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| One additive table (`menu_item_images`) | FR-030 requires a product photo carousel; products have exactly one image column today | Reusing `business_hero_images` would conflate two different owners and lifecycles behind a polymorphic table — harder to reason about than one small dedicated table |

## Project Structure

### Documentation (this feature)

```text
specs/017-storefront-visual-rebuild/
├── spec.md              # Feature specification (input)
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── api.md           # Phase 1 output — HTTP interface contract
└── checklists/
    └── requirements.md  # Specification quality checklist (21/21 pass)
```

### Source Code (repository root)

```text
client/
├── css/
│   ├── tokens.css           # NEW — authoritative design tokens, loaded by all 21 pages
│   ├── restivo.css          # EDIT — storefront + homepage components; token declarations removed
│   ├── style.css            # EDIT — dashboard/marketing components; token declarations removed
│   ├── marketing.css        # EDIT — drops its own --mk-* tokens, consumes shared
│   ├── offers.css           # EDIT — drops its own --oh-* tokens, consumes shared
│   ├── storefront.css       # DELETE — loaded by zero pages, unlink from sw.js
│   └── skeleton.css         # unchanged
├── js/
│   ├── restaurant.js        # EDIT — storefront rebuild (cover, identity, rail, icons, sheet, photos)
│   ├── admin.js             # EDIT — cover manager (drag-reorder, one-tap upload, limit notice)
│   ├── owner.js             # EDIT — cover manager parity
│   ├── restivo-landing.js   # EDIT — homepage narrative restructure
│   ├── restivo-content.js   # EDIT — homepage copy for new sections
│   ├── api.js               # EDIT — brand token application moved to shared hook
│   └── i18n.js              # EDIT — new keys only, both ar and en
├── restaurant.html          # EDIT — tokens.css link, dir fix, sheet carousel markup
├── admin.html               # EDIT — tokens.css link
├── owner.html               # EDIT — tokens.css link
├── index.html               # EDIT — tokens.css link
└── sw.js                    # EDIT — remove storefront.css, add tokens.css

server/
├── middleware/upload.js     # EDIT — `items` subdir already valid; product photo reuse
├── validators/index.js      # FIX — validateHeroImagePath accepts covers|hero
├── services/
│   ├── restaurants.service.js # FIX — hero position over all rows; primary reassignment
│   ├── menu.service.js      # EDIT — product photo set read/CRUD
│   └── files.service.js     # EDIT — public path regex
├── controllers/
│   ├── admin.controller.js  # FIX — duplicate position computation; product photo endpoints
│   ├── owner.controller.js  # FIX — attach upload middleware, validate path
│   └── public.routes.js     # EDIT — expose item images in menu payload
└── routes/admin.routes.js   # EDIT — product photo routes

database/migrations/
└── 035_menu_item_images.sql # NEW — additive photo set

tests/
├── hero-upload.test.js      # EDIT — add-after-remove regression
├── test-hero-images.js      # CORRECT — stale covers-only regex assertion
├── test-storefront-ux.js    # EDIT — updated breakpoint; preserved structural assertions
└── product-images.test.js   # NEW — photo set CRUD, isolation, backward compat
```

**Structure Decision**: Keep the existing monolith. `client/` remains a static multi-page front end served by `express.static`; `server/` keeps its `routes → controllers → services → parameterized SQL` layering. No new directory, no new service, no framework. The token source is a sibling stylesheet rather than a new build artifact because the project has no build step and adding one would violate both FR-075 and Constitution II.

## Phase Sequencing

Ordering is dependency-driven, not cosmetic.

| # | Phase | Depends on | Gate to proceed |
|---|-------|-------------|-----------------|
| 1 | Hero-image defect fixes (correctness) | — | Regression tests green |
| 2 | Shared token source | — | All 21 pages render; `npm run check` passes |
| 3 | Product photo sets | 1 (same upload pattern) | Migration applies; existing item tests unchanged |
| 4 | Storefront composition rebuild | 2 | Visual review at 9 widths |
| 5 | Section rail + vector icons | 2, 4 | `catEmoji` fully removed |
| 6 | Product sheet rebuild + photo carousel | 3, 4 | `test-storefront-ux.js` green |
| 7 | Ordering controls, cart, free-delivery presentation | 4 | Journey walkthrough passes |
| 8 | Dashboard navigation + visual language | 2 | `test-dashboard-nav.js` green |
| 9 | Homepage restructure | 2 | `test-seo.js` green |
| 10 | Accessibility, performance, RTL, full verification | all | `quickstart.md` gate passes |

## Source-Asserting Test Contracts (must survive the rebuild)

Seven suites read client source strings. Verified assertions the rebuild must preserve:

| Test | Must contain | Risk |
|---|---|---|
| `test-storefront-ux.js` | `restivo.css` has the grid breakpoint value (**currently `720px` — value will change, intent preserved**) | Value must be updated, not deleted |
| `test-storefront-ux.js` | `restaurant.js` has `product-sheet`, `aria-modal`, `e.key === 'Escape'`; CSS has `.product-sheet` | Keep class name and Escape handler shape |
| `test-storefront-ux.js` | `restaurant.js` has `data-open=` and **must not** have `data-addopts` | Keep the attribute; never reintroduce an add-options button |
| `test-hero-images.js` | `restaurant.js` has `hero-carousel` and `heroImages` | Keep both identifiers |
| `test-hero-images.js` | `restaurants.service.js` has `business_hero_images`, `'Maximum '`, `'hero images'` | Keep the cap message shape |
| `test-localization.js` | `restaurant.js` has `storefrontLanguage`; `api.js` has `localStorage.setItem('restivo-lang'` | Keep both |
| `test-seo.js` | `restaurant.js` has `/api/seo/business/` and `document.documentElement.dir` | Keep both |
| `test-dashboard-nav.js` | `style.css` + `admin.html` drawer selectors | Keep drawer markup |
| `onboarding-i18n.test.js`, `subscription-ux.test.js` | `i18n.js` keys exist in both ar and en | Every new key added in both |

## Complexity Tracking

Only the single justified entry above. No other principle is stretched.