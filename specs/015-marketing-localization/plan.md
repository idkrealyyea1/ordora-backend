# Implementation Plan: Marketing Homepage, SEO, Localization & Storefront UX

**Branch**: `015-marketing-localization` | **Date**: 2026-10-02 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/015-marketing-localization/spec.md`

## Summary

Evolve the Restivo multi-tenant food-ordering SaaS toward a global product. This plan covers: (1) marketing homepage with real plan data and SEO architecture, (2) centralized translation system with database-backed storage, (3) per-business currency and timezone with locale-aware formatting, (4) storefront hero image carousel, (5) responsive menu grid with product detail bottom sheet, (6) dashboard hamburger navigation. All changes preserve the existing vanilla HTML/CSS/JS architecture, PostgreSQL storage, and Task 13/14 onboarding/subscription systems.

## Technical Context

**Language/Version**: Node.js 20+ (JavaScript, no TypeScript)

**Primary Dependencies**: Express 4, pg (PostgreSQL), multer (uploads), helmet (security), express-session + connect-pg-simple (sessions), web-push (notifications), qrcode (QR codes), bcryptjs (password hashing)

**Storage**: PostgreSQL (primary), bytea in `uploaded_files` table (images)

**Testing**: node:test (built-in), `npm run check` (syntax), `node --test tests/` (unit/integration)

**Target Platform**: Linux server (Wasmer Edge deployment)

**Project Type**: Web service (multi-tenant SaaS with vanilla JS frontend)

**Performance Goals**: Homepage LCP < 3s on mid-range mobile, JS bundle < 100KB gzipped, no single image > 200KB

**Constraints**: No React, no build pipeline, no new dependencies without deploy plan, CSP `default-src 'self'` (no inline scripts), vanilla HTML/CSS/JS only

**Scale/Scope**: Multi-tenant SaaS, current scale ~10-50 businesses, designed for growth to 500+ businesses in sitemap

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Preserve Working | PASS | All changes additive; existing routes, auth, dashboards preserved |
| II. No React | PASS | Vanilla HTML/CSS/JS only; no framework migration |
| III. No Rebuild | PASS | Extends existing architecture incrementally |
| IV. Inspect First | PASS | All existing code, migrations, routes, services inspected |
| V. Code is Truth | PASS | Plan based on actual code behavior, not documentation |
| VI. No Guessing | PASS | All shared code changes traced; server-side validation preserved |
| VII. Safe Migrations | PASS | All migrations idempotent, backward-compatible, additive |
| VIII. No Destructive | PASS | No DROP/TRUNCATE; all changes additive |
| IX. Tenant Isolation | PASS | All queries scoped by restaurant_id; no cross-tenant access |
| X. Security | PASS | Existing CSP, helmet, validation, upload security preserved |
| XI. Dependencies | PASS | No new dependencies; all existing packages reused |
| XII. Simplicity | PASS | Reuses existing patterns (i18n.js, files.service, options.service) |
| XIII. No Speculative | PASS | Every feature has named beneficiary in spec |
| XIV. Purpose-Gated | PASS | All features trace to user stories |
| XV. Simple CX | PASS | Mobile-first, guest checkout preserved, bottom sheet pattern |
| XVI. Guest Checkout | PASS | No account required for ordering; no changes to checkout |
| XVII. No Payments | PASS | No payment gateway added |
| XVIII. One System | PASS | All business types share one codebase |
| XIX. Configurable | PASS | Capabilities via existing matrix; no forks |
| XX. i18n Foundation | PASS | Money in cents; locale-aware formatting; translation table |
| XXI. Honest SEO | PASS | Truthful structured data; no fake reviews/ratings |
| XXII. No Fabricated Proof | PASS | No fake testimonials/customers |
| XXIII. Visual Identity | PASS | Restivo design system preserved |
| XXIV. Reliability | PASS | No N+1; no unbounded loops; concurrent-safe |
| XXV. Tests Required | PASS | All new logic has tests; existing tests preserved |
| XXVI. Verify | PASS | npm run check + smoke tests required |
| XXVII. Flag Weak | PASS | No weak approaches identified |
| XXVIII. Ask When Ambiguous | PASS | 2 clarifications resolved in spec |

**Gate Result**: PASS — no violations.

## Project Structure

### Documentation (this feature)

```text
specs/015-marketing-localization/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── api-contracts.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
server/
├── app.js                    # Express assembly (modify: add SEO routes)
├── routes/
│   ├── site.routes.js        # robots.txt, sitemap.xml (modify: add hreflang, business metadata)
│   ├── public.routes.js      # Public API (modify: add translations endpoint, SEO metadata)
│   ├── owner.routes.js       # Owner API (modify: add hero image management, translation management)
│   └── admin.routes.js       # Admin API (modify: add hero image management)
├── controllers/
│   ├── owner.controller.js   # Owner controller (modify: add hero image, translation handlers)
│   └── admin.controller.js   # Admin controller (modify: add hero image handlers)
├── services/
│   ├── restaurants.service.js  # Restaurant service (modify: add hero image queries)
│   ├── files.service.js         # File storage (reuse: no changes)
│   ├── translations.service.js # NEW: Translation CRUD + API
│   └── seo.service.js           # NEW: SEO metadata generation
├── middleware/
│   ├── auth.js              # Auth middleware (reuse: no changes)
│   └── upload.js            # Upload middleware (reuse: no changes)
├── validators/
│   └── index.js             # Validators (modify: add hero image, translation validation)
└── utils/
    ├── datetime.js           # Timezone utils (reuse: no changes)
    └── checks.js            # Validation helpers (reuse: no changes)

client/
├── index.html               # Marketing homepage (modify: add SEO meta, structured data)
├── restaurant.html          # Storefront (modify: add carousel, product detail)
├── owner.html               # Owner dashboard (modify: add hamburger nav, hero image management)
├── admin.html               # Admin dashboard (modify: add hamburger nav, hero image management)
├── css/
│   ├── restivo.css          # Restivo design system (modify: add carousel, bottom sheet, drawer styles)
│   └── style.css            # Shared stylesheet (modify: add drawer styles)
└── js/
    ├── restivo-landing.js   # Landing page (modify: add plan data, language toggle)
    ├── restivo-content.js   # Landing content (modify: add new sections)
    ├── restaurant.js        # Storefront (modify: add carousel, product detail, menu grid)
    ├── owner.js             # Owner dashboard (modify: add hamburger nav, hero image management)
    ├── admin.js             # Admin dashboard (modify: add hamburger nav, hero image management)
    ├── i18n.js              # i18n (modify: load from API, add new strings)
    └── api.js               # API client (reuse: no changes)

database/
└── migrations/
    ├── 030_translations.sql          # NEW: translations table
    ├── 031_business_hero_images.sql  # NEW: business_hero_images table
    ├── 032_storefront_language.sql   # NEW: restaurant_settings.storefront_language
    └── 033_platform_language.sql     # NEW: users.platform_language

tests/
├── test-seo.js             # NEW: SEO metadata tests
├── test-localization.js    # NEW: Translation, currency, timezone tests
├── test-hero-images.js     # NEW: Hero image CRUD tests
├── test-storefront-ux.js   # NEW: Menu grid, product detail tests
└── test-dashboard-nav.js   # NEW: Hamburger navigation tests
```

**Structure Decision**: Web application with vanilla JS frontend and Express backend. Extends existing structure with new services, migrations, and client-side components. No new directories at the top level.

## Complexity Tracking

No Constitution violations. No complexity justification needed.
