# Tasks: Per-Business Currency (Task 3)

**Input**: Design documents from `specs/007-per-business-currency/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md, plus Tasks 1–2 baseline in working tree
**Tests**: Included — required by Constitution XXV and spec verification expectations (SC-002/SC-004/SC-005/SC-006).
**Organization**: Grouped by user story; each story independently testable. One additive migration; no new routes, frameworks, or dependencies.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Baseline readiness on the Tasks 1–2 working tree

- [X] T001 Confirm Tasks 1–2 baseline present: database/migrations/021_business_type.sql, currency plumbing, owner/admin currency inputs, tests/foundation-*.test.js and tests/domain-*.test.js
- [X] T002 [P] Confirm idempotent migration runner state in database/migrate.js and Node >= 20 toolchain with tests/helpers.js disposable-DB wiring

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Snapshot column everything depends on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Create database/migrations/022_orders_currency.sql with `currency TEXT`, settings-derived backfill for NULLs, then `SET DEFAULT 'USD'` plus ISO-3 CHECK, idempotent `ADD COLUMN IF NOT EXISTS` pattern
- [X] T004 Extend server/services/orders.service.js checkout insert to write the currency snapshot from the locked settings row in the same transaction

**Checkpoint**: Foundation ready — migration re-runs as no-op; new orders carry snapshots

---

## Phase 3: User Story 1 - Legacy works untouched (Priority: P1) 🎯 MVP

**Goal**: Pre-Task-3 businesses operate with zero difference and zero data repair

**Independent Test**: Replay all ordering, tracking, dashboard, analytics, and export checks on a legacy business with identical results

### Tests for User Story 1

- [X] T005 [P] [US1] Add backfill-preservation coverage in tests/currency-legacy.test.js asserting migrated historical orders display today's values and context, and guest checkout/tracking match pre-Task-3 behavior

### Implementation for User Story 1

- [ ] T006 [US1] Run legacy plus predecessor suites tests/currency-legacy.test.js, tests/orders.test.js, and tests/v2.test.js against the migrated disposable DB and fix only regressions (no behavior changes) — BLOCKED: no TEST_DATABASE_URL in this environment

**Checkpoint**: US1 independently green — MVP shippable

---

## Phase 4: User Story 2 - Business admin sets currency (Priority: P2)

**Goal**: Prepared-eight selection via business settings with display following and storage untouched

**Independent Test**: Change currency through settings and verify display follows while every stored numeric is bit-identical

### Tests for User Story 2

- [X] T007 [P] [US2] Add selection coverage in tests/currency-selection.test.js for each prepared code (ILS, USD, EUR, GBP, JOD, SAR, AED, EGP), malformed-code 400 with stored value intact, and no-conversion proof across a change

### Implementation for User Story 2

- [X] T008 [US2] Offer the prepared eight in client/js/admin.js settings input and client/js/owner.js create input using existing select patterns (validator stays open to any ISO-3 code per specs/007-per-business-currency/research.md R2)
- [X] T009 [US2] Remove currency from the owner-update settings proxy in server/controllers/owner.controller.js, keeping the creation default (business-admin path owns mutation)

**Checkpoint**: US1 and US2 independently functional

---

## Phase 5: User Story 3 - History keeps creation context (Priority: P3)

**Goal**: Tracked and reported old orders show original values and context after currency changes

**Independent Test**: Place order, change currency, re-track with original values and context intact

### Tests for User Story 3

- [X] T010 [P] [US3] Add snapshot coverage in tests/currency-snapshot.test.js for tracking, order views, and revenue grouping by snapshot across a currency change

### Implementation for User Story 3

- [X] T011 [US3] Switch tracking and order-view reads in server/services/orders.service.js from the live-settings currency join to the order snapshot, keeping the join only as documented fallback
- [X] T012 [US3] Add per-currency grouping to revenue aggregates in server/services/orders.service.js and server/services/restaurants.service.js as additive fields with no totals removed and no conversion

**Checkpoint**: All user stories independently functional with immutable history

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Whole-feature gates from quickstart.md

- [X] T013 Verify exports, dashboards, and analytics carry currency context with zero unlabeled mixed totals via server/controllers/owner.controller.js, server/controllers/admin.controller.js, and client/ pages (verify-only, minimal display fixes only if a gap is found)
- [ ] T014 [P] Run full validation in specs/007-per-business-currency/quickstart.md (migrate, legacy, selection, no-conversion, history, aggregates, regression gates) — BLOCKED: no TEST_DATABASE_URL in this environment
- [ ] T015 Run npm run check via scripts/check-syntax.js (0 failures required) and full node --test suite in tests/ against the disposable TEST_DATABASE_URL — PARTIAL: check green (87 files, 0 failures); suite BLOCKED: no TEST_DATABASE_URL

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — starts immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phases 3–5)**: All depend on Foundational; then priority order (P1 → P2 → P3) or parallel if staffed
- **Polish (Phase 6)**: Depends on all desired stories being complete

### User Story Dependencies

- **US1 (P1)**: After Foundational only — MVP, no other dependencies
- **US2 (P2)**: After Foundational — shares checkout/display paths, independently testable
- **US3 (P3)**: After Foundational — builds on snapshot writes, independently testable

### Within Each Story

- Tests written and FAIL before implementation
- Migration before snapshot writes (T003 before T004)
- Snapshot writes before snapshot reads (T004 before T011)
- Story checkpoint green before next priority

### Parallel Opportunities

- T002 runs parallel with T001 (different files, no dependency)
- T005, T007, T010 run in parallel once Foundational lands (separate new test files)
- T008 (frontend files) runs parallel with T009 (controller) — different surfaces
- T011 and T012 touch different services — sequential preferred (shared checkout context), kept unmarked
- T014 runs parallel with T013 (suite run vs file checks)

---

## Parallel Example: Post-Foundation Test Kickoff

```bash
# Launch one test file per story together (separate files, no shared edits):
Task: "Add backfill-preservation coverage in tests/currency-legacy.test.js"
Task: "Add selection coverage in tests/currency-selection.test.js"
Task: "Add snapshot coverage in tests/currency-snapshot.test.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (baseline confirmed)
2. Complete Phase 2: Foundational (snapshot column + checkout writes)
3. Complete Phase 3: US1 backfill preservation green
4. **STOP and VALIDATE**: legacy ordering, tracking, analytics, exports identical
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → snapshots flowing, history backfilled
2. US1 → zero-regression proof → deployable MVP
3. US2 → owner selection with no-conversion guarantee → demo
4. US3 → immutable history + contextualized aggregates → full feature

---

## Notes

- [P] tasks touch different files with no pending dependencies; T011/T012 stay sequential (shared service context)
- Field constraints quoted verbatim from data-model.md — ISO-3 rule, `'USD'` default, snapshot immutability, no-conversion
- Reviewer-owned checklists are gates only; implementation must not toggle their markers
- Constitution gates (isolation, integer money, additive migrations, check-syntax 0 failures) block every phase
