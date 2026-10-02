# Implementation Plan: Trial Subscription Lifecycle

**Branch**: `014-trial-subscription-lifecycle` | **Date**: 2026-10-02 | **Spec**: [specs/014-trial-subscription-lifecycle/spec.md](spec.md)

**Input**: Feature specification from `/specs/014-trial-subscription-lifecycle/spec.md` (plus Clarifications session 2026-10-02: expired = visible storefront with ordering disabled + tracking works; six states trial/active/grace/expired/cancelled/suspended; 7-day grace; end-of-period cancellation default; pre-existing businesses grandfathered active with no end date)

**Note**: This plan was produced by the `/speckit.plan` command after two-area repository inspection (subscription/trial/pricing touchpoints; capability/entitlement + access gates). Task 13 is reused and extended, never redesigned.

## Summary

Grow the existing single-clock expiry model (`restaurants.subscription_ends_at`, already enforced at login, admin mutations, ordering, storefront, and capabilities) into a real subscription foundation without replacing it: one data-driven `plans` table seeded from the existing platform price, one `subscriptions` row per business carrying explicit state plus grace/cancellation timestamps, one `subscription_events` audit table, and plan-entitlement/limit mappings that plug into Task 13's `can()` evaluator. Effective state is derived at read time from server timestamps (no scheduler exists, none is added). The one deliberate behavior change is the clarified expired storefront: visible menu with ordering disabled instead of 404. Everything else — auth, tenancy, onboarding flow, capability matrix shape, money and logging conventions — is reused.

## Technical Context

**Language/Version**: Node.js 20+, Express 4, PostgreSQL via `pg`; vanilla HTML/CSS/JS, no build (existing stack, unchanged)

**Primary Dependencies**: Existing only — no new runtime dependency (no scheduler, no cache, no billing SDK).

**Storage**: PostgreSQL, migrations `database/migrations/*.sql` idempotent via `database/migrate.js` + `schema_migrations`. Two new tables (`plans`, `subscriptions` — one row per business, UNIQUE), two mapping tables folded into one (`plan_entitlements` covering booleans and numeric limits), one audit table (`subscription_events`). `restaurants.subscription_ends_at` stays the access clock; existing rows keep working defaults (grandfathered active, NULL end = no end date).

**Testing**: `node --test tests/` on disposable `TEST_DATABASE_URL`; fixtures via `tests/helpers.js`; `npm run check` 0 failures.

**Target Platform**: Existing deploy contract unchanged. Browsers mobile-first, Arabic RTL default with English toggle via `client/js/i18n.js` DICT.

**Project Type**: Web application — `server/` (routes → controllers → services → parameterized SQL, single-file validators) + `client/` static + `tests/`.

**Performance Goals**: No new queries on hot paths: the per-request subscription row already fetched in `requireRestaurantAdmin` grows to one joined row (plan + state + entitlements resolved once per request); public checkout keeps its existing pre-check shape; no caching layer.

**Constraints**: No background jobs or cron exist — effective state (trial/active/grace/expired) MUST derive at read time from server timestamps; stored `suspended`/`cancelled` override derived state. Tenant id only from session; admin-only mutation; mass-assignment-safe validators; safe error envelope; money in cents; `== end instant` counts as expired (existing boundary preserved).

