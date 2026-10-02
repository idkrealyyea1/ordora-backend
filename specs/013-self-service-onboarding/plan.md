# Implementation Plan: Self-Service Onboarding

**Branch**: `013-self-service-onboarding` | **Date**: 2026-10-02 | **Spec**: [specs/013-self-service-onboarding/spec.md](spec.md)

**Input**: Feature specification from `/specs/013-self-service-onboarding/spec.md` (plus Clarifications session 2026-10-02: early business creation, 1:1 account-to-business, optional first product, six types + "other", full-access placeholder entitlement)

**Note**: This plan was produced by the `/speckit.plan` command after repository inspection (auth/tenancy, domain models, client/tests) — no implementation yet.

## Summary

Add a public self-service path (homepage → signup → business-type choice → stepped wizard → published store) that creates a real tenant via the existing `restaurants` model, `admin`-role owner, settings/hours rows, and session auth — reusing every existing creation/validation/ordering path. Business-type differences are expressed through one new static profile module plus one capability-evaluation module (type support AND live entitlement AND configuration), with server-side enforcement middleware and client-side emphasis only. New-business lifecycle reuses `subscription_ends_at` (+`trial_days`) so future subscription work attaches without rewriting onboarding. No new dependencies, no React, no payments, no duplicate systems, additive migrations only.

## Technical Context

**Language/Version**: Node.js 20+, Express 4, PostgreSQL via `pg`; vanilla HTML/CSS/JS with no build step (existing stack, unchanged)

**Primary Dependencies**: Existing only — `bcryptjs` (cost 12), `connect-pg-simple` (session table), `express-rate-limit`, `multer`, `qrcode`. No new runtime dependency.

**Storage**: PostgreSQL. Migrations in `database/migrations/*.sql`, idempotent via `database/migrate.js` + `schema_migrations`. Change is additive: new columns on `restaurants` for onboarding state; no table rewrites, no new capability tables (matrix is static code evaluated live).

**Testing**: `node --test tests/` on a disposable `TEST_DATABASE_URL` (refuses to run without it); fixtures via `tests/helpers.js#startApp` through public API paths. `npm run check` (`scripts/check-syntax.js`, `node --check` per file) must report 0 failures.

**Target Platform**: Existing deploy contract (`app.yaml`, Wasmer Edge) unchanged. Browsers, mobile-first, Arabic RTL default with English toggle via `client/js/i18n.js` DICT.

**Project Type**: Web application — `server/` (routes → controllers → services → parameterized SQL, `validators/` mass-assignment-safe) + `client/` (static HTML served by `express.static` plus explicit param routes) + `tests/`.

**Performance Goals**: Wizard stays lightweight: no dashboard data load during onboarding, per-tenant indexed lookups only, no N+1, no new polling; usable on weak phones and slow networks (existing skeleton-loader convention kept).

**Constraints**: Tenant identity only from `req.user.restaurant_id` via `attachUser`; mutating routes keep `originGuard` + rate limiters + error envelope `{ error: { code, message } }`; money in cents; uploads only via existing `uploaded_files` path; hidden UI is never authorization.

**Scale/Scope**: 1 account → 1 business (clarified); 9 stored business-type values, 6 named choices + "other" fallback at signup; ~41 existing test suites must stay green; one new wizard page plus dashboard continuation banner.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I Preserve Working Functionality** — PASS: all `/api/*`, auth, dashboards, `/restaurant/:slug`, `/app/`, ordering, SSE/push paths untouched; new routes are additive; admin creation flow unchanged.
- **II No React** — PASS: one new vanilla `client/signup.html` + `client/js/signup.js`; no framework, no build.
- **III No Rebuild** — PASS: reuses `createRestaurant` tx shape, `menu.service`, `settings.service` hours/fulfillment, `normalizeSlug`, session auth; two small new modules only (profiles, capabilities).
- **IV Inspect Before Deciding** — PASS: three-area inspection completed (auth/session/tenancy; business_type/slug/products/hours/fulfillment/settings/plans; client/i18n/tests/logging) before this plan.
- **V Code Is Truth** — PASS: decisions cite exact files/migrations/behavior found, not docs.
- **VII/VIII Migrations** — PASS: additive nullable/defaulted columns on `restaurants`; no DROP/ALTER-lossy; re-runnable.
- **IX Tenant Isolation** — PASS: tenant id exclusively from session; new endpoints derive `restaurant_id` server-side; cross-tenant tests required.
- **X Security Posture** — PASS: bcrypt-12, session regenerate, `originGuard`, `authLimiter` on signup, parameterized SQL, mass-assignment-safe validators, safe envelope; client-sent plan/capability/tenant claims ignored.
- **XI Dependencies** — PASS: zero new dependencies.
- **XII Simplicity** — PASS: static profile + capability modules replace scattered conditionals; no one-implementation interfaces; no new tables for what live evaluation answers.
- **XIII No Speculative Features** — PASS: matrix covers only capabilities the platform has today plus an explicit `future` entitlement hook required by spec FR-019/023; no invented tiers/prices.
- **XV Simple CX** — PASS: one-question-per-step wizard, minimal fields, plain AR/EN strings.
- **XVII No Payment Gateway** — PASS: none; trial clock reuses `subscription_ends_at` with no billing.
- **XVIII One System / XIX Configurable Capabilities** — PASS: shared core + profiles; no per-type forks.
- **XX i18n Foundations** — PASS: new strings added to both `ar`/`en` DICTs; RTL default preserved.
- **XXV/XXVI Tests & Verification** — PASS: new suites extend `tests/` in place; `npm run check` 0 failures; disposable-DB runs; smoke list defined in `quickstart.md`.

