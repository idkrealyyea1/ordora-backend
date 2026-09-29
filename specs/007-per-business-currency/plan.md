# Implementation Plan: Per-Business Currency (Task 3)

**Branch**: `007-per-business-currency` | **Date**: 2026-09-29 | **Spec**: `specs/007-per-business-currency/spec.md`

**Input**: Feature specification from `specs/007-per-business-currency/spec.md` plus Clarifications session 2026-09-29 (business admin changes currency via business settings; platform owner sets only the creation default).

**Note**: Evidence-driven against the implemented Tasks 1–2 baseline. No rewrite, no React, no payments, no i18n, no conversion engine, no new dependencies.

## Summary

Establish the currency foundation with four minimal moves: snapshot the business currency onto each order at checkout (new nullable-then-constrained `orders.currency` with backfill from settings, so history survives settings changes); read tracking/analytics from the snapshot instead of the live setting; offer the prepared eight-code set in owner-facing currency inputs while keeping storage open to any ISO-3 code; and restrict currency mutation to business-admin settings plus the creation default (removing it from the platform-owner update proxy). All math stays integer cents; no conversion anywhere.

## Technical Context

**Language/Version**: Node.js >= 20, vanilla HTML/CSS/JS (no build, no TypeScript)

**Primary Dependencies**: Express 4, pg, express-session + connect-pg-simple, helmet, express-rate-limit, bcryptjs, qrcode (existing; no new dependencies)

**Storage**: PostgreSQL via `server/db/pool.js`; idempotent migrations via `database/migrate.js` + `schema_migrations`. One additive migration in this task (`022_orders_currency.sql`).

**Testing**: `node --test tests/` against explicit `TEST_DATABASE_URL` (disposable DB only) plus `npm run check` (0 failures required)

**Target Platform**: Wasmer Edge (`app.yaml`) + any Node 20 host; single-instance behavior unchanged

**Project Type**: Web application (Express API + vanilla static frontend in `client/`)

**Performance Goals**: No new NFRs; snapshot is one written column on the existing checkout insert and one read column on existing selects; no new joins (removes reliance on the settings join for currency)

**Constraints**: Integer-cents math untouched; no symbols/codes in amount storage; no FX or repricing; creation context immutable; tenant-scoped writes; business-admin mutation only; prepared eight in UI with ISO-open storage; visual identity frozen

**Scale/Scope**: Per-order snapshot for all new orders; backfill covers all historical rows from their business settings; analytics group revenue by snapshot currency

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

- I Preserve Working Functionality: PASS — legacy values untouched; backfill reproduces current display exactly; checkout math identical.
- II/III No React / No Rebuild: PASS — four targeted edits on existing paths.
- IV/V/VI Inspect, Source of Truth, No Guessing: PASS — snapshot need proven by the live-settings join at `orders.service.js:481-484`; checkout insert mapped at `:184-189`.
- VII/VIII Safe Migrations: PASS — single additive migration, settings-derived backfill, drop-column rollback.
- IX Isolation (NON-NEGOTIABLE): PASS — snapshot written from the tenant's own locked settings row; no scoping change.
- X Security: PASS — no new accepted shapes beyond an already-validated ISO field; owner-update removal shrinks surface.
- XI–XIV Deps, Simplicity, No Speculation, Purpose-Gated: PASS — no deps, no abstractions, each change traces to an FR.
- XV–XXIII Guest checkout, no payments, one system, i18n untouched, honest data, identity: PASS.
- XXIV–XXVIII Reliability, tests, verification, flag weak, ask: PASS — snapshot + lock + preservation tests extend the suite; none weakened.

Post-design re-check: PASS — no new violations.

## Project Structure

### Documentation (this feature)

