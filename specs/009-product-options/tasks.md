# Tasks: Product Options (Task 5)

**Input**: Design documents from `specs/009-product-options/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md, plus Tasks 1–4 baseline in working tree
**Tests**: Included — required by Constitution XXV and spec verification expectations (SC-002/SC-004/SC-005).
**Organization**: Grouped by user story; each story independently testable. One additive migration; no new frameworks or dependencies.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Baseline readiness for options work

- [X] T001 Confirm options-free baseline: flat `menu_items`, item-plus-quantity checkout in server/services/orders.service.js, flat snapshots, tenant-scoped menu CRUD in server/services/menu.service.js
- [X] T002 [P] Confirm idempotent migration runner state in database/migrate.js and Node >= 20 toolchain with tests/helpers.js disposable-DB wiring

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Definition tables everything depends on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Create database/migrations/023_item_options.sql with `option_groups` (name 1–60 unique per item, `is_required DEFAULT FALSE`, `min_picks DEFAULT 0`, `max_picks DEFAULT 1`, `pricing DEFAULT 'adjust'` with replace-implies-single-pick CHECK) and `option_choices` (name 1–60 unique per group, `price_cents >= 0`, `max_quantity 1–99 DEFAULT 1`, `is_available DEFAULT TRUE`), tenant/product FK cascades, idempotent `CREATE TABLE IF NOT EXISTS` pattern
- [X] T004 Implement tenant-scoped group/choice CRUD in server/services/options.service.js mirroring server/services/menu.service.js (explicit ownership asserts, allowlisted fields, parameterized SQL)

**Checkpoint**: Foundation ready — migration re-runs as no-op; definitions manageable per tenant

---

## Phase 3: User Story 1 - Option-free preservation (Priority: P1) 🎯 MVP

**Goal**: Products and orders without options behave byte-identically

**Independent Test**: Replay all existing product, cart, checkout, tracking, and history checks on option-free products with zero difference

### Tests for User Story 1

- [X] T005 [P] [US1] Add preservation coverage in tests/options-preservation.test.js asserting option-free view/cart/checkout/tracking/history match pre-Task-5 behavior and empty option sets attach cleanly

### Implementation for User Story 1

- [ ] T006 [US1] Run preservation plus predecessor suites tests/options-preservation.test.js, tests/orders.test.js, and tests/foundation-regression.test.js against the migrated disposable DB and fix only regressions (no behavior changes) — BLOCKED: no TEST_DATABASE_URL in this environment

**Checkpoint**: US1 independently green — MVP shippable

---

## Phase 4: User Story 2 - Simple customer picking (Priority: P2)

**Goal**: Size variants, add-ons, and multi-choice groups orderable through obvious picks with correct totals

**Independent Test**: Configure one product of each example kind and complete guest checkout on each with correct per-choice pricing

### Tests for User Story 2

- [X] T007 [P] [US2] Add example-kind coverage in tests/options-ordering.test.js for size-replace variant, add-on extras, and multi-choice group with required-group blocking and min-max enforcement
- [X] T008 [P] [US2] Add tamper coverage in tests/options-tamper.test.js for unknown options, wrong-tenant references, client-priced choices, unmet required groups, over-max picks, and unavailable choices

### Implementation for User Story 2

- [X] T009 [US2] Extend server/validators/index.js with selection validators (explicit allowlist `{groupId, choices:[{choiceId, quantity}]}`) and definition validators for groups/choices per specs/009-product-options/data-model.md constraints
- [X] T010 [US2] Extend server/services/orders.service.js checkout to validate selections against tenant-scoped definitions in-transaction, compute unit as replace-pick price or base plus adjust contributions times choice quantities, and write `order_item_options` snapshot rows with frozen names/prices
- [X] T011 [US2] Attach definitions to public menu reads in server/services/menu.service.js plus restaurants.service.js public view (batched, no N+1) and snapshots to order reads in server/services/orders.service.js per specs/009-product-options/contracts/options-contract.md
- [X] T012 [US2] Render pickers with price context and selection display in cart/confirmation in client/js/restaurant.js using existing card/overlay patterns (no new pages; server re-validates everything)

**Checkpoint**: US1 and US2 independently functional with server-truth pricing

---

## Phase 5: User Story 3 - Owner-defined options (Priority: P3)

**Goal**: Tenant admins define groups/choices on the shared dashboard, isolated per business

**Independent Test**: Define options on one business and confirm another sees and can use none of them

### Tests for User Story 3

- [X] T013 [P] [US3] Add management coverage in tests/options-manage.test.js for group/choice CRUD, tenant isolation both directions, and snapshot survival across definition edits and deletions

### Implementation for User Story 3

- [X] T014 [US3] Wire group/choice endpoints in server/routes/admin.routes.js via server/controllers/admin.controller.js under existing tenant gates reusing category/item envelope conventions
- [X] T015 [US3] Render group/choice management in client/js/admin.js using existing list/form patterns (no new pages)

**Checkpoint**: All user stories independently functional on one shared platform

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Whole-feature gates from quickstart.md

- [X] T016 Verify no-configurator guardrails across client/js/restaurant.js and client/js/admin.js: selection UI stays pick-and-confirm with no rule builders or pricing formulas (verify-only; remove any accidental complexity found)
- [ ] T017 [P] Run full validation in specs/009-product-options/quickstart.md (migrate, define, order each kind, enforce, freeze, regression gates) — BLOCKED: no TEST_DATABASE_URL in this environment
- [ ] T018 Run npm run check via scripts/check-syntax.js (0 failures required) and full node --test suite in tests/ against the disposable TEST_DATABASE_URL — PARTIAL: check green (95 files, 0 failures); suite BLOCKED: no TEST_DATABASE_URL

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — starts immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phases 3–5)**: All depend on Foundational; then priority order (P1 → P2 → P3) or parallel if staffed
- **Polish (Phase 6)**: Depends on all desired stories being complete

### User Story Dependencies

- **US1 (P1)**: After Foundational only — MVP, no other dependencies
- **US2 (P2)**: After Foundational — shares checkout/menu flows, independently testable
- **US3 (P3)**: After Foundational — shares menu/admin flows, independently testable

### Within Each Story

- Tests written and FAIL before implementation
- Migration before service (T003 before T004)
- Validators before checkout pricing (T009 before T010)
- Reads after writes (T011 after T010)
- Story checkpoint green before next priority

### Parallel Opportunities

- T002 runs parallel with T001 (different files, no dependency)
- T005, T007, T008, T013 run in parallel once Foundational lands (separate new test files)
- T009 (validators) runs parallel with T004 (service) — different files; T010 depends on both
- T014 (routes/controller) runs parallel with T015 (frontend) — different surfaces
- T017 runs parallel with T016 (validation guide vs file checks)

---

## Parallel Example: Post-Foundation Test Kickoff

```bash
# Launch one test file per story together (separate files, no shared edits):
Task: "Add preservation coverage in tests/options-preservation.test.js"
Task: "Add example-kind coverage in tests/options-ordering.test.js"
Task: "Add tamper coverage in tests/options-tamper.test.js"
Task: "Add management coverage in tests/options-manage.test.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (baseline confirmed)
2. Complete Phase 2: Foundational (definition tables + CRUD service)
3. Complete Phase 3: US1 preservation green
4. **STOP and VALIDATE**: option-free flows identical, empty sets attach cleanly
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → definitions manageable, nothing visible to customers
2. US1 → zero-regression proof → deployable MVP
3. US2 → sized/customized ordering with server-truth pricing → demo
4. US3 → owner self-service on shared dashboard → full feature

---

## Notes

- [P] tasks touch different files with no pending dependencies; T010 waits for T004+T009; T011 waits for T010
- Field constraints quoted verbatim from data-model.md — names 1–60, non-negative money, quantities 1–99, replace-implies-single-pick
- Reviewer-owned checklists are gates only; implementation must not toggle their markers
- Constitution gates (isolation, server-side money, additive migrations, check-syntax 0 failures) block every phase

---

## Phase 7: Convergence

- [X] T019 Show option names with quantities in admin dashboard order lines in client/js/admin.js per FR-007 (partial)
- [X] T020 Add options summary column to the admin orders CSV export in server/services/orders.service.js and server/controllers/admin.controller.js per FR-007 (partial)
