# Implementation Plan: Ordering Journey (Tasks 6–8)

**Branch**: `010-ordering-journey` | **Date**: 2026-09-29 | **Spec**: `specs/010-ordering-journey/spec.md`

**Input**: Feature specification from `specs/010-ordering-journey/spec.md` plus Clarifications session 2026-09-29 (pre-order timing is message-only, no date field or presets).

**Note**: One coherent journey; pre-order marking is the sole new capability. Checkout, statuses, tracking, and SSE are hardened/verified, not rebuilt. No React, no payments, no reservations, no new dependencies.

## Summary

Add per-product pre-order marking (flag plus owner-written message on `menu_items`, snapshotted per order line) validated at checkout write time, then lock the whole journey with tests: minimal guest checkout with atomic idempotent creation, the preserved 7-status model with enforced transitions and terminal immutability, codeless timeline tracking for pickup/delivery/pre-order variants, and best-effort SSE kept as notification only. Normal products and historical orders behave byte-identically.

## Technical Context

**Language/Version**: Node.js >= 20, vanilla HTML/CSS/JS (no build, no TypeScript)

**Primary Dependencies**: Express 4, pg, existing session/validation/SSE stack (no new dependencies)

**Storage**: PostgreSQL via `server/db/pool.js`; idempotent migrations via `database/migrate.js`. One additive migration in this task (`024_item_preorder.sql`).

**Testing**: `node --test tests/` against explicit `TEST_DATABASE_URL` (disposable DB only) plus `npm run check` (0 failures required)

**Target Platform**: Wasmer Edge (`app.yaml`) + any Node 20 host; single-instance SSE unchanged

**Project Type**: Web application (Express API + vanilla static frontend)

**Performance Goals**: No new NFRs; pre-order checks ride the existing item query inside the checkout transaction; timeline is a read-only projection with no new queries beyond snapshot reads

**Constraints**: Message-only timing (no date fields, no presets); pre-order off by default; integer money untouched; terminal statuses immutable; repeated updates safe; guest checkout; visual identity frozen

**Scale/Scope**: Per-product flag; per-line snapshots; journey verification across all business types

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

- I Preserve Working Functionality: PASS — pre-order off by default; normal lines byte-identical; statuses, tracking, SSE untouched.
- II/III No React / No Rebuild: PASS — extend item/checkout/tracking paths in place; hardening is tests + minimal display.
- IV/V/VI Inspect, Source of Truth, No Guessing: PASS — zero pre-order code (grep-verified), 7 enforced statuses, idempotent transactional checkout, codeless tracking, in-process SSE all verified 2026-09-29.
- VII/VIII Safe Migrations: PASS — single additive migration with safe defaults; drop-columns rollback.
- IX Isolation (NON-NEGOTIABLE): PASS — pre-order fields ride tenant-scoped item/order rows; no scoping change.
- X Security: PASS — explicit allowlist validators; server-side rules; safe errors.
- XI–XIV Deps, Simplicity, No Speculation, Purpose-Gated: PASS — two columns + snapshot columns; no calendar/reservation machinery.
- XV–XXIII Guest checkout, no payments, one system, currency, honest data, identity: PASS — all preserved; pre-order messaging honest by construction.
- XXIV–XXVIII Reliability, tests, verification, flag weak, ask: PASS — transition/tamper/duplication tests extend the suite.

Post-design re-check: PASS — no new violations.

## Project Structure

### Documentation (this feature)

