# Tasks: Owner Web Push

**Input**: Design documents from `specs/012-owner-web-push/` (spec.md, plan.md, research.md, data-model.md, contracts/, quickstart.md + clarification session 2026-09-30)

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included — required by spec Testing requirements (stubbed sender boundary, disposable DB, never weaken existing tests).

**Organization**: Grouped by user story; each story independently testable. Single platform VAPID keypair, admins-only audience (staff refused), no-retry failure policy per clarifications.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Baseline readiness and the one justified dependency

- [X] T001 Confirm push baseline in server/services/notifications.service.js (`push` sender stub returning `skipped`, `PUSH_ENABLED` false, claim/dedup flow), database/migrations/025_notifications.sql (`push_subscriptions` + `notification_events` shapes), client/sw.js (no push/click handlers, cache `restaurants-v20`), and SSE dashboard path in server/middleware/sse.js plus client/js/admin.js
- [X] T002 Add the Web Push sending library to package.json (single small pure-JS VAPID + encryption sender per research R1) with `npm install` and document the choice in specs/012-owner-web-push/research.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Config, persistence, authZ, and validation everything depends on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Create database/migrations/026_push_label.sql adding `label TEXT NOT NULL DEFAULT ''` with `CHECK (char_length(label) <= 60)` to `push_subscriptions` via `ADD COLUMN IF NOT EXISTS` idempotent pattern (drop this task if review finds created-date display sufficient)
- [X] T004 Wire VAPID configuration in config/index.js (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `PUSH_ENABLED`) plus `.env.example` entries (test-placeholder values only, never real keys) per specs/012-owner-web-push/contracts/subscriptions.md
- [X] T005 [P] Add admins-only guard for push routes in server/middleware/auth.js (admin sessions pass, staff sessions refused 403, existing `requireRestaurantAdmin` behavior for all other routes unchanged) per specs/012-owner-web-push/research.md R3
- [X] T006 [P] Extend server/validators/index.js with subscription validators (endpoint must be HTTPS URL ≤ 2000 chars; `p256dh`/`auth` valid base64url non-empty with capped lengths; `label` plain text ≤ 60) per specs/012-owner-web-push/data-model.md

**Checkpoint**: Foundation ready — keys load from env, guard denies staff, validators reject bad input

---

## Phase 3: User Story 1 - Closed-tab push delivery (Priority: P1) 🎯 MVP

**Goal**: New order → real browser push per subscription with minimal payload, dead-endpoint cleanup, failures contained

**Independent Test**: Seed a subscription row directly, stub the sender boundary, place a guest order, and assert one minimal-payload send per active subscription, dead-endpoint deactivation, and checkout 201 with the sender broken

### Tests for User Story 1

- [X] T007 [P] [US1] Add sender coverage in tests/push-notifications.test.js asserting minimal payload (title + code + business, no customer PII), one send per active subscription, multi-device fan-out, replay dedup (existing claim collapses, zero duplicate sends), dead-endpoint deactivation on authoritative rejection, transient failure recorded with no retry, and push-down checkout still 201

### Implementation for User Story 1

- [X] T008 [US1] Replace the `push` sender stub in server/services/notifications.service.js with the real sender (per-business active-subscription lookup, VAPID-signed sends with bounded concurrency, TTL-capped minimal payload `{title, body, tag: eventKey, url, business}`, 404/410 → deactivate subscription, transient → `failed` no retry, disabled → `skipped`) per specs/012-owner-web-push/contracts/push-delivery.md
- [X] T009 [P] [US1] Add additive `push` + `notificationclick` handlers in client/sw.js (parse payload, `showNotification` with fallback for malformed payloads, focus-or-open dashboard order view on click, fetch/cache logic byte-identical, cache name bumped per convention) per specs/012-owner-web-push/contracts/service-worker.md

**Checkpoint**: US1 independently verifiable — MVP shippable (with a seeded subscription)

---

## Phase 4: User Story 2 - Permission UX and subscriptions (Priority: P1)

**Goal**: Understandable opt-in, gesture-initiated permission, device list with removal, graceful denied/unsupported states, AR+EN

**Independent Test**: As owner in settings, see the notifications card, tap enable, get the browser prompt from the tap, grant and appear in the device list; deny on a second profile and see guidance; delete a device and confirm it stops receiving pushes

### Tests for User Story 2

- [X] T010 [P] [US2] Add endpoint coverage in tests/push-notifications.test.js asserting 401 logged-out, 403 staff, upsert-on-same-endpoint (keys/label updated, reactivated, rebound to session tenant), cross-tenant store/read/delete 404s, label > 60 rejected, and public-key endpoint returns `enabled` + key only to admins

### Implementation for User Story 2

- [X] T011 [US2] Add subscription endpoints in server/routes/admin.routes.js plus server/controllers/admin.controller.js (`GET /api/admin/push-public-key`, `GET/POST/DELETE /api/admin/push-subscriptions/:id`, admins-only guard, tenant from session, upsert semantics, rate-limited like existing admin writes) per specs/012-owner-web-push/contracts/subscriptions.md
- [X] T012 [US2] Add notifications card in client/js/admin.js settings tab (benefit line, gesture-only enable button, supported/granted/denied/unavailable states, device list with remove buttons, capability detection before actions) plus AR+EN strings in client/js/i18n.js per specs/012-owner-web-push/contracts/subscriptions.md

