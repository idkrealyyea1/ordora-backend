# Implementation Plan: Food Business Foundation

**Branch**: `005-food-business-foundation` | **Date**: 2026-09-29 | **Spec**: `specs/005-food-business-foundation/spec.md`

**Input**: Feature specification from `specs/005-food-business-foundation/spec.md` plus Clarifications session 2026-09-29 (closed 9-type list; keep restaurant internal names; existing owner/request onboarding; core-four capabilities; owner-editable currency UI).

**Note**: This plan is evidence-driven against the existing repository. No rewrite, no React, no new framework, no payments, no full pre-order/i18n, no homepage redesign.

## Summary

Establish the minimum safe foundation for a shared Food Business platform on the existing restaurant ordering system: one additive `restaurants.business_type` column (closed set of 9, default `restaurant`), creation/update plumbing through the existing owner flow, creation-time currency passthrough on the existing per-business currency field, and a documented pre-order reserve with zero behavior change. All money stays integer cents computed server-side; tenant isolation, security posture, SEO structure, and visual identity stay intact. Capability differences are expressed through existing fields only.

## Technical Context

**Language/Version**: Node.js >= 20, vanilla HTML/CSS/JS (no build, no TypeScript)

**Primary Dependencies**: Express 4, pg, express-session + connect-pg-simple, helmet, express-rate-limit, multer (unused for DB-stored uploads), bcryptjs, qrcode (existing; no new dependencies)

**Storage**: PostgreSQL via `server/db/pool.js` (`DATABASE_URL` or Wasmer `DB_*`); idempotent SQL migrations in `database/migrations/*.sql` via `database/migrate.js` + `schema_migrations`; uploaded images as `bytea` in `uploaded_files` (never disk)

**Testing**: `node --test tests/` (17 files) against explicit `TEST_DATABASE_URL` on a disposable DB only, plus `npm run check` (`scripts/check-syntax.js`, must pass 0 failures)

**Target Platform**: Wasmer Edge (`app.yaml`, `fr-roub1`, CDN 1h) + any Node 20 host; single-instance rate limiting and SSE hub (no shared store in this feature)

**Project Type**: Web application (Express API + vanilla static frontend served from `client/`)

**Performance Goals**: No new NFRs; preserve current behavior — checkout re-validates availability, hours, subscription at write time under `FOR UPDATE OF r` row lock; no N+1 or unbounded additions; marketing visuals add zero API/DB requests

**Constraints**: Backwards-compatible additive migrations only; tenant identity only from `req.user.restaurant_id`; client money ignored; per-business ISO currency; origin-checked mutations; rate-limited public writes; `noindex` on private pages; closed 9-type set; core-four capabilities only; visual identity frozen

**Scale/Scope**: Single-tenant-row scope per request; sitemap bounds active businesses at 500; existing `max_menu_items` range 1–10000 preserved

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

- I Preserve Working Functionality: PASS — every change is additive; existing menu/checkout/tracking/dashboard contracts unchanged (see `contracts/`).
- II/III No React / No Rebuild Without Evidence: PASS — no framework, no rewrite; reuse proven paths (see Existing Inventory).
- IV/V/VI Inspect, Source of Truth, No Guessing: PASS — plan cites verified source lines, not docs (migration contents, route/service/validator behavior grepped 2026-09-29).
- VII/VIII Safe, Non-Destructive Migrations: PASS — one additive migration with safe default; pre-order adds no columns; rollback documented per change.
- IX Tenant Isolation (NON-NEGOTIABLE): PASS — no session/param identity change; type/currency are attributes of the tenant root, all queries stay scoped.
- X Security Posture: PASS — no weakening of authZ, sessions, CSRF/origin, rate limits, validation, parameterized SQL, upload sniffing, error envelope.
- XI Dependencies: PASS — zero new dependencies.
- XII/XIII/XIV Simplicity, No Speculative Features, Purpose-Gated: PASS — smallest diff; pre-order/currency-full/i18n/payments explicitly deferred; each change maps to a spec FR.
- XV–XXIII CX, Guest Checkout, No Payments, One System, Configurable Capabilities, i18n Foundations, Honest SEO, No Fabrication, Identity: PASS — guest checkout untouched; currency presentation-only; SEO/identity frozen, no fake proof.
- XXIV–XXVIII Reliability, Tests, Verification, Flag Weak, Ask: PASS — tests extended not weakened; `npm run check` + smoke + disposable-DB suite gate; weak alternatives flagged in `research.md`.

