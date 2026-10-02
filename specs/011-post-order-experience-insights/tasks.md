# Tasks: Post-Order Experience Insights (Tasks 9–12)

**Input**: Design documents from `specs/011-post-order-experience-insights/` (spec.md, plan.md, research.md, data-model.md, contracts/, quickstart.md + clarification session 2026-09-30)

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included — required by Constitution XXV and spec Testing requirements (TDD, smallest runnable check, never weaken existing tests).

**Organization**: Grouped by user story; each story independently testable. polling-only guests, visual-only prominence, persisted notification events, foundation-only Web Push, presets + bounded custom range per clarifications.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Baseline readiness before any new work

- [X] T001 Confirm Tasks 1–8 baseline in server/services/orders.service.js (7-status TRANSITIONS, submission-key idempotency, frozen currency/option/preorder snapshots), server/middleware/sse.js hub, client/js/track.js polling, server/controllers/admin.controller.js analytics/events
- [X] T002 [P] Confirm idempotent migration runner state in database/migrate.js and Node >= 20 toolchain with tests/helpers.js disposable-DB wiring

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Notification persistence + shared validation everything depends on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Create database/migrations/025_notifications.sql with `notification_events` (`id UUID PK`, `restaurant_id UUID NOT NULL`, `event_key TEXT NOT NULL UNIQUE`, `event_type TEXT NOT NULL`, `order_id UUID NULL`, `order_code TEXT NULL`, `status TEXT NULL`, `channel TEXT NOT NULL`, `state TEXT NOT NULL DEFAULT 'pending'`, `attempts INT NOT NULL DEFAULT 0`, `created_at/updated_at TIMESTAMPTZ`) plus `push_subscriptions` (`id UUID PK`, `restaurant_id UUID NULL`, `endpoint TEXT NOT NULL UNIQUE`, `p256dh TEXT NOT NULL`, `auth TEXT NOT NULL`, `is_active BOOL DEFAULT TRUE`, `created_at/updated_at TIMESTAMPTZ`), indexes on `(restaurant_id, created_at)`, `(event_key)`, `(state, created_at)`, all `IF NOT EXISTS`
- [X] T004 Create server/services/notifications.service.js with `emit({restaurantId, type, orderId, orderCode, status})` (persists one row per channel keyed by `eventKey`, fans out asynchronously, never throws into order transactions), `registerChannel(name, {send})`, tenant check on `restaurantId`, and `dashboard_sse` adapter wrapping server/middleware/sse.js broadcast
- [X] T005 Extend server/validators/index.js with custom-range validation (`from`/`to` valid calendar dates, `from ≤ to`, span ≤ 90 days, mutually exclusive with `days`) reusing existing bounded-days conventions

**Checkpoint**: Foundation ready — migration re-runs as no-op; `emit()` callable with no channels broken; range validator rejects bad input

---

## Phase 3: User Story 1 - Guest confirmation and tracking (Task 9) (Priority: P1) 🎯 MVP

**Goal**: Full post-order summary, kind-correct tracking on improved polling, live-definition reorder, plain error states — no login, AR+EN

**Independent Test**: Mixed delivery cart (normal + pre-order with options) as guest → confirmation shows code/type/lines/options/fees/total/currency/pre-order note/timing/next steps → track link shows 6-step delivery timeline → owner advances status → guest sees it within polling interval → reorder rebuilds from live definitions

### Tests for User Story 1

- [X] T006 [P] [US1] Add confirmation/tracking/reorder coverage in tests/journey-confirmation.test.js asserting full summary fields, pickup (5-step) vs delivery (6-step) timelines, cancelled terminal, polling visibility resume, reorder with deleted/repriced items and stale-option refusal, uniform 404 with no PII

### Implementation for User Story 1

- [X] T007 [US1] Extend renderSuccess in client/js/restaurant.js to render server-confirmed code, pickup/delivery badge, item lines with quantities and selected options/variants, subtotal, delivery fee, total in frozen order currency, pre-order messages, timing, and next steps with track links (`/track.html?code=` and `/track?code=`) per specs/011-post-order-experience-insights/contracts/guest-tracking.md
- [X] T008 [US1] Extend client/js/track.js with visibility-aware polling (pause on hidden, refresh on visible, manual refresh control, stop on `completed|cancelled`), kind-correct timeline projection, pre-order badges with frozen notes, currency-correct frozen totals, and plain-language error/offline states per specs/011-post-order-experience-insights/contracts/guest-tracking.md
- [X] T009 [US1] Extend reorder in client/js/track.js and client/js/restaurant.js to carry option selections (`menu_item_id:qty:choiceId x qty`) and rebuild from live menu definitions (available items, current prices, valid choices only; dropped/changed entries listed, stale money never applied) per specs/011-post-order-experience-insights/contracts/guest-tracking.md
- [X] T010 [P] [US1] Add AR+EN strings for all new confirmation/tracking/reorder/error UI in client/js/i18n.js (both dictionaries, no layout breakage RTL/LTR)

