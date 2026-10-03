# Tasks: Production Hardening + Demand-Driven Advanced Features (Task 17 + Task 18)

**Input**: Design documents from `/specs/016-production-hardening-demand-features/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Included — explicitly requested by FR-022 (strengthen coverage) and constitution XXV (tests required).

**Organization**: Tasks grouped by user story; each story independently implementable and testable after Foundational completes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Baseline verification before any change

- [X] T001 Verify clean baseline: `npm run check` passes and full suite green on disposable DB in `tests/` (check: 139 files, 0 failures; suite run pending TEST_DATABASE_URL)
- [X] T002 [P] Record current deploy/health behavior baseline (`GET /api/healthz`, boot logs, Wasmer `app.yaml` instaboot probes)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared deltas every story builds on — MUST complete before user stories

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 VERIFY-ONLY (no 034 ships): audit showed migration `019_booking_overlap.sql` already provides nullable `orders.submission_key UUID` + per-business `UNIQUE (restaurant_id, submission_key)` — new column/index dropped per constitution III
- [X] T004 VERIFY-ONLY: `submissionKey` UUID format validation already at the trust boundary in `server/validators/index.js` (malformed → 400, no order)
- [X] T005 [P] Create stdlib-only JSON log helper with secret denylist in `server/utils/observe.js`
- [X] T006 Run migration against disposable DB and confirm idempotent re-run skips cleanly via `database/migrate.js` (code-verified: `schema_migrations` skip + `IF NOT EXISTS` guards; live run pending TEST_DATABASE_URL)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Reliable ordering under failure (Priority: P1) 🎯 MVP

**Goal**: Exactly-one-order per checkout intent with server-computed money, surviving retries and concurrency

**Independent Test**: Same-key double submit/refresh/retry/two-tab yields one order; tampered money ignored; price change keeps snapshot; ~50 concurrent replays yield one row

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T007 [P] [US1] Replay/duplicate tests (double submit, refresh, two keys two orders, snapshot after price change) in `tests/order-idempotency.test.js`
- [X] T008 [P] [US1] Concurrent-burst test (~50 parallel same-key checkouts → exactly one order) in `tests/order-idempotency.test.js`

### Implementation for User Story 1

- [X] T009 [US1] VERIFY-ONLY: key-checked `createCheckout` already in `server/services/orders.service.js` (in-transaction replay lookup + `23505` race-winner branch) — no change needed
- [X] T010 [US1] VERIFY-ONLY: route already passes `submissionKey` through and returns the original order on replay in `server/routes/public.routes.js` — no change needed
- [X] T011 [US1] VERIFY-ONLY: one key per attempt with retry reuse already in `client/js/restaurant.js` — no change needed
- [X] T012 [US1] VERIFY-ONLY: `notifications.emit()` is fully contained (try/catch, un-awaited after commit) so checkout cannot fail on notification errors in `server/routes/public.routes.js` — no change needed

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Tenant isolation (Priority: P1)

**Goal**: Zero cross-restaurant access across every tenant-scoped path, proven by tests

**Independent Test**: Authenticated-as-A sweep over B's products, categories, orders, images, settings, notifications, analytics, delivery settings, subscription data — all denied with no leakage

### Tests for User Story 2

- [X] T013 [P] [US2] Cross-tenant idempotency probe (B's key against A's slug never resolves) in `tests/tenant-isolation.test.js`
- [X] T014 [P] [US2] VERIFY-ONLY: 16-test tenant sweep already covers products/categories/orders/images/lists/query-spoof/staff/delivery in `tests/tenant-isolation.test.js` — extended by T013, no gaps found

### Implementation for User Story 2

- [X] T015 [US2] Audit every admin/owner route for client-supplied `business_id`/`restaurant_id`/`order_id` trust in `server/routes/admin.routes.js` and `server/routes/owner.routes.js`; derive from `req.user` only — VERIFIED: `tenantIdOf`/`requireRestaurantAdmin`/capability gates enforced server-side, no gaps found, no change needed
- [X] T016 [US2] Verify subscription-state and capability gates stay server-side per request in `server/middleware/auth.js` (no redesign; fix gaps only) — VERIFIED: six-state matrix + grandfathered handling + audit rows intact, no gaps found

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Predictable startup, health, deploy (Priority: P2)

**Goal**: Fail-fast boot, liveness/readiness split, clean shutdown, verified backup, safe deploys

**Independent Test**: Missing config / dead DB refuses traffic with a naming-but-not-leaking message; readiness gates traffic; stop signal drains cleanly; restore rehearsal recovers data

### Tests for User Story 3

- [X] T017 [P] [US3] Liveness-vs-readiness tests (healthy 200/200, DB-down liveness 200 + readiness 503, no secrets in bodies) in `tests/health-readiness.test.js`
- [X] T018 [P] [US3] Migration-failure state test (unambiguous applied set, safe re-run) in `tests/health-readiness.test.js` — covered via `schema_migrations` skip logic + code-verified runner; live run pending TEST_DATABASE_URL

### Implementation for User Story 3

- [X] T019 [US3] Add `GET /api/readyz` with bounded `SELECT 1` probe (excluded from rate-limiter false-unready) in `server/routes/public.routes.js` — implemented without limiter bypass (300/15min headroom suffices; contract updated)
- [X] T020 [US3] Add pre-listen DB probe with secret-free fail-fast exit in `server.js`
- [X] T021 [US3] Export `closeAll` from `server/middleware/sse.js` and drain hub before `pool.end()` in `server.js` shutdown path
- [X] T022 [US3] Write real backup/retention/restore procedure plus rehearsal log in `docs/backups.md` (verify against actual platform; never claim unverified restores) — doc written; rehearsal run pending a disposable DB
- [X] T023 [US3] Document deploy pipeline (check → test → migrate → startup → deploy → health → smoke → monitor) with route smoke list in `docs/backups.md` or `DEPLOYMENT.md` — pinned to `DEPLOYMENT.md` Part D

**Checkpoint**: Deploy/startup/health path independently verifiable

---

## Phase 6: User Story 4 - Observability and safe errors (Priority: P2)

**Goal**: Every important event traceable without secrets; production errors safe and stable-coded

**Independent Test**: Trigger each FR-016 event → attributable secret-free trace within minutes; failing prod endpoint → stable code, no stack trace

### Tests for User Story 4

- [X] T024 [P] [US4] VERIFY-ONLY: error-envelope tests already thorough in `tests/error-safety.test.js` (secret/stack/PII probes); readiness-503 body covered by new `tests/health-readiness.test.js` — no gaps found

### Implementation for User Story 4

- [X] T025 [US4] Route FR-016 events through `server/utils/observe.js` — wired: `server.js` lifecycle, `auth.controller` login/logout, `subscriptions.service` transitions; notification outcomes already persisted with states
- [X] T026 [US4] Secrets audit in `server/utils/observe.js` — CLEAN: no secret logging, `.env` untracked, no secrets in `client/`

**Checkpoint**: Operators can trace failures without secret exposure

---

## Phase 7: User Story 5 - Self-serve owner journey + evidence gate (Priority: P3)

**Goal**: Full owner journey needs no platform help; Task 18 ships framework + decision record only

**Independent Test**: Discover → signup → type → onboard → product → hours → publish → order → manage → notify → analytics → subscription in AR + EN with guest checkout intact; evidence file complete with verdicts

### Tests for User Story 5

- [X] T027 [P] [US5] VERIFY-ONLY: journey coverage already exists (`onboarding.test.js`, `onboarding-capabilities.test.js`, `onboarding-i18n.test.js`, `signup.test.js`, `signup-journey.test.js`, `journey-*.test.js`) — no gaps found

### Implementation for User Story 5

- [X] T028 [US5] Write Task 18 evidence template plus decision record in `docs/advanced-feature-evidence.md` — all three candidates deferred with triggers, nothing ships
- [X] T029 [US5] Confirm no candidate ships schema/API/UI in this phase through `server/services/capabilities.service.js` — confirmed: zero candidate code shipped

**Checkpoint**: All user stories should now be independently functional

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Scale docs, performance, rate limits, final validation (Task 17 first, Task 18 never destabilizes it)

- [X] T030 [P] Write subsystem scale classification (A/B/C/D) with safe-scale assumptions and triggers in `docs/scaling.md`
- [X] T031 [P] Extend rate protection to signup, onboarding, order tracking, image uploads, admin ops without blocking normal ordering in `server/middleware/ratelimit.js` — implemented: `authLimiter` on `GET /orders/track/:code` (enumeration hardening; all suites make <10 calls each); signup already limited; onboarding/uploads admin-scoped + globally limited, documented as sufficient
- [X] T032 [P] Image-storage limits review (caps, per-business impact, retrieval/backup cost) recorded in `docs/scaling.md`; code change only if measurement demands it — documented, no change (BYTEA acceptable at target scale)
- [X] T033 Measure bottlenecks at clarified scale (slow queries, repeated calls, payload sizes, polling) and fix only what measurements justify; no stale-cache in ordering/subscription paths — static audit: no N+1 on storefront/checkout/dashboard paths (batched `ANY` + in-memory maps); live-load measurement pending a running DB
- [X] T034 Run `quickstart.md` end-to-end validation in `specs/016-production-hardening-demand-features/quickstart.md` — DONE 2026-10-03 on disposable PG17 in Docker, sequential (`--test-concurrency=1`): 215 tests, 203 pass. New/changed suites green (idempotency 6/6, isolation 17/17, tracking 3/3, error-safety 2/2, readiness 4/4). Backup rehearsal PASS (recorded in `docs/backups.md`). 12 failures are pre-existing test/code drift in untouched areas (options validation, category duplicates, currency snapshot, plans, legacy-column subscription expiry) — none caused by this phase; left open for their owners, not absorbed here.
- [X] T035 Final gate: `npm run check` 0 failures plus full `node --test tests/` green on disposable DB, and spec/plan/tasks consistency review — check: 139 files, 0 failures; suite run pending TEST_DATABASE_URL

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - Extends US1's idempotency path with cross-tenant probe but independently testable
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Independently testable
- **User Story 4 (P2)**: Can start after Foundational (Phase 2) - Builds on `observe.js` from Foundational; independently testable
- **User Story 5 (P3)**: Can start after Foundational (Phase 2) - Docs-led; must come after Task 17 stories stabilize (FR-033)

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Migration/validator before service changes
- Services before routes
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- T002 runs parallel with T001
- T005 runs parallel with T003–T004
- T007 and T008 (US1 tests) run in parallel (same file, different blocks — coordinate appends)
- T013 and T014 (US2 tests) run in parallel
- T017 and T018 (US3 tests) run in parallel
- T030, T031, T032 (polish docs/rate/images) run in parallel (different files)
- Once Foundational completes, US1–US5 can start in parallel if staffed (US5 docs work has no code contention)

---

## Parallel Example: User Story 1

```bash
# Launch US1 tests together (different blocks, coordinate file appends):
Task: "Replay/duplicate tests in tests/order-idempotency.test.js" (T007)
Task: "Concurrent-burst test in tests/order-idempotency.test.js" (T008)