```text
specs/010-ordering-journey/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

Task 6–8 touches only:

```text
database/migrations/024_item_preorder.sql  # NEW: item flag + message, line snapshot columns
server/services/menu.service.js            # item CRUD carries pre-order fields (allowlisted)
server/services/orders.service.js          # checkout validates pre-order rules, snapshots lines
server/validators/index.js                 # pre-order validators (explicit allowlists)
server/controllers/admin.controller.js     # item endpoints pass fields through
client/js/restaurant.js                    # pre-order badge + message + timeline note (existing patterns)
client/js/track.js                         # pre-order representation on timeline
client/js/admin.js                         # item modal pre-order toggle + message (existing patterns)
tests/journey-*.test.js                    # NEW: pre-order, journey, transition, duplication suites
```

**Structure Decision**: Extend the Tasks 1–5 architecture. No new tables beyond two column sets, no new routes, no new layers, no dependencies.

## Existing Inventory (verified 2026-09-29)

- **Statuses**: 7 values with enforced `TRANSITIONS` map; terminal `completed`/`cancelled` with empty outbound sets; revenue counts confirmed+ only.
- **Checkout**: transactional under `FOR UPDATE OF r`; submission-key idempotency with winner-returns; server prices/availability/hours/subscription/options/currency-snapshot at write time; no partial orders (single transaction).
- **Tracking**: codeless `getByCode` with items, options, currency snapshots; tracking page with timeline, totals, cancel actions.
- **SSE**: in-process hub with heartbeat; broadcasts on order create/status/booking; dashboards refetch truth (events are notifications, not state).
- **Lifecycle tests**: `lifecycle-matrix.test.js` covers pickup flow, invalid jumps, unknown statuses, customer cancel windows.
- **Pre-order**: zero implementation beyond Task 1's documented reserve (verified by grep).
- **Untouched**: sessions, CSRF/origin, rate limits, uploads, SEO, identity, bookings, i18n, payments.

## Proposed Changes

### C1 — Pre-order mark: item flag + message, line snapshot columns (the schema change)

- **Why required**: FR-001–FR-003. No existing field carries pre-order meaning; overloading `is_available` would corrupt availability semantics and checkout gating.
- **Behavior affected**: None by default — flag off, message empty; such items behave exactly as today in every flow.
- **Migration strategy**: `024_item_preorder.sql`, idempotent: `menu_items.is_preorder BOOLEAN DEFAULT FALSE` + `preorder_note TEXT DEFAULT ''` (length-capped); `order_items.is_preorder BOOLEAN DEFAULT FALSE` + `preorder_note TEXT DEFAULT ''`. No backfill rewrite (defaults reproduce current behavior).
- **Backward compatibility**: Additive columns; old clients ignore new payload fields.
- **Indexes/constraints**: None new (flag never filters queries; note length CHECK only).
- **Tenant isolation**: Columns ride tenant-scoped rows; no scoping change.
- **Rollback**: Drop the four columns; readers fall back to non-pre-order rendering. Amounts and history untouched.

### C2 — Checkout: pre-order rules validated and snapshotted in-transaction

- **Why required**: FR-003/FR-007/FR-008. Trust boundary is the checkout write; pre-order claims must be re-checked against current definitions like availability.
- **Behavior affected**: Lines for pre-order items carry frozen flag + message; normal lines byte-identical. Pre-order items remain pickup/delivery-eligible per store settings; totals math unchanged.
- **Migration/compat**: None (code only). Stale pre-order claims (disabled or reworded mid-cart) refused before any row exists; idempotency covers retries across all line kinds.
- **Isolation/rollback**: Validation inside the existing locked transaction; remove rule-check to roll back.

### C3 — Display: badge, message, and timeline truth (no flow change)

- **Why required**: FR-002/FR-010/FR-011. Customers and owners must see pre-order truth where they already look.
- **Behavior affected**: Product cards show a pre-order badge + message; cart/tracking/admin order views show the frozen note; timeline marks pre-order orders without changing steps. No new pages, steps, or states.
- **Compat/rollback**: Additive display of additive fields; remove to roll back.

### C4 — Journey hardening: tests pinning the whole path (mostly verify-only)

- **Why required**: FR-005–FR-009 + Part C. Production-readiness is proven, not asserted.
- **Coverage**: pre-order on/off messaging and snapshots; full guest journey per business type; tampered/duplicate/partial-failure cases; every valid and invalid transition incl. terminal immutability and repeat-update safety; timeline truth per variant; SSE recovery to truth; legacy regression.
- **Rollback**: N/A (tests only; existing suites unweakened).

### Explicit non-changes

- No status-model change, no new states, no checkout-step change, no reservations/calendars, no driver/GPS/maps/settlement, no delivery platform, no payments, no accounts, no new dependencies, no shared-store changes.

## Complexity Tracking

> No constitution violations. No entries.

## Phase 0 / Phase 1 Artifacts

- `research.md` — decisions, rationale, rejected alternatives.
- `data-model.md` — entities and the column delta.
- `contracts/` — journey contract deltas (additive-only).
- `quickstart.md` — runnable validation guide.