Post-design re-check: PASS — Phase 1 artifacts introduce no new violations (no schema beyond C1, no behavior change beyond additive optional inputs).

## Project Structure

### Documentation (this feature)

```text
specs/005-food-business-foundation/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
server/
├── app.js                      # assembly: static client/, /restaurant/:slug, /offer/:code, /api/*, 404 vs JSON
├── routes/                     # admin.routes.js, owner.routes.js, auth.routes.js, public.routes.js, site.routes.js, leads.routes.js
├── controllers/                # admin.controller.js, owner.controller.js, auth.controller.js, leads.controller.js (thin glue; no public controller)
├── services/                   # restaurants, settings, menu/categories, orders, bookings, delivery, files (bytea), platform, users, restaurantRequests, enrichment, leads
├── middleware/                 # auth.js (attachUser + role gates), csrf.js (originGuard), ratelimit.js, sse.js, upload.js
├── validators/index.js         # mass-assignment-safe validators (restaurant, settings incl. currency, checkout, booking, requests)
├── db/pool.js                  # pg pool + withTx
└── utils/                      # errors (envelope), ids (orderCode), datetime (isOpenNow), checks, csv
database/
├── migrations/001_init.sql .. 020_delivery_toggle.sql   # schema of record (021 planned, additive only)
└── migrate.js + seeds/
client/
├── restaurant.html + js/restaurant.js   # storefront (cart, checkout, fmtMoney per-business currency)
├── admin.html + js/admin.js             # dashboard (orders, menu, settings incl. currency input st-cur, hours, QR, SSE, CSV)
├── owner.html + js/owner.js             # platform console (restaurants CRUD, staff, pricing, requests)
├── track.html + js/track.js, login, site.js, i18n.js (enhancement), skeleton.js, api.js (fmtMoney via Intl)
├── index/features/pricing/how-it-works/contact.html, for-restaurants/cafes/dessert-shops/cake-shops.html, resources/
└── 404.html, manifest.webmanifest, sw.js
config/index.js                  # env validation, fails fast on weak prod secrets / localhost DB
tests/ (17 files)                # auth, tenant-isolation, menu, orders math, double-submit/burst/race, cancel-grace, subscription-gate, bookings, enumeration, validation, errors
```

**Structure Decision**: Existing layout reused as-is. No new top-level directories, no framework, no separate app per business type. Feature touches only: one migration file, validators/services/controllers plumbing, two small frontend inputs (owner create form), contract docs, and tests.

## Existing Inventory (verified 2026-09-29, source — not docs)