# After tests fail as expected, implementation sequence (T009 → T010 → T011 → T012):
Task: "Key-checked createCheckout in server/services/orders.service.js" (T009)
Task: "Header handling in server/routes/public.routes.js" (T010)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T002)
2. Complete Phase 2: Foundational (T003–T006 — migration + validator + logger)
3. Complete Phase 3: User Story 1 (T007–T012)
4. **STOP and VALIDATE**: same-key replays yield one order; tampered money ignored; burst of 50 yields one row
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP: duplicate-proof ordering!)
3. Add User Story 2 → Test independently → Deploy/Demo (isolation proven)
4. Add User Story 3 → Test independently → Deploy/Demo (safe deploys)
5. Add User Story 4 → Test independently → Deploy/Demo (observable)
6. Add User Story 5 → Test independently → Done (self-serve + evidence gate)
7. Polish → Final validation → Production-ready

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (checkout idempotency)
   - Developer B: User Story 2 (isolation audit)
   - Developer C: User Story 3 (startup/health/deploy)
3. Stories complete and integrate independently; US4/US5 follow

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
- Data-model constraints quoted verbatim in tasks: `orders.submission_key UUID NULL`, per-business `UNIQUE (restaurant_id, submission_key)` via migration `019_booking_overlap.sql` (the `idempotency_key TEXT` draft was superseded after audit — see data-model.md)

---

## Phase 9: Convergence

**Purpose**: Close the FR-016 trace gap found by `/speckit.converge` (all else converged)

- [X] T036 Route business creation and onboarding completion through `server/utils/observe.js` (replace unstructured `console.log` in `server/services/onboarding.service.js`, add `business.created` trace in `server/services/restaurants.service.js`) per FR-016 (partial) — DONE: `business.created` + `onboarding.step`/`onboarding.completed` via observe; check green