```text
specs/007-per-business-currency/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

Task 3 touches only:

```text
database/migrations/022_orders_currency.sql  # NEW: additive snapshot column + backfill
server/services/orders.service.js            # checkout writes snapshot; tracking/analytics read it
server/services/restaurants.service.js       # platform/owner aggregates carry currency context
server/controllers/owner.controller.js       # drop currency from update proxy (keep creation default)
server/validators/index.js                   # prepared-eight UI guidance untouched; ISO rule stands
client/js/admin.js + client/js/owner.js      # prepared-eight selects (existing patterns)
tests/currency-*.test.js                     # NEW: preservation, locks, snapshot, aggregates
```

**Structure Decision**: Reuse all Tasks 1–2 architecture. No new tables, routes, frameworks, or dependencies.

## Existing Inventory (verified 2026-09-29)

- **Storage**: integer cents in `menu_items.price_cents`, `orders.*_cents`, `order_items.*_cents`, `restaurant_settings.delivery_fee_cents`, revenue aggregates, CSV cent-headers. `restaurant_settings.currency` (ISO-3 CHECK, default USD) + `platform_settings.pricing_currency`.
- **Calculation**: checkout server-side from DB cents under `FOR UPDATE OF r` lock; client money ignored; lines snapshotted.
- **Display**: `Intl`-based presentation formatting (`api.js` fmtMoney, `site.js`, `track.js`); zero formatting in storage.
- **Gap (drives C1)**: tracking (`getByCode`) and aggregates join live `restaurant_settings.currency`, so a settings change rewrites history display — violating FR-007.
- **Gap (drives C3)**: owner UI offers 4 platform codes in one select and free text elsewhere; no unified prepared eight.
- **Gap (drives C4)**: platform/owner aggregates sum cents across tenants with no currency context — violating FR-009 once currencies differ.
- **No change needed**: checkout math, fees, isolation, sessions, CSRF/origin, rate limits, uploads, SEO, identity, bookings, i18n.

## Proposed Changes

### C1 — Snapshot: `orders.currency` written at checkout, read everywhere after

- **Why required**: FR-007. Proven gap: history display follows the live setting.
- **Behavior affected**: Checkout stores the locked settings currency per order; tracking, admin/owner order views, and revenue aggregates read the snapshot. Display of pre-change orders becomes immutable.
- **Migration strategy**: `022_orders_currency.sql`, idempotent: `ADD COLUMN IF NOT EXISTS currency TEXT`; backfill `UPDATE orders SET currency = settings.currency` for NULLs from each order's business; then `SET DEFAULT 'USD'` + ISO CHECK (same rule as settings). Existing rows reproduce today's display exactly.
- **Backward compatibility**: Old clients ignore the extra field; tracked payloads gain one read-only string.
- **Indexes/constraints**: ISO-3 CHECK (shared rule); no new index (currency never filters, only labels/groups).
- **Tenant isolation**: Snapshot sourced from the tenant's own locked row inside the checkout transaction; no scope change.
- **Rollback**: Drop CHECK, then column; readers fall back to the settings join. No data loss (amounts never touched).

### C2 — Prepared eight in UI, ISO-open in storage

- **Why required**: FR-002/FR-003/FR-012. One selectable list for owners, zero model friction for future codes.
- **Behavior affected**: Admin settings and owner create inputs offer ILS, USD, EUR, GBP, JOD, SAR, AED, EGP (existing select/input patterns). Validator keeps accepting any ISO-3 code, so a ninth code needs no migration — only a list addition.
- **Migration/compat**: None. Unknown codes still 400.
- **Isolation/rollback**: Display-only; revert lists to prior options.

### C3 — Actor pinch: business-admin settings + creation default only

- **Why required**: Clarification (business admin changes; platform owner sets creation default). Task 1's owner-update currency proxy would otherwise leave two mutation actors.
- **Behavior affected**: Remove `currency` from the owner-update settings proxy (keep it in create). Admin `PATCH /api/admin/settings` remains the change path with the existing ISO rule.
- **Migration/compat**: None. Owner updates carrying currency have the field ignored (consistent with mass-assignment tolerance); creation unchanged.
- **Isolation/rollback**: Shrinks surface; re-add proxy line to roll back.

### C4 — Currency context on aggregates (no conversion)

- **Why required**: FR-009. Cross-tenant sums are currently unlabeled single totals.
- **Behavior affected**: Platform/owner revenue figures gain per-currency grouping (additive fields); per-tenant analytics stay exact and now group stable history by snapshot. No conversion, no repricing, no totals removed.
- **Migration/compat**: None (reads snapshot column). Additive response fields.
- **Isolation/rollback**: Same tenant scoping; drop added fields to roll back.

### Explicit non-changes

- No FX, no repricing, no payments, no i18n, no React, no renames, no homepage/marketing changes, no bookings/self-serve alterations, no new dependencies, no shared rate-limit/SSE store.

## Complexity Tracking

> No constitution violations. No entries.

## Phase 0 / Phase 1 Artifacts

- `research.md` — decisions, rationale, rejected alternatives.
- `data-model.md` — entities and the single-column delta.
- `contracts/` — currency contract deltas (additive-only).
- `quickstart.md` — runnable validation guide.
