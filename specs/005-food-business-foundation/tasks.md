# Tasks: Food Business Foundation

**Input**: Design documents from `specs/005-food-business-foundation/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md
**Tests**: Included — required by Constitution XXV and spec acceptance (SC-002 zero-regression gate).
**Organization**: Grouped by user story; each story independently testable. Only additive changes; no rewrite, React, or new framework.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Baseline and runner readiness before any change

- [X] T001 Verify toolchain and disposable-DB wiring in tests/helpers.js (Node >= 20, explicit TEST_DATABASE_URL, never production)
- [X] T002 [P] Confirm idempotent migration runner ordering in database/migrate.js (schema_migrations bookkeeping for new 021 file)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared schema + validation plumbing every story depends on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Create database/migrations/021_business_type.sql with `business_type TEXT NOT NULL DEFAULT 'restaurant'` plus `CHECK (business_type IN ('restaurant','cafe','dessert_shop','bakery','cake_business','home_kitchen','home_food_business','cloud_kitchen','small_food_business'))` using idempotent `ADD COLUMN IF NOT EXISTS` pattern
- [X] T004 Extend server/validators/index.js validateRestaurantCreate and validateRestaurantUpdate to allowlist optional business_type (closed 9, missing defaults to restaurant, unknown throws 400) and optional creation currency (3-letter ISO, same rule as settings)
- [X] T005 Extend server/services/restaurants.service.js createRestaurant, update path, public directory, and public menu view to persist and expose read-only business_type and honor creation-time currency into restaurant_settings
- [X] T006 Extend server/controllers/owner.controller.js createRestaurant and updateRestaurant to pass the new optional fields through existing owner-gated routes (no new routes)

**Checkpoint**: Foundation ready — migration applies and re-runs as no-op; validators reject unknown types; user story work can begin

---

## Phase 3: User Story 1 - Existing restaurant unchanged (Priority: P1) 🎯 MVP

**Goal**: Pre-existing restaurant ordering and management behave byte-identically after the foundation lands

**Independent Test**: Place guest pickup + delivery orders on a pre-existing restaurant and manage both via the existing dashboard with zero change in steps, fields, or behavior

### Tests for User Story 1

- [X] T007 [P] [US1] Add default-type regression coverage in tests/foundation-regression.test.js asserting menu, guest checkout, tracking, and dashboard management match pre-feature behavior on migrated DB

### Implementation for User Story 1

- [ ] T008 [US1] Run existing regression suites — BLOCKED: no TEST_DATABASE_URL in this environment tests/orders.test.js, tests/menu.test.js, and tests/tenant-isolation.test.js against the migrated disposable DB and fix only regressions (no behavior changes)

**Checkpoint**: US1 fully functional and independently testable — MVP shippable even if later stories slip

---

## Phase 4: User Story 2 - New food business type, same system (Priority: P2)

**Goal**: A bakery-type business onboards via the existing owner/request flow and takes guest orders with core-four capabilities, fully isolated

**Independent Test**: Onboard one home bakery, configure its capabilities, complete a guest order end to end on the same flows as US1

### Tests for User Story 2

- [X] T009 [P] [US2] Add business-type coverage in tests/foundation-business-type.test.js for default-to-restaurant, unknown-type 400, delivery-disabled refusal with pickup intact, and cross-tenant denial in both directions

### Implementation for User Story 2

- [X] T010 [US2] Add business-type select to the owner create/edit form in client/js/owner.js and client/owner.html (existing console only, no new pages)
- [X] T011 [US2] Verify capability mapping end to end via server/services/restaurants.service.js read paths and server/services/orders.service.js write-time re-validation (no code change expected; record evidence)

**Checkpoint**: US1 and US2 both work independently on the shared platform with no separate app

---

## Phase 5: User Story 3 - Correct per-business currency (Priority: P2)

**Goal**: Every amount displays in its own business currency while all math stays integer cents server-side

**Independent Test**: Two businesses on different currencies each display, total, and track correctly with zero cross-currency mixing

### Tests for User Story 3

- [X] T012 [P] [US3] Add currency coverage in tests/foundation-currency.test.js for creation-time currency, invalid-currency 400, per-business formatting, server-side recompute ignoring client money, and snapshot immutability of historical orders

### Implementation for User Story 3

- [X] T013 [US3] Add currency select to the owner create form in client/js/owner.js using the existing platform-pricing option list (admin edit path in client/js/admin.js already exists — reuse, do not duplicate)
- [X] T014 [US3] Verify presentation-only formatting via client/js/api.js fmtMoney and client/js/restaurant.js per-business currency fallback (no math changes)

**Checkpoint**: US1–US3 independently functional; currency is owner-editable with integer math preserved

---

## Phase 6: User Story 4 - Pre-order reserve without breakage (Priority: P3)

**Goal**: Today's availability semantics unchanged; public contracts tolerate the future availability expression

**Independent Test**: Available/unavailable messaging and checkout enforcement behave exactly as before; unknown future availability fields do not break clients or checkout

### Tests for User Story 4

- [X] T015 [P] [US4] Add reserve coverage in tests/foundation-preorder-reserve.test.js asserting unknown item availability fields are ignored and is_available plus status, hours, and subscription still gate checkout

### Implementation for User Story 4

- [X] T016 [US4] Verify client tolerance for unknown item fields in client/js/restaurant.js with no behavior change (document-only reserve per specs/005-food-business-foundation/contracts/public-contract.md)

**Checkpoint**: All user stories independently functional; no pre-order engine shipped

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Whole-feature gates from quickstart.md

- [X] T017 Verify robots, sitemap (static plus max 500 active), private-page noindex, visual-identity freeze, and zero fabricated proof via server/routes/site.routes.js behavior and client/ pages (verify-only, no copy changes)
- [ ] T018 [P] Run full validation — BLOCKED: no TEST_DATABASE_URL in this environment in specs/005-food-business-foundation/quickstart.md (migrate, create, order, negative paths, isolation, SEO checks)
- [ ] T019 Run npm run check — PARTIAL: npm run check green (81 files, 0 failures); node --test BLOCKED: no TEST_DATABASE_URL via scripts/check-syntax.js (0 failures required) and full node --test suite in tests/ against the disposable TEST_DATABASE_URL

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — starts immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phases 3–6)**: All depend on Foundational completion; then proceed in priority order (P1 → P2 → P3) or in parallel if staffed
- **Polish (Phase 7)**: Depends on all desired stories being complete

### User Story Dependencies

- **US1 (P1)**: After Foundational only — no dependencies on other stories; MVP
- **US2 (P2)**: After Foundational — integrates with US1 flows but independently testable
- **US3 (P2)**: After Foundational — integrates with US1/US2 display paths but independently testable
- **US4 (P3)**: After Foundational — no dependency on US2/US3 beyond shared contracts

### Within Each Story

- Tests written and FAIL before implementation
- Validators/services before controllers/forms
- Core change before verification task
- Story checkpoint green before next priority

### Parallel Opportunities

- T002 runs parallel with T001 (different files, no dependency)
- T007, T009, T012, T015 run in parallel once Foundational lands (separate new test files)
- US2/US3/US4 form inputs touch client/js/owner.js sequentially — not parallel with each other; keep in phase order
- T018 runs parallel with T017 (validation guide vs route/page checks, different surfaces)

---

## Parallel Example: Post-Foundation Test Kickoff

```bash
# Launch one test file per story together (separate files, no shared edits):
Task: "Add default-type regression coverage in tests/foundation-regression.test.js"
Task: "Add business-type coverage in tests/foundation-business-type.test.js"
Task: "Add currency coverage in tests/foundation-currency.test.js"
Task: "Add reserve coverage in tests/foundation-preorder-reserve.test.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (migration + validators + services + controller passthrough)
3. Complete Phase 3: US1 regression coverage green
4. **STOP and VALIDATE**: guest pickup + delivery on a pre-existing restaurant, dashboard management, full existing suite green
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → migration safe, defaults preserve behavior
2. US1 → zero-regression proof → deployable MVP
3. US2 → new-type bakery ordering on shared flows → demo
4. US3 → owner-editable currency with integer math → demo
5. US4 → contract reserve with no behavior change → full feature

---

## Notes

- [P] tasks touch different files with no pending dependencies; same-file owner-form tasks (T010, T013) stay sequential
- [USn] labels map every story task to its spec story for traceability
- Field constraints quoted verbatim from data-model.md — no implementation-time discretion on the closed set, defaults, or ISO rule
- Reviewer-owned checklists (checklists/requirements.md, checklists/foundation.md) are gates only; implementation must not toggle their markers
- Stop at any checkpoint to validate the story independently; constitution gates (tenant isolation, integer money, additive migrations, check-syntax 0 failures) block every phase