**Checkpoint**: US1 independently verifiable — MVP shippable

---

## Phase 4: User Story 2 - Owner order operations (Task 10) (Priority: P1)

**Goal**: New orders instantly visible with full detail; pickup/delivery and pre-order unmistakable; valid transitions only; frozen history

**Independent Test**: With dashboard open place delivery + pre-order orders → both prominent within seconds with complete detail → advance one status, attempt invalid jump + double-submit, review yesterday's frozen snapshot, cross-tenant read denied

### Tests for User Story 2

- [X] T011 [P] [US2] Add board coverage in tests/operations-board.test.js asserting new-order prominence ordering, delivery-address presence vs pickup absence, pre-order distinction, valid-only transitions, invalid-jump 409, duplicate-submit single state, frozen history after menu edits, cross-tenant denial

### Implementation for User Story 2

- [X] T012 [US2] Extend orders list in client/js/admin.js with visual-only new-order prominence (row highlight, pending badge count, pending-first newest-first ordering) and kind badges (pickup/delivery, pre-order) plus priority ordering (new/pending → action-needed → today) per specs/011-post-order-experience-insights/contracts/owner-orders.md
- [X] T013 [US2] Extend order detail in client/js/admin.js with full operational fields (customer name, phone/WhatsApp click-to-chat, type, delivery address only for delivery, items + variants/modifiers + quantities + notes, subtotal, delivery fee, total + currency, pre-order flag + frozen timing, timestamps) and frozen history rendering per specs/011-post-order-experience-insights/contracts/owner-orders.md
- [X] T014 [US2] Extend listOrders ordering and changeOrderStatus guards in server/controllers/admin.controller.js plus server/services/orders.service.js (pending-first ordering, valid-next-transitions only, same-status no-op, delivery gate on `out_for_delivery`, tenant scoping preserved) per specs/011-post-order-experience-insights/contracts/owner-orders.md

**Checkpoint**: US1 and US2 independently functional on the shared flow

---

## Phase 5: User Story 3 - Notification foundation (Task 11) (Priority: P2)

**Goal**: One internal event abstraction with persisted dedup; dashboard realtime preserved; Web Push foundation without live push; order writes never blocked

**Independent Test**: Dashboard closed → place order + change status twice with one replayed event → order/transitions persisted → reconnect shows exactly one visible notification per event → all channels broken → checkout/status still succeed → business A events never reach B

### Tests for User Story 3

- [X] T015 [P] [US3] Add foundation coverage in tests/notifications-foundation.test.js asserting single emit per domain event, `eventKey` dedup on replay, channel-failure-never-breaks-order, reconnect catch-up, no cross-tenant delivery, push channel `skipped` while disabled

### Implementation for User Story 3

- [X] T016 [US3] Wire emit call sites in server/services/orders.service.js (after `createCheckout` commit → `order.created`; after `changeStatus`/`cancelByCustomer` commit → `order.status_changed`) and route dashboard SSE delivery through server/services/notifications.service.js in server/controllers/admin.controller.js events() per specs/011-post-order-experience-insights/contracts/notifications.md
- [X] T017 [P] [US3] Add retention cleanup for notification_events in server/services/notifications.service.js (delete rows older than 30 days; no order data touched) and document the Web Push production setup (VAPID env, default-off flag, permission hook points) in specs/011-post-order-experience-insights/quickstart.md per specs/011-post-order-experience-insights/contracts/notifications.md

**Checkpoint**: All P1 stories plus notification backbone independently functional

---

## Phase 6: User Story 4 - Analytics insights (Task 12) (Priority: P2)

**Goal**: Exact today/7d/30d + bounded custom-range analytics with per-currency money, option-safe products, status/type/preorder splits, nontechnical UX

**Independent Test**: Orders across pickup/delivery, completed/cancelled, normal/pre-order, and a currency change → each period matches hand-computed SQL exactly → invalid ranges 400 → empty business shows zero state → analytics failure never breaks ordering

### Tests for User Story 4

- [X] T018 [P] [US4] Add insights coverage in tests/analytics-insights.test.js asserting exact counts/revenue-per-currency/AOV/splits/series/top-items vs hand-computed aggregates, no FX conversion, no mixed-currency totals, option lines never counted as products, zero-filled series, `from > to`/overspan/bad-date/preset+range-combined 400s, tenant isolation

### Implementation for User Story 4

