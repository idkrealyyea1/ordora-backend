# Implementation Plan: Product Options (Task 5)

**Branch**: `009-product-options` | **Date**: 2026-09-29 | **Spec**: `specs/009-product-options/spec.md`

**Input**: Feature specification from `specs/009-product-options/spec.md` plus Clarifications session 2026-09-29 (variant price replaces base with add-ons adjusting on top; groups carry min-max pick counts).

**Note**: Evidence-driven extension of the verified menu/order model. No rewrite, no React, no payments, no inventory, no coupons, no new dependencies.

## Summary

Add linked option definitions (groups with required flag, pick bounds, and replace/adjust pricing mode; choices with names, prices, quantities, availability) scoped to product and tenant, validate selections server-side at checkout write time inside the existing order transaction, price exclusively from stored values, and freeze per-line snapshots that survive definition edits. Option-free products and historical orders behave byte-identically.

## Technical Context

**Language/Version**: Node.js >= 20, vanilla HTML/CSS/JS (no build, no TypeScript)

**Primary Dependencies**: Express 4, pg, existing session/validation stack (no new dependencies)

**Storage**: PostgreSQL via `server/db/pool.js`; idempotent migrations via `database/migrate.js`. One additive migration in this task (`023_item_options.sql`).

**Testing**: `node --test tests/` against explicit `TEST_DATABASE_URL` (disposable DB only) plus `npm run check` (0 failures required)

**Target Platform**: Wasmer Edge (`app.yaml`) + any Node 20 host; single-instance behavior unchanged

**Project Type**: Web application (Express API + vanilla static frontend)

**Performance Goals**: No new NFRs; option reads batched per item set (no N+1); checkout stays in the existing `FOR UPDATE OF r` transaction

**Constraints**: Integer-cents money; client option prices ignored; required groups enforced; min/max picks enforced; tenant-scoped everything; guest checkout; visual identity frozen; no configurator overbuild

**Scale/Scope**: Definitions per product; snapshots per order line; existing `max_menu_items` semantics untouched

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

- I Preserve Working Functionality: PASS — option-free paths byte-identical; snapshots additive.
- II/III No React / No Rebuild: PASS — extend menu/order services, validators, and storefront renderer in place.
- IV/V/VI Inspect, Source of Truth, No Guessing: PASS — flat `menu_items`, item-plus-quantity checkout, flat `order_items` snapshot verified 2026-09-29.
- VII/VIII Safe Migrations: PASS — single additive migration with safe defaults; drop-tables rollback.
- IX Isolation (NON-NEGOTIABLE): PASS — definitions and snapshots carry `restaurant_id` scoping; cross-tenant selections rejected.
- X Security: PASS — explicit allowlist validators; server-side pricing; safe errors.
- XI–XIV Deps, Simplicity, No Speculation, Purpose-Gated: PASS — two tables mirror existing patterns; no generic configurator.
- XV–XXIII Guest checkout, no payments, one system, currency, honest data, identity: PASS — currency context flows into snapshots; CX stays minimal.
- XXIV–XXVIII Reliability, tests, verification, flag weak, ask: PASS — tamper/snapshot/regression tests extend the suite.

Post-design re-check: PASS — no new violations.

## Project Structure

### Documentation (this feature)

