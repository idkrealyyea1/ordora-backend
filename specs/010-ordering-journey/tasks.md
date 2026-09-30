# Tasks: Ordering Journey (Tasks 6–8)

**Input**: Design documents from `specs/010-ordering-journey/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md, plus Tasks 1–5 baseline in working tree
**Tests**: Included — required by Constitution XXV and spec Part C (valid/invalid transitions, edge cases).
**Organization**: Grouped by user story; each story independently testable. One column-only migration; no new routes, frameworks, or dependencies.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Baseline readiness for journey work

- [X] T001 Confirm journey baseline: 7 enforced statuses with transition map in server/services/orders.service.js, transactional checkout with submission-key idempotency, codeless tracking, in-process SSE hub in server/middleware/sse.js, zero pre-order code
- [X] T002 [P] Confirm idempotent migration runner state in database/migrate.js and Node >= 20 toolchain with tests/helpers.js disposable-DB wiring

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Pre-order columns everything depends on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Create database/migrations/024_item_preorder.sql with `menu_items.is_preorder BOOLEAN DEFAULT FALSE` plus `preorder_note TEXT DEFAULT ''` (length-capped) and `order_items.is_preorder BOOLEAN DEFAULT FALSE` plus `preorder_note TEXT DEFAULT ''`, idempotent `ADD COLUMN IF NOT EXISTS` pattern
- [X] T004 Extend server/validators/index.js with pre-order field validators (flag boolean, message text 1–300, explicit allowlists) and extend server/services/menu.service.js item CRUD to carry the fields tenant-scoped

**Checkpoint**: Foundation ready — migration re-runs as no-op; normal items read with pre-order off

---

## Phase 3: User Story 1 - Knowing pre-order purchase (Priority: P1) 🎯 MVP

**Goal**: Pre-order products identified, explained, validated, and snapshotted; normal products untouched

**Independent Test**: Enable pre-order on one product, order as guest, and confirm messaging, timing, snapshot, and tracking truth

### Tests for User Story 1

- [X] T005 [P] [US1] Add pre-order coverage in tests/journey-preorder.test.js asserting badge/message presence, stale-claim refusal, snapshot immutability across disable/reword, and normal-product byte-identity

### Implementation for User Story 1

- [X] T006 [US1] Extend server/services/orders.service.js checkout to validate pre-order rules and freeze flag plus message per line in-transaction, then expose snapshots in tracking and order reads per specs/010-ordering-journey/contracts/journey-contract.md
- [X] T007 [US1] Render pre-order badge, message, and cart/tracking notes in client/js/restaurant.js and client/js/track.js plus item-modal toggle and message in client/js/admin.js using existing patterns (no new pages)

**Checkpoint**: US1 independently verifiable — MVP shippable

---

## Phase 4: User Story 2 - Minimal guest journey (Priority: P1)

**Goal**: Link-to-tracked-order flow with correct totals, atomic idempotent creation, and zero extra steps

**Independent Test**: Complete the full journey on a phone with a mixed cart and confirm totals with no account

### Tests for User Story 2

- [X] T008 [P] [US2] Add journey coverage in tests/journey-checkout.test.js asserting review-step totals, tampered-price neutralization, duplicate-submit single order, and no partial orders on injected failures

### Implementation for User Story 2

- [X] T009 [US2] Verify checkout totals, idempotency, atomicity, and minimal-detail validation end to end in server/services/orders.service.js plus server/validators/index.js (verify-only; fix gaps only if found, no flow redesign)

**Checkpoint**: US1 and US2 independently functional on the shared flow

---

## Phase 5: User Story 3 - Shared order truth (Priority: P2)

**Goal**: Enforced transitions with terminal immutability, matching dashboard/SSE/timeline, and safe repeats

**Independent Test**: Walk every valid transition plus invalid attempts and compare dashboard, events, and timeline at each step

### Tests for User Story 3

- [X] T010 [P] [US3] Add lifecycle coverage in tests/journey-lifecycle.test.js asserting every valid transition, every invalid jump (including terminal edits and wrong-type states), repeat-update safety, SSE agreement, and timeline truth per variant

### Implementation for User Story 3

- [X] T011 [US3] Verify transition enforcement, terminal immutability, SSE broadcasts, and timeline projection in server/services/orders.service.js, server/middleware/sse.js, and client/js/track.js (verify-only; fix gaps only if found, no model change)

**Checkpoint**: All user stories independently functional with one shared truth

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Whole-feature gates from quickstart.md

- [ ] T012 Verify legacy regression — BLOCKED: no TEST_DATABASE_URL in this environment;  across pre-Task-6 checks plus currency/option/type preservation via tests/orders.test.js, tests/v2.test.js, and predecessor suites (verify-only gate, no behavior changes)
- [ ] T013 [P] Run full validation — BLOCKED: no TEST_DATABASE_URL in this environment;  in specs/010-ordering-journey/quickstart.md (migrate, pre-order truth, full journey, robustness, lifecycle, regression gates)
- [ ] T014 Run npm run check — PARTIAL: npm run check green (98 files, 0 failures); node --test BLOCKED: no TEST_DATABASE_URL;  via scripts/check-syntax.js (0 failures required) and full node --test suite in tests/ against the disposable TEST_DATABASE_URL

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — starts immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phases 3–5)**: All depend on Foundational; then priority order (P1 → P2 → P3) or parallel if staffed
- **Polish (Phase 6)**: Depends on all desired stories being complete

### User Story Dependencies

- **US1 (P1)**: After Foundational only — MVP, no other dependencies
- **US2 (P1)**: After Foundational — shares checkout flows, independently testable
- **US3 (P2)**: After Foundational — shares status/tracking flows, independently testable

### Within Each Story

- Tests written and FAIL before implementation
- Migration before rules (T003 before T004)
- Rules before display (T006 before T007)
- Verify-only tasks fix gaps only if found
- Story checkpoint green before next priority

### Parallel Opportunities

- T002 runs parallel with T001 (different files, no dependency)
- T005, T008, T010 run in parallel once Foundational lands (separate new test files)
- T007 (frontend files) runs parallel with T006 (service) — different surfaces
- T009 and T011 are verify-only across different surfaces — sequential preferred, kept unmarked
- T013 runs parallel with T012 (validation guide vs suite checks)

---

## Parallel Example: Post-Foundation Test Kickoff

```bash
# Launch one test file per story together (separate files, no shared edits):
Task: "Add pre-order coverage in tests/journey-preorder.test.js"
Task: "Add journey coverage in tests/journey-checkout.test.js"
Task: "Add lifecycle coverage in tests/journey-lifecycle.test.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (journey baseline confirmed)
2. Complete Phase 2: Foundational (pre-order columns + validators + CRUD)
3. Complete Phase 3: US1 pre-order truth with snapshots
4. **STOP and VALIDATE**: pre-order messaging, snapshots, normal-product identity
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → pre-order flaggable, nothing customer-visible forced
2. US1 → pre-order truth end to end → deployable MVP
3. US2 → hardened minimal journey → demo
4. US3 → shared lifecycle truth → full feature

---

## Notes

- [P] tasks touch different files with no pending dependencies; T009/T011 stay sequential (shared service context)
- Field constraints quoted verbatim from data-model.md — flag defaults false, message length-capped, terminal immutability
- Reviewer-owned checklists are gates only; implementation must not toggle their markers
- Constitution gates (isolation, server-side money, additive migrations, check-syntax 0 failures) block every phase