- [X] T019 [US4] Extend analytics aggregation in server/services/orders.service.js (`analyticsSeries` period-from/to support, `topItems` parent-line-only product counts with option revenue rolled up, status/type/preorder splits, per-currency revenue/AOV, zero-filled series, `restaurant_id`-scoped exact SQL) per specs/011-post-order-experience-insights/contracts/analytics.md
- [X] T020 [US4] Extend analytics in server/controllers/admin.controller.js (`?preset=today|7d|30d` default `7d`, `?from=&to=` server-validated via validators, mutually exclusive with `days`, additive response fields `period/totals/averageOrderValueByCurrency/pickupVsDelivery/statusSplit/preorderSplit`) per specs/011-post-order-experience-insights/contracts/analytics.md
- [X] T021 [US4] Extend analytics rendering in client/js/admin.js (preset selector today/7d/30d + bounded custom-range picker, numbers-first nontechnical layout, plain empty/error card that never breaks the rest of the dashboard) plus AR+EN strings in client/js/i18n.js per specs/011-post-order-experience-insights/contracts/analytics.md

**Checkpoint**: All user stories independently functional with one shared truth

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Whole-phase gates from quickstart.md

- [ ] T022 Run full validation in specs/011-post-order-experience-insights/quickstart.md — PARTIAL: static gates done (check-syntax 103 files 0 failures, pure-logic validator/notify checks pass, i18n key coverage 100%); live-DB journeys BLOCKED: no TEST_DATABASE_URL and no local postgres in this environment
- [ ] T023 Run npm run check via scripts/check-syntax.js and full node --test suite — PARTIAL: check-syntax green (103 files, 0 failures); node --test BLOCKED: no TEST_DATABASE_URL (4 new suites + all legacy suites unrunnable here)
- [ ] T024 [P] AR+EN mobile-viewport smoke in client/restaurant.html, client/track.html, and client/admin.html — PARTIAL: static verification done (all new I.t keys + data-i18n attrs resolve in both dicts, markup/ARIA roles intact); interactive browser smoke BLOCKED: no browser in this environment

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — starts immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phases 3–6)**: All depend on Foundational; then priority order (P1 → P2) or parallel if staffed
- **Polish (Phase 7)**: Depends on all desired stories being complete

### User Story Dependencies

- **US1 (P1)**: After Foundational only — MVP, no other dependencies
- **US2 (P1)**: After Foundational — shares order flows, independently testable
- **US3 (P2)**: After Foundational — wraps US1/US2 write paths without changing them, independently testable
- **US4 (P2)**: After Foundational — reads only, no dependency on US1–US3 implementation

### Within Each Story

- Tests written and FAIL before implementation
- Migration before rules (T003 before T004)
- Rules before display (service/controller before client JS)
- Verify-only where existing behavior is kept; fix gaps only if found
- Story checkpoint green before next priority

### Parallel Opportunities

- T002 runs parallel with T001 (different surfaces, no dependency)
- T006, T011, T015, T018 run in parallel once Foundational lands (separate new test files)
- T010 runs parallel with T007–T009 (i18n vs feature JS); T017 runs parallel with T016 (cleanup/docs vs wiring); T021 needs T019–T020 (response shape before rendering)
- T024 runs parallel with T022–T023 (manual smoke vs automated gates)

---

## Parallel Example: Post-Foundation Test Kickoff

```bash
# Launch one test file per story together (separate files, no shared edits):
Task: "Add confirmation/tracking/reorder coverage in tests/journey-confirmation.test.js"
Task: "Add board coverage in tests/operations-board.test.js"
Task: "Add foundation coverage in tests/notifications-foundation.test.js"
Task: "Add insights coverage in tests/analytics-insights.test.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (baseline confirmed)
2. Complete Phase 2: Foundational (notification tables + service + range validators)
3. Complete Phase 3: US1 guest post-order truth
4. **STOP and VALIDATE**: confirmation, tracking, reorder, error states in AR+EN
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → persistence + validation ready, nothing customer-visible forced
2. US1 → guest trust end to end → deployable MVP
3. US2 → owner operations clarity → demo
4. US3 → notification backbone (dashboard realtime hardened, push-ready) → full reliability
5. US4 → business insights → complete phase

---

## Notes

- [P] tasks touch different files with no pending dependencies; T021 waits for T019+T020 (response shape before rendering); T014 and T016 touch adjacent order paths sequentially
- Constraint values quoted verbatim from data-model.md/contracts — event/state/type allowlists, 30-day retention, 90-day range bound, pickup 5-step vs delivery 6-step flows
- Reviewer-owned checklists are gates only; implementation must not toggle their markers
- Constitution gates (isolation, server-side money, additive migrations, check-syntax 0 failures, no new deps) block every phase
