# Tasks: Storefront UX (Task 4)

**Input**: Design documents from `specs/008-storefront-ux/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md, plus Tasks 1–3 baseline in working tree
**Tests**: Included — required by Constitution XXV and spec verification expectations (SC-002/SC-004/SC-005).
**Organization**: Grouped by user story; each story independently testable. Presentation-only; no migration, no API change, no new dependencies.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Baseline readiness for storefront work

- [X] T001 Confirm storefront baseline present: client/restaurant.html shell, client/js/restaurant.js renderer, client/css/storefront.css, skeleton/offline states, RTL+English dictionaries
- [X] T002 [P] Confirm no-new-asset budget tooling: record current storefront request count and asset list for client/restaurant.html, client/js/restaurant.js, and client/css/storefront.css as the parity baseline in the task notes

  Asset budget baseline (2026-09-29): restaurant.html 3.1KB, restaurant.js ~30KB, storefront.css ~16.7KB, skeleton.css ~4.4KB; 1 data fetch (menu view) + item/upload images per order flow. No new assets added by this feature.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared accessibility primitives every story builds on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Add `:focus-visible` styles reusing brand tokens in client/css/storefront.css and `aria-label` on the search input in client/js/restaurant.js (both languages via existing dictionaries)

**Checkpoint**: Foundation ready — focus and labeling primitives in place

---

## Phase 3: User Story 1 - Identity in seconds (Priority: P1) 🎯 MVP

**Goal**: Business identity, status, and contact together at the top for every type

**Independent Test**: Load any storefront on a small screen and confirm identity, status, and contact visible on the first screen, with clean omission for missing assets

### Tests for User Story 1

- [X] T004 [P] [US1] Add identity-payload coverage in tests/storefront-identity.test.js asserting the public menu view carries name, logo/cover, status, description, address, contact, and currency fields for open, closed, and asset-missing businesses

### Implementation for User Story 1

- [X] T005 [US1] Render contact phone/whatsapp links in the hero meta row in client/js/restaurant.js from the already-fetched settings using existing esc() and meta styling, omitted cleanly when unset

**Checkpoint**: US1 independently verifiable — MVP shippable

---

## Phase 4: User Story 2 - Frictionless discovery (Priority: P2)

**Goal**: Obvious categories, live search everywhere, unambiguous cards with ungated-truthful availability

**Independent Test**: Find a product via scroll, category, and search each, add it, and confirm price, availability, and cart feedback at every step

### Tests for User Story 2

- [X] T006 [P] [US2] Add discovery coverage in tests/storefront-discovery.test.js asserting category payloads, search-everywhere behavior, soldout non-orderability via checkout refusal, and currency-correct card pricing

### Implementation for User Story 2

- [X] T007 [US2] Tighten active-category affordance, empty states, and card price/availability hierarchy in client/js/restaurant.js within existing markup and classes (no logic change to filtering, position, or cart actions)

**Checkpoint**: US1 and US2 independently functional

---

## Phase 5: User Story 3 - Checkout confidence (Priority: P3)

**Goal**: Always-visible totals with explicit pickup/delivery and unchanged guest confirmation

**Independent Test**: Build a mixed cart, toggle pickup/delivery, and confirm totals stay correct and visible through confirmation and tracking

### Tests for User Story 3

- [X] T008 [P] [US3] Add cart-confidence coverage in tests/storefront-cart.test.js asserting subtotal/fee/total visibility across overlay states and server-confirmed total equality in business currency

### Implementation for User Story 3

- [X] T009 [US3] Ensure totals render on every overlay state in client/js/restaurant.js (including empty-cart and closed-business states) with pickup/delivery toggle behavior identical; add `aria-live="polite"` to the cart bar in client/restaurant.html and the overlay total in client/js/restaurant.js
- [X] T010 [US3] Move focus into the modal on open and return it to the invoking control on close in client/js/restaurant.js (Escape behavior unchanged)

**Checkpoint**: All user stories independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Whole-feature gates from quickstart.md

- [ ] T011 Keyboard-only full journey with visible focus, 200% text scaling, and RTL+English passes per specs/008-storefront-ux/quickstart.md (manual browser pass; record results in task notes) — BLOCKED: no browser in this environment
- [ ] T012 [P] Throttled-connection pass per specs/008-storefront-ux/quickstart.md confirming skeleton/offline behavior and zero new assets/requests versus the T002 baseline (manual pass; record results) — BLOCKED: no browser in this environment
- [ ] T013 Run npm run check via scripts/check-syntax.js (0 failures required) and full node --test suite in tests/ against the disposable TEST_DATABASE_URL — PARTIAL: check green (90 files, 0 failures); suite BLOCKED: no TEST_DATABASE_URL

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — starts immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phases 3–5)**: All depend on Foundational; then priority order (P1 → P2 → P3) or parallel if staffed
- **Polish (Phase 6)**: Depends on all desired stories being complete

### User Story Dependencies

- **US1 (P1)**: After Foundational only — MVP, no other dependencies
- **US2 (P2)**: After Foundational — shares renderer flows, independently testable
- **US3 (P3)**: After Foundational — shares bar/overlay flows, independently testable

### Within Each Story

- Tests written and FAIL before implementation
- Foundational a11y primitives before story rendering work
- Story checkpoint green before next priority

### Parallel Opportunities

- T002 runs parallel with T001 (baseline record vs file confirm, no dependency)
- T004, T006, T008 run in parallel once Foundational lands (separate new test files)
- T009 and T010 touch the same file sequentially — T010 follows T009, kept unmarked
- T012 runs parallel with T011 (separate manual passes); T013 runs parallel with either

---

## Parallel Example: Post-Foundation Test Kickoff

```bash
# Launch one test file per story together (separate files, no shared edits):
Task: "Add identity-payload coverage in tests/storefront-identity.test.js"
Task: "Add discovery coverage in tests/storefront-discovery.test.js"
Task: "Add cart-confidence coverage in tests/storefront-cart.test.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (baseline + asset budget recorded)
2. Complete Phase 2: Foundational (focus styles + search label)
3. Complete Phase 3: US1 identity block + payload coverage
4. **STOP and VALIDATE**: first-screen identity across types and asset states
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → a11y primitives in place
2. US1 → identity clarity → deployable MVP
3. US2 → discovery polish → demo
4. US3 → cart confidence + focus management → full feature

---

## Notes

- [P] tasks touch different files with no pending dependencies; T009/T010 share client/js/restaurant.js sequentially
- Manual browser passes (T011/T012) record results in task notes; they gate release, not each other
- Reviewer-owned checklists are gates only; implementation must not toggle their markers
- Constitution gates (identity freeze, integer money, additive-only change, check-syntax 0 failures) block every phase