- **Tables**: `restaurants` (slug/status/is_active/max_menu_items/subscription_ends_at), `users` (owner/admin + restaurant_id), `restaurant_settings` 1:1 (contact/address/timezone/branding/`currency` default USD + CHECK, delivery_fee_cents, ignore_opening_hours, delivery_enabled, name_en), `categories`, `menu_items` (price_cents, is_available, is_popular), `restaurant_hours`, `orders` (+archived_at, submission_key; pickup/delivery; cents totals; status lifecycle), `order_items` (price snapshot), `bookings`, `delivery_groups` + `restaurant_delivery_groups`, `platform_settings` (pricing_cents/currency/period/trial/brand), `uploaded_files` (bytea), `restaurant_requests`, `leads` family, `session`, `schema_migrations`. **No `business_type`, no pre-order columns anywhere.**
- **Migrations**: 20 files `001_init`–`020_delivery_toggle`, all additive (`ADD COLUMN IF NOT EXISTS` pattern in later files).
- **Data access**: no ORM; services issue parameterized SQL via `query`/`withTx`. Checkout takes `FOR UPDATE OF r` row lock.
- **Routes**: `/api/auth` (login/logout/me); `/api/admin/*` (requireAuth + requireRestaurantAdmin; `?restaurantId=` owner override); `/api/owner/*` (requireOwner except create-restaurant via requireOwnerOrStaff); `/api/*` public (directory, menu view, guest checkout POST, bookings POST, tracking, pricing, restaurant-requests, offer preview); `site.routes.js` (robots, sitemap max 500 active, `/r/:slug` 301). Static `client/` + explicit `/restaurant/:slug`, `/offer/:code`.
- **Controllers**: admin/owner/auth/leads only (thin); public routes call services directly.
- **Services**: restaurants (create/get/public view incl. currency), settings (read uppercases currency; update allow-list incl. currency), menu/categories, orders (server-priced, transitions, revenue statuses), bookings, delivery, files, platform, users, restaurantRequests.
- **Middleware**: auth (attachUser → `req.user.restaurant_id`; role gates; forbidStaffDelete), csrf originGuard, rate limits (global/auth/order), in-process SSE hub, upload magic-byte sniff.
- **Frontend/storefront**: `restaurant.js` prices via `fmtMoney(cents, settings.currency || 'USD')`; `api.js` `Intl.NumberFormat` presentation-only with fallback. No global-currency math.
- **Admin modules**: `admin.js` settings form already has currency input (`st-cur`, maxlength 3) → `PATCH /api/admin/settings`; dashboard/analytics/orders/menu/hours/QR/SSE/CSV present.
- **Owner modules**: `owner.js` restaurant CRUD + staff + platform pricing (per-platform currency select) + requests inbox; create-restaurant form has no type/currency inputs (gap).
- **Tests**: `tests/helpers.js` migrates + truncates all tenant tables, boots real app on ephemeral port; suites cover isolation, money math, races, gates, enumeration.

## Proposed Changes (conservative; each with required analysis)

### C1 — Schema: `restaurants.business_type` (the only schema change)

- **Why required**: FR-001/FR-002 + Clarifications (closed 9-type set as data, not separate apps). No existing column carries business kind; stuffing it into name/slug/description would corrupt identity and break directory/SEO semantics.
- **Existing behavior affected**: None by default — default `restaurant` preserves every current row's semantics; reads add one inert attribute.
- **Migration strategy**: New `021_business_type.sql`, idempotent: `ADD COLUMN IF NOT EXISTS business_type TEXT NOT NULL DEFAULT 'restaurant'` + `CHECK (business_type IN ('restaurant','cafe','dessert_shop','bakery','cake_business','home_kitchen','home_food_business','cloud_kitchen','small_food_business'))`. Runs under existing `migrate.js` + `schema_migrations`. No backfill (default applies). Canonical snake_case values; product labels map in presentation only.
- **Backward compatibility**: Old clients ignore the extra field; existing slugs/URLs/contracts unchanged; public menu payload gains one read-only string.
- **Indexes/constraints**: CHECK enforces the closed set (unknown → 400 via validator before DB). Btree index on `business_type` only if directory filtering by type ships later — **deferred** (small table, no query needs it now; avoids a useless index).
- **Tenant isolation**: Column lives on the tenant root; no scoping change; every query still filters by `restaurant_id` from session. Cross-tenant rules untouched.
- **Rollback**: Safe — drop CHECK, then column (only label data lost; defaults restore restaurant behavior). No dependent tables reference it.

### C2 — Plumbing: accept/validate/expose `business_type` through the existing owner flow

- **Why required**: Onboarding (Clarifications: existing owner/request flow) must be able to set the type without a new endpoint or app.
- **Affected**: `validateRestaurantCreate`/`validateRestaurantUpdate` (allowlist + closed-set check, default `restaurant`), `restaurants.service.createRestaurant` (+ optional type insert), `owner.controller.createRestaurant/updateRestaurant`, public view + directory read path (expose read-only), owner create/edit form inputs. No new routes; `restaurant_requests` table unchanged (desired type travels in existing `notes`/owner step — avoids a second migration for zero roadmap gain).
- **Migration/compat**: No migration; additive optional input; missing → default; unknown → 400 `business_type must be one of …`. Old payloads work byte-identical.
- **Indexes/constraints**: None (C1 CHECK is the constraint).
- **Tenant isolation**: Type is validated server-side and written only via owner-gated paths; never taken from session override or query spoofing; admin tenant override (`?restaurantId=`) keeps existing `requireOwnerOrStaff` gate.
- **Rollback**: Remove acceptance + form inputs; column defaults keep all rows valid.