```text
specs/009-product-options/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

Task 5 touches only:

```text
database/migrations/023_item_options.sql  # NEW: option_groups + option_choices + order_item_options
server/services/options.service.js        # NEW: tenant-scoped group/choice CRUD (mirrors menu.service)
server/services/orders.service.js         # checkout validates/prices/snapshots selections in-tx
server/services/menu.service.js           # item reads attach definitions (batched)
server/validators/index.js                # selection + definition validators (explicit allowlists)
server/controllers/admin.controller.js    # group/choice endpoints (existing auth gates)
server/routes/admin.routes.js             # route wiring only
client/js/restaurant.js                   # option picker + selection display (existing patterns)
client/js/admin.js                        # group/choice management UI (existing patterns)
tests/options-*.test.js                   # NEW: regression, example kinds, tamper, snapshot, isolation
```

**Structure Decision**: Mirror `menu.service`/`categories` patterns exactly. No new layers, frameworks, or dependencies.

## Existing Inventory (verified 2026-09-29)

- **Definitions side**: `menu_items` flat (price, availability, popular, position); `categories` tenant-unique; admin CRUD via `menu.service` with explicit validators and race-safe limits.
- **Order side**: checkout payload `{itemId, quantity}` only; server prices from DB under tenant row lock; `order_items` snapshots name/unit-price/quantity/line-total with nullable menu reference; currency snapshotted (Task 3).
- **Frontend**: dish cards, cart overlay, checkout form, `money()` presentation formatting; soldout gating client + server.
- **Untouched**: sessions, CSRF/origin, rate limits, uploads, SEO, identity, bookings, i18n, payments.

## Proposed Changes

### C1 — Definitions: `option_groups` + `option_choices` (the schema change)

- **Why required**: FR-003–FR-006. No existing structure carries groups, choices, or adjustments; stuffing them into name/description corrupts ordering and display.
- **Behavior affected**: None by default — products without groups behave exactly as before; reads attach empty option lists.
- **Migration strategy**: `023_item_options.sql`, idempotent: two definition tables (tenant + product scoped, cascade deletes) plus one snapshot table; safe defaults (`is_required FALSE`, `max_picks 1`, `pricing 'adjust'`, prices `0`, available `TRUE`); CHECKs encode the clarifications (replace-mode groups single-pick; pick bounds sane; quantities 1–99).
- **Backward compatibility**: Additive tables; existing rows join to empty sets; old clients ignore new payload fields.
- **Indexes/constraints**: FK indexes on `(restaurant_id)`, `(menu_item_id)`, `(group_id)`; tenant-scoped uniqueness on group/choice names (mirrors categories pattern); CHECKs for mode/bounds/non-negative money.
- **Tenant isolation**: Every definition row carries `restaurant_id`; all queries filter by it; cross-tenant group/choice references rejected at checkout.
- **Rollback**: Drop snapshot table, then choices, then groups (definitions only; orders keep their frozen copies — same pattern as menu-item deletion).

### C2 — Checkout: validate, price, snapshot in-transaction

- **Why required**: FR-008/FR-009. Trust boundary is the checkout write; anything less reintroduces client-priced money.
- **Behavior affected**: Payload items gain optional `selections`; option-free lines byte-identical. Unit math: base price, replaced by the single replace-group pick when present, plus adjust-group contributions times choice quantities; times item quantity; snapshot per line with names/prices.
- **Migration/compat**: None (code only). Unknown groups/choices, wrong-tenant references, unmet required/min/max, unavailable choices, and client prices all rejected or recomputed.
- **Isolation/rollback**: Validation joins scope definitions to the checkout tenant inside the existing locked transaction; remove selection handling to roll back.

### C3 — Reads: definitions attached, snapshots exposed

- **Why required**: FR-007. Storefront, dashboards, tracking, and exports must show selections with names/prices.
- **Behavior affected**: Public menu items gain `options` (batched reads, no N+1); order views gain per-line `options` from snapshots. Existing fields untouched.
- **Compat/isolation/rollback**: Additive fields; tenant-scoped reads; drop attachments to roll back.

### C4 — Management + storefront UI on existing patterns

- **Why required**: FR owner self-sufficiency (US3) and simple customer picking (US2).
- **Behavior affected**: Admin dashboard manages groups/choices like categories/items; storefront renders pickers with price context and blocks invalid states client-side (server re-validates). No new pages, components, or stylesheets.
- **Compat/rollback**: Additive UI; remove to roll back.

### Explicit non-changes

- No subscriptions, pre-orders, inventory, coupons, accounts, loyalty, payments, i18n, React, renames, or homepage changes; no new dependencies; no shared-store changes.

## Complexity Tracking

> No constitution violations. No entries.

## Phase 0 / Phase 1 Artifacts

- `research.md` — decisions, rationale, rejected alternatives.
- `data-model.md` — entities and the three-table delta.
- `contracts/` — options contracts (additive-only).
- `quickstart.md` — runnable validation guide.
