# Tasks: Food Business Types (Task 2)

**Input**: Design documents from `specs/006-food-business-types/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md, plus Task 1 baseline (`specs/005-food-business-foundation/`, migration `021`, plumbing, 4 foundation tests in working tree)
**Tests**: Included — required by Constitution XXV and spec verification expectations (SC-002/SC-004/SC-005).
**Organization**: Grouped by user story; each story independently testable. Additive-only; no migration, no new routes, no new dependencies.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Baseline readiness on top of the Task 1 working tree

- [X] T001 Confirm Task 1 baseline present in working tree: database/migrations/021_business_type.sql, validators/service/controller plumbing, owner form type inputs, tests/foundation-*.test.js
- [X] T002 [P] Confirm idempotent migration runner state in database/migrate.js and Node >= 20 toolchain with tests/helpers.js disposable-DB wiring

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Nothing to build — Task 1 foundation stands; record the no-migration decision as the gate

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Verify zero-migration decision per specs/006-food-business-types/research.md R3 (021 covers all stored attributes; visibility is display, owner-only is authorization, six-kind coverage is tests)

**Checkpoint**: Foundation ready — Task 1 baseline confirmed, no schema work outstanding

---

## Phase 3: User Story 1 - Existing restaurant unchanged (Priority: P1) 🎯 MVP

**Goal**: Pre-Task-1 restaurants behave byte-identically after Task 2

**Independent Test**: Replay pre-Task-2 acceptance checks (menu, cart, guest pickup/delivery checkout, tracking, dashboard) on a legacy restaurant with zero difference

### Tests for User Story 1

- [X] T004 [P] [US1] Add legacy-preservation coverage in tests/domain-legacy.test.js asserting unchanged URLs, slugs, orders, users, menu items, settings, and guest checkout behavior for a default-type restaurant

### Implementation for User Story 1

- [ ] T005 [US1] Run legacy plus Task 1 regression suites — BLOCKED: no TEST_DATABASE_URL in this environment tests/domain-legacy.test.js, tests/foundation-regression.test.js, and tests/orders.test.js against the migrated disposable DB and fix only regressions (no behavior changes)

**Checkpoint**: US1 independently green — MVP shippable

---

## Phase 4: User Story 2 - Typed business on shared platform (Priority: P2)

**Goal**: Each required kind operates with stored type on the shared ordering flow; type visible in dashboards only

**Independent Test**: Create one business of each required type and complete a guest order on each through the unchanged shared flow

### Tests for User Story 2

- [X] T006 [P] [US2] Add six-kind ordering coverage in tests/domain-business-types.test.js for create plus guest order on restaurant, cafe, bakery, dessert_shop, home_kitchen, and cloud_kitchen via the shared flow
- [X] T007 [US2] Add dashboards-only and owner-only locks in tests/domain-business-types.test.js (append to the file created by T006, do not overwrite): owner list/detail and admin myRestaurant expose businessType, storefront renders no type badge, admin settings PATCH carrying businessType leaves stored type unchanged while owner PATCH changes it

### Implementation for User Story 2

- [X] T008 [US2] Expose read-only businessType defaulting to `'restaurant'` in server/controllers/admin.controller.js myRestaurant response per specs/006-food-business-types/contracts/dashboard-contract.md
- [X] T009 [US2] Render type cell in the owner restaurants table in client/js/owner.js and type readout in client/js/admin.js from the already-fetched payloads using existing escaping patterns (no storefront changes)

**Checkpoint**: US1 and US2 independently functional on the shared platform

---

## Phase 5: User Story 3 - Capabilities vary without duplication (Priority: P3)

**Goal**: Type-appropriate capabilities configured on the shared flow; delivery-disabled type refuses delivery with pickup intact

**Independent Test**: Disable delivery for one type, confirm refusal with pickup intact, and confirm no type-specific code path exists

### Tests for User Story 3

- [X] T010 [P] [US3] Add capability coverage in tests/domain-capabilities.test.js for delivery-disabled refusal with pickup intact and cross-type isolation both directions

### Implementation for User Story 3

- [X] T011 [US3] Verify core-four capability mapping end to end via server/services/restaurants.service.js read paths and server/services/orders.service.js write-time re-validation with zero type branching (no code change expected; record evidence)

**Checkpoint**: All user stories independently functional with a single shared flow

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Whole-feature gates from quickstart.md

- [X] T012 Verify currency foundation preservation across types and visual-identity freeze via client/js/api.js formatting and client/ pages (verify-only, no changes)
- [ ] T013 [P] Run full validation — BLOCKED: no TEST_DATABASE_URL in this environment in specs/006-food-business-types/quickstart.md (migrate, dashboards, six-kind ordering, locks, negative paths, isolation, regression gates)
- [ ] T014 Run npm run check — PARTIAL: npm run check green (84 files, 0 failures); node --test BLOCKED: no TEST_DATABASE_URL via scripts/check-syntax.js (0 failures required) and full node --test suite in tests/ against the disposable TEST_DATABASE_URL

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — starts immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories (decision gate, no build)
- **User Stories (Phases 3–5)**: All depend on Foundational; then priority order (P1 → P2 → P3) or parallel if staffed
- **Polish (Phase 6)**: Depends on all desired stories being complete

### User Story Dependencies

- **US1 (P1)**: After Foundational only — MVP, no other dependencies
- **US2 (P2)**: After Foundational — shares US1 flows, independently testable
- **US3 (P3)**: After Foundational — shares US1/US2 flows, independently testable

### Within Each Story

- Tests written and FAIL before implementation
- Contract/display task (T008) before rendering tasks (T009)
- Story checkpoint green before next priority

### Parallel Opportunities

- T002 runs parallel with T001 (different files, no dependency)
- T004, T006, T010 run in parallel once Foundational lands (separate new test files); T007 follows T006 (appends to the same file)
- T008 (controller) runs parallel with T009 (frontend files) — different surfaces
- T013 runs parallel with T012 (validation guide vs file checks)

---

## Parallel Example: Post-Foundation Test Kickoff

```bash
# Launch one test file per story together (separate files, no shared edits):
Task: "Add legacy-preservation coverage in tests/domain-legacy.test.js"
Task: "Add six-kind ordering coverage in tests/domain-business-types.test.js"
Task: "Add capability coverage in tests/domain-capabilities.test.js"
# Then, after T006 lands (same file — sequential):
Task: "Add dashboards-only and owner-only locks in tests/domain-business-types.test.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (baseline confirmed)
2. Complete Phase 2: Foundational (zero-migration gate)
3. Complete Phase 3: US1 legacy preservation green
4. **STOP and VALIDATE**: legacy restaurant ordering and dashboard unchanged
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → baseline confirmed, no schema work
2. US1 → zero-regression proof → deployable MVP
3. US2 → six kinds ordering + dashboard visibility + locks → demo
4. US3 → capability variance proof on shared flow → full feature

---

## Notes

- [P] tasks touch different files with no pending dependencies; T006/T007 share tests/domain-business-types.test.js sequentially within their file — kept parallel-safe by appending distinct describes (same-file coordination noted for implementer)
- T006/T007 target the same new test file: implementer MUST append (not overwrite) when executing the second task
- Field constraints quoted verbatim from data-model.md — closed type set, `'restaurant'` default, owner-only mutation, dashboards-only visibility
- Reviewer-owned checklists are gates only; implementation must not toggle their markers
- Constitution gates (isolation, integer money, additive-only change, check-syntax 0 failures) block every phase