### C3 — Capabilities: map core-four to existing fields (zero schema)

- **Why required**: FR-002 limits per-type variance to menu/products, pickup/delivery, hours, availability; all four already exist as fields — a new capability table would be speculative abstraction.
- **Mapping (no change)**: products → `categories` + `menu_items` (incl. `is_available`, `is_popular`, `max_menu_items`); pickup/delivery → `restaurant_settings.delivery_enabled` + `delivery_fee_cents` + `order_type` CHECK; hours → `restaurant_hours` + `ignore_opening_hours` + server `isOpenNow` enforcement; availability → `menu_items.is_available` + `restaurants.status` + `is_active` + subscription gate. Bookings and analytics explicitly stay non-per-type (C-clarification).
- **Compat/isolation/rollback**: No migration, no contract change, no scoping change; nothing to roll back.

### C4 — Currency: creation-time passthrough on the existing field (no currency engine)

- **Why required**: Clarifications demand owner-editable currency in this feature; evidence shows the only gap is creation — admin settings edit (`st-cur` → PATCH, validator ISO-3, service allow-list), public view exposure, and `Intl` presentation formatting all already exist and are correct.
- **Affected**: `validateRestaurantCreate` accepts optional `currency` (same ISO-3 rule, default USD), service inserts into `restaurant_settings`, owner create form gains a currency select (same option list as platform pricing). Checkout math, snapshot logic, and formatting untouched (integer cents end to end).
- **Migration/compat**: No migration; existing rows keep USD; old payloads without currency behave identically.
- **Indexes/constraints**: Existing `settings_currency` CHECK reused; no new index (currency never filters queries).
- **Tenant isolation**: Currency read from the tenant's own settings row at checkout/view time; never cross-tenant; client-sent currency ignored like all money fields.
- **Rollback**: Remove creation inputs; per-business edit + display remain (they predate this feature).

### C5 — Pre-order: documented reserve, zero implementation

- **Why required**: Spec FR-007 demands forward-compatibility without shipping an engine; adding `is_preorder`/`available_at` columns now would be speculative schema with no readers/writers.
- **Affected**: Nothing behavioral. Contract rule added (see `contracts/`): public menu-item payloads MUST tolerate unknown future availability fields, and checkout MUST keep enforcing `is_available`/status/hours/subscription exactly as today. Future migration `022` shape is described but explicitly deferred.
- **Compat/isolation/rollback**: No migration, fully compatible, nothing to roll back.

### C6 — SEO, identity, hardening: verify-only (no new pages)

- **Why**: FR-008/009/010 freeze identity and honesty rules; homepage rework and per-type marketing pages are roadmap, not this feature.
- **Affected**: None — `robots.txt`, `sitemap.xml` (static list + ≤500 active businesses), private-page `noindex`, honest-data rules verified by tests; no new routes, no copy changes, no logo/testimonial blocks (empty state renders nothing).

### Explicit non-changes (rejected with reason)

- No table renames (restaurants/menu_items stay; Food Business is product wording — renames would break URLs/contracts for zero customer value).
- No `restaurant_requests.business_type` column (owner sets type at creation; second migration unjustified).
- No pre-order columns/engine, no i18n framework, no payments, no per-type analytics pipelines, no self-serve signup, no homepage redesign, no new marketing pages, no new dependencies, no shared rate-limit/SSE store (single-instance stays).

## Complexity Tracking

> No constitution violations. No entries — this plan stays within existing architecture with one additive column and no new abstractions.

## Phase 0 / Phase 1 Artifacts

- `research.md` — decisions, rationale, alternatives considered (including rejected rewrites).
- `data-model.md` — entities, fields, relationships, validation, transitions, capability map.
- `contracts/` — public + admin/owner contract deltas (additive-only).
- `quickstart.md` — runnable validation guide (migrate → create → order → verify → test).