**Checkpoint**: US1 and US2 independently functional — full opt-in to delivery loop

---

## Phase 5: User Story 3 - Dual-channel coexistence (Priority: P2)

**Goal**: SSE behavior byte-identical with push on/off/broken; zero duplicate pushes on replay; zero cross-tenant leakage on either channel

**Independent Test**: Dashboard open + device subscribed → place order → SSE highlight unchanged AND push delivered; replay event → no duplicate push; second business observes nothing; push broken → SSE still fires

### Tests for User Story 3

- [X] T013 [P] [US3] Add coexistence coverage in tests/push-notifications.test.js asserting SSE `order:new` fires with push enabled and with push broken, replayed `order.created` yields zero additional pushes, and second-business sessions see nothing on either channel

### Implementation for User Story 3

- [X] T014 [US3] Verify SSE path preservation across server/middleware/sse.js, server/controllers/admin.controller.js events(), and client/js/admin.js highlight/reconcile (verify-only; fix gaps only if found, no SSE logic moves) per specs/012-owner-web-push/contracts/push-delivery.md

**Checkpoint**: All user stories independently functional with both channels proven together

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Whole-feature gates from quickstart.md

- [ ] T015 Run stubbed-sender validation in specs/012-owner-web-push/quickstart.md — PARTIAL: full suite executed 2026-10-02 on disposable PG 17: 133/141 pass; all 6 push suites + all 011 suites green; 8 failures proven pre-existing/environmental (byte-identical on pristine checkout via git stash) — NOT regressions, do not chase them in app code
- [ ] T016 [P] Run npm run check via scripts/check-syntax.js and document the manual production checklist results — PARTIAL: check green (104 files, 0 failures); boot smoke green (healthz/pricing/uniform-404/push-401); real web-push lib verified against generated keys; production checklist (real keys/devices) requires manual execution per specs/012-owner-web-push/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — starts immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phases 3–5)**: All depend on Foundational; then priority order (P1 → P2) or parallel if staffed
- **Polish (Phase 6)**: Depends on all desired stories being complete

### User Story Dependencies

- **US1 (P1)**: After Foundational only — MVP (deliverable with a seeded subscription even before settings UI)
- **US2 (P1)**: After Foundational — shares tables/validators, independently testable
- **US3 (P2)**: After Foundational — verifies US1/US2 paths together without changing them

### Within Each Story

- Tests written and FAIL before implementation
- Migration/validators before services (T003–T006 before stories)
- Sender before endpoints before UI (T008 before T011 before T012)
- Verify-only tasks fix gaps only if found
- Story checkpoint green before next priority

### Parallel Opportunities

- T002 runs parallel with T001 (dependency install vs read-only confirm)
- T005 runs parallel with T006 (different files, no dependency); T003–T004 sequential (migration before config docs reference it)
- T007, T010, T013 run in parallel once Foundational lands (same new test file, north-to-south sections — coordinate appends, or one author runs all three)
- T009 runs parallel with T008 (client SW vs server sender); T012 needs T011 (endpoint shape before UI wiring)
- T016 runs parallel with T015 (static gates vs DB suite)

---

## Parallel Example: Post-Foundation Test Kickoff

```bash
# Launch all story tests together after Foundational (same file, append in order):
Task: "Add sender coverage in tests/push-notifications.test.js [US1]"
Task: "Add endpoint coverage in tests/push-notifications.test.js [US2]"
Task: "Add coexistence coverage in tests/push-notifications.test.js [US3]"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (baseline + sending library)
2. Complete Phase 2: Foundational (label migration, VAPID config, admin-only guard, validators)
3. Complete Phase 3: US1 real sender + SW handlers
4. **STOP and VALIDATE**: seeded-subscription delivery, dedup, dead-endpoint, failure containment
5. Deploy/demo if ready (production keys still required for real devices)

### Incremental Delivery

1. Setup + Foundational → push backbone ready, nothing user-visible forced
2. US1 → real delivery end to end → deployable MVP
3. US2 → owner opt-in and device control → usable feature
4. US3 → dual-channel proof → complete feature

---

## Notes

- [P] tasks touch different files with no pending dependencies; T012 waits for T011 (endpoint shape before UI); T008/T011 share notifications.service.js sequentially
- Constraint values quoted verbatim from data-model.md/contracts — endpoint HTTPS ≤ 2000, keys base64url non-empty capped, label ≤ 60, `order.created`-only trigger, minimal payload fields
- Push on status change is explicitly out of scope; do not implement it as a drive-by
- Reviewer-owned checklists are gates only; implementation must not toggle their markers
- Constitution gates (isolation, key hygiene, additive migrations, check-syntax 0 failures, single justified dependency) block every phase