Post-design re-check: no new violations introduced (see research.md D1–D12; data-model.md keeps additive-only schema).

## Project Structure

### Documentation (this feature)

```text
specs/013-self-service-onboarding/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── signup.md
│   ├── onboarding.md
│   └── capabilities.md
├── checklists/
│   ├── requirements.md  # Spec quality gate (built-in, 16/16)
│   └── capabilities.md  # Custom requirements-quality review (18 items)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
server/
├── routes/
│   ├── signup.routes.js        # NEW: public signup + slug check (authLimiter, originGuard)
│   ├── onboarding.routes.js    # NEW: onboarding state/progress (requireAuth, session tenant)
│   ├── capabilities.routes.js  # NEW: read-only profile/matrix/effective-capabilities (or folded into onboarding routes if smaller)
│   ├── auth.routes.js          # REUSE unchanged (login/logout/me)
│   ├── admin.routes.js         # REUSE unchanged (items, hours, settings, qr — wizard steps call these)
│   └── owner.routes.js          # REUSE unchanged (platform panel keeps working)
├── controllers/
│   ├── signup.controller.js       # NEW: thin, delegates to services
│   └── onboarding.controller.js   # NEW: thin, session-derived tenant only
├── services/
│   ├── business-types.service.js  # NEW: static profiles for the 9 types (labels keys, defaults, emphasis)
│   ├── capabilities.service.js    # NEW: static matrix + live can(feature, businessRow) evaluation
│   ├── restaurants.service.js     # REUSE: createRestaurant tx shape (+ trial-ends default)
│   ├── users.service.js           # REUSE: hash/verify, createAdmin-equivalent inside signup tx
│   ├── menu.service.js            # REUSE: first product / categories
│   └── settings.service.js        # REUSE: hours + fulfillment toggles
├── validators/index.js            # EXTEND: signup, slug-availability, onboarding-step validators (same file convention)
├── middleware/
│   ├── auth.js                    # REUSE + small requireCapability(cap) addition in same file
│   └── ratelimit.js               # REUSE limiters (signup uses authLimiter)
└── utils/checks.js                # EXTEND: numeric-suffix slug variant helper next to normalizeSlug

client/
├── signup.html                 # NEW: wizard shell (skeleton loader, i18n attrs, RTL/LTR)
├── js/signup.js                # NEW: step state machine, calls existing + new endpoints
├── js/i18n.js                  # EXTEND: ar/en keys for wizard + continuation banner
├── js/admin.js                 # EXTEND: continuation banner + per-type module emphasis (visibility only)
└── index.html                  # EXTEND: "Start Free Trial" entry link only

database/migrations/
└── 0NN_onboarding_state.sql    # NEW: additive onboarding columns on restaurants (see data-model.md)

tests/
├── signup.test.js              # NEW: account/business/slug/type/trial coverage
├── onboarding.test.js          # NEW: progress/resume/completion/abandonment
└── capabilities.test.js        # NEW: matrix evaluation + server-side bypass rejection
```

**Structure Decision**: Single existing project; no new top-level directories. New server code follows the established `routes → controllers → services → parameterized SQL` layering with validators in the single existing validators file; new client code follows the per-page vanilla JS + DICT convention. Contracts are Markdown (the project has no OpenAPI; the error envelope and tenant conventions are documented instead).