**Scale/Scope**: One plan seeded plus trial association; ~6 admin endpoints; owner listing gains subscription columns; dashboard card gains state/grace/plan copy; ~5 new test files extending existing suites in place.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I Preserve Working Functionality** — PASS with one explicit exception: expired storefront changes 404 → visible-with-ordering-disabled per clarified spec (the only intended behavior change; everything else byte-identical).
- **II No React** — PASS: vanilla `owner.html`/`admin.html` extensions only.
- **III No Rebuild** — PASS: extends `subscription_ends_at` gates, `can()`/`effectiveFor()`, `requireCapability`, onboarding tx, owner panel, logging; new code is plans/subscriptions service + admin endpoints + audit table.
- **IV Inspect Before Deciding** — PASS: two-area inspection (all expiry gates, pricing, owner panel, demo/signup trials, tests, money/time conventions; full capability matrix, enforcement points, dashboard surfaces, audit options).
- **V Code Is Truth** — PASS: decisions cite exact files/behaviors found.
- **VII/VIII Migrations** — PASS: additive tables/columns, guarded constraints, backfill to safe defaults, no destructive ops.
- **IX Tenant Isolation** — PASS: subscription reads scoped by session tenant; admin mutation explicit-target with platform role; owners cannot touch own plan/state.
- **X Security Posture** — PASS: existing session/CSRF/rate-limit/validation preserved; server-side evaluation; forged claims ignored; PII-safe logging.
- **XI Dependencies** — PASS: zero new dependencies.
- **XII Simplicity** — PASS: one mapping table instead of two; read-derived state instead of a scheduler; no billing console.
- **XIII No Speculative Features** — PASS: single seeded plan; limits only for real functionality (`max_menu_items` family); future capabilities stay as the existing `advanced_analytics` hook pattern.
- **XV Simple CX** — PASS: human-readable states, existing DICT pattern, no new heavy UI.
- **XVII No Payment Gateway** — PASS: none; the subscription service is the seam future providers call.
- **XVIII/XIX One System, Configurable Capabilities** — PASS: plans feed the existing matrix; no per-plan forks.
- **XX i18n** — PASS: new strings in `ar`+`en`.
- **XXV/XXVI Tests & Verification** — PASS: new suites in place; `check` green; disposable-DB runs; smoke list in `quickstart.md`.

Post-design re-check: no new violations (see research.md D1–D10; data-model.md keeps additive-only schema).

## Project Structure

### Documentation (this feature)

```text
specs/014-trial-subscription-lifecycle/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── plans.md
│   ├── subscriptions.md
│   └── access.md
├── checklists/
│   └── requirements.md  # Spec quality gate (built-in, 16/16)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
server/
├── routes/
│   ├── owner.routes.js          # EXTEND: subscription admin endpoints (platform role only)
│   └── admin.routes.js          # UNCHANGED (existing gates keep working)
├── controllers/
│   ├── owner.controller.js      # EXTEND: plan/subscription admin handlers (thin)
│   └── admin.controller.js      # EXTEND: dashboard/myRestaurant subscription fields only
├── services/
│   ├── plans.service.js         # NEW: data-driven plans + entitlement/limit mappings
│   ├── subscriptions.service.js # NEW: lifecycle state machine, transitions, audit writes
│   ├── capabilities.service.js  # EXTEND: can()/effectiveFor() consume plan entitlements
│   ├── restaurants.service.js   # EXTEND: getPublicView expired-visible (clarified), owner listing columns
│   ├── orders.service.js        # UNCHANGED (existing expiry/delivery gates stand)
│   ├── signup.service.js        # EXTEND: attach trial subscription row in the same tx
│   └── platform.service.js      # REUSE: trial_days + price source for the seeded plan
├── validators/index.js          # EXTEND: plan/subscription admin validators (same file)
├── middleware/auth.js           # EXTEND: joined subscription row per request (same query shape, wider)
└── utils/datetime.js            # REUSE: no new date abstraction (server wall-clock instants)

client/
├── js/owner.js                  # EXTEND: plan/state/dates/actions in platform panel
├── js/admin.js                  # EXTEND: subscription card states + recovery guidance
├── js/i18n.js                   # EXTEND: ar/en human-readable states
└── pricing.html                 # UNCHANGED (public price display untouched)

database/migrations/
├── 0NN_plans.sql                # NEW: plans + plan_entitlements + seed from platform_settings
└── 0NN_subscriptions.sql        # NEW: subscriptions + subscription_events + backfill/grandfather

tests/
├── plans.test.js                # NEW: plan CRUD/retrieval/active-flag/entitlement mapping
├── subscriptions.test.js        # NEW: lifecycle transitions, grace, cancel, suspend, audit
├── subscription-access.test.js  # NEW: per-surface rules incl. clarified expired storefront
├── subscription-security.test.js# NEW: IDOR, self-modification refusal, forged claims
└── subscription-legacy.test.js  # NEW: migration/back-compat for pre-existing businesses
```

**Structure Decision**: Single existing project; layering preserved (`routes → controllers → services → parameterized SQL`). Contracts are Markdown (no OpenAPI in this project); error envelope and tenant conventions documented instead.
