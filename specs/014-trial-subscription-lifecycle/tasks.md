# Tasks: Trial Subscription Lifecycle (`014-trial-subscription-lifecycle`)

**Input**: Design documents from `/specs/014-trial-subscription-lifecycle/` (plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md)

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Included — the feature spec (§26 Testing) and constitution (XXV) explicitly require comprehensive automated tests. Tests are written FIRST and MUST fail before implementation.

**Organization**: Tasks grouped by user story; each story phase is an independently testable increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Web app: `server/` (routes → controllers → services → parameterized SQL), `client/` (vanilla HTML/JS/CSS), `database/migrations/`, `tests/`
- New test files: `tests/trial-lifecycle.test.js`, `tests/subscription-admin.test.js`, `tests/subscription-legacy.test.js`, `tests/subscription-entitlements.test.js`, `tests/subscription-access.test.js`, `tests/subscription-ux.test.js`
- Existing suites (`tests/subscription-gate.test.js`, `tests/signup.test.js`, 013 suites, …) are extended in place only where noted and NEVER weakened

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Baseline verification before any code changes

- [X] T001 Record green baseline: `npm run check` reports 0 failures; note that `node --test tests/` requires a disposable `TEST_DATABASE_URL` (unavailable in some environments — DB suites run in CI); no code changes
- [X] T002 [P] Confirm next migration numbers are `028` and `029` (`027_onboarding_state.sql` is latest) and the `schema_migrations` idempotency convention for `database/migrations/028_plans.sql` and `database/migrations/029_subscriptions.sql`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Plans table, subscriptions table + audit, validators, and the two centralized services every story depends on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Write additive migration `database/migrations/028_plans.sql`: `plans` (`id UUID PK`, `key TEXT UNIQUE`, `name`, `description DEFAULT ''`, `is_active BOOL DEFAULT TRUE`, `price_cents INT >= 0`, `currency CHAR(3)`, `period CHECK(month|year)`, `trial_eligible BOOL DEFAULT TRUE`, timestamps) + `plan_entitlements` (`plan_id FK → plans CASCADE`, `capability_key TEXT`, `allowed BOOL DEFAULT TRUE`, `limit_value INT NULL`, `PK(plan_id, capability_key)`) + seed exactly one `standard` plan mirroring `platform_settings` (1999 cents, USD, month, trial-eligible) granting every currently default-on capability; idempotent guards per `database/migrate.js` convention
- [X] T004 Write additive migration `database/migrations/029_subscriptions.sql`: `subscriptions` (`id UUID PK`, `restaurant_id FK → restaurants UNIQUE`, `plan_id FK → plans RESTRICT`, `status CHECK(trial|active|grace|expired|cancelled|suspended)`, `trial_started_at NULL`, `current_period_start NOT NULL`, `current_period_end NULL`, `grace_until NULL`, `cancelled_at NULL`, `cancel_effective_at NULL`, `suspended_at NULL`, `suspend_reason DEFAULT ''`, timestamps) + `subscription_events` (`id UUID PK`, `restaurant_id FK CASCADE`, `actor_user_id FK → users NULL`, `action TEXT`, `old_status/new_status NULL`, `old_plan_key/new_plan_key NULL`, `old_ends_at/new_ends_at NULL`, `reason DEFAULT ''`, `created_at`; append-only, never updated) + backfill one row per existing business (`plan_id` = seeded plan, neutral `active`, period start = business creation, period end = existing `subscription_ends_at` untouched, grace = end + 7 days where an end exists, zero invented audit rows); `restaurants.subscription_ends_at` values never rewritten
- [X] T005 Extend `server/validators/index.js` with plan validators (key/name/price-cents ≥ 0/ISO-3 currency/month|year period/entitlement keys against matrix vocabulary, unknown capability keys rejected) and subscription-action validators (activate needs `planKey` + optional `periodEndsAt` + optional `reason`; extend needs exactly one of `extendDays` 1–3650 or `newEndsAt`; cancel needs `effective` in (`now`,`period_end`); suspend needs non-empty `reason`; explicit UUID business targets; non-admin plan/state/expiry fields rejected)
- [X] T006 Create `server/services/plans.service.js`: list/get/create/update plans with entitlement mappings (key immutable; price edits apply to future assignments only, never retroactive; unknown capability keys rejected; inactive plans stay readable for history)
- [X] T007 Create `server/services/subscriptions.service.js`: read-time effective-state derivation (`suspended`/`cancelled` stored overrides; paid-through cancel stays active; `now <= end` → trial|active; end < now <= grace → grace; beyond → expired; `== end instant` counts as expired), enforced transition table, activate/extend (later-of now/current end)/cancel/suspend/reactivate each writing one `subscription_events` row in the same tx and mirroring the access end into `restaurants.subscription_ends_at`; wire the joined subscription row (plan + state + entitlements) into `server/middleware/auth.js:requireRestaurantAdmin`'s existing per-request fetch so gates reuse resolved context (FR-022, no new queries per gate)

**Checkpoint**: Foundation ready — plans seeded, derivation pure and tested mentally, migrations re-runnable; user story work can now begin

---

## Phase 3: User Story 1 — Trial lifecycle for new businesses (Priority: P1) 🎯 MVP

**Goal**: Eligible self-service businesses get exactly one server-timed trial with plain-language status, deterministic expiry into grace, and intact data throughout

**Independent Test**: Sign up, confirm trial state with correct end date, travel past end and grace via test-only SQL clock changes, confirm grace then expired behavior with all data intact

### Tests for User Story 1 (write FIRST, ensure FAIL)

- [X] T008 [P] [US1] TDD `tests/trial-lifecycle.test.js`: signup creates exactly one trial subscription row (state `trial`, correct plan, end ≈ now+7d); resume/retry creates no second row; derivation walks trial → grace → expired at the 7-day boundaries; duplicate trial claims resolve to the existing record

### Implementation for User Story 1

- [X] T009 [US1] Extend `server/services/signup.service.js` to create the trial subscription row inside the existing `withTx` (trial state, seeded-plan link, trial start/end = computed end, UNIQUE blocks duplicates); demo/lead creation reuses the same path instead of hardcoded `+7d` (depends on T007)
- [X] T010 [US1] Add owner self-read `GET /api/onboarding/subscription` (`{state, plan{key,name}, trialEndsAt, periodEndsAt, daysLeft, graceUntil, messageKey}` from server time; tenant from session only) to `server/routes/onboarding.routes.js` + `server/controllers/onboarding.controller.js` (depends on T007)
- [X] T011 [US1] Extend the dashboard subscription card in `client/js/admin.js` with trial/grace states, days-left copy, a grace renewal-reminder banner (the pinned reminder surface per contracts/access.md), and recovery guidance, plus extend `server/controllers/admin.controller.js` dashboard()/myRestaurant() payloads with subscription state/grace/plan fields, plus `ar`+`en` DICT keys in `client/js/i18n.js` (plain human-readable states, no internal terminology)

**Checkpoint**: User Story 1 fully functional and independently testable (quickstart §2)

---

## Phase 4: User Story 2 — Admin activation and renewal (Priority: P1)

**Goal**: Platform admins manage the full lifecycle for externally paid businesses through six thin endpoints with full audit, usable later by payment integrations

**Independent Test**: Activate an expired business (access returns, audit row complete); extend without losing days; suspend/reactivate; end-of-period cancel with pre-effect reversal; invalid transitions 409; non-admin attempts 403

### Tests for User Story 2 (write FIRST, ensure FAIL)

- [X] T012 [P] [US2] TDD `tests/subscription-admin.test.js`: plan CRUD (create/get/edit/active-flag, unknown capability keys rejected, price edits never retroactive) + plan-to-entitlement mapping validation; activate/extend/suspend/reactivate/cancel-now/cancel-period-end each produce the specified state + access + exactly one audit row (actor/before-after/reason); invalid transitions → `409 INVALID_TRANSITION`; owner-role callers → `403`; forged plan/expiry fields rejected; cross-tenant targets rejected

### Implementation for User Story 2

- [X] T013 [US2] Add the six admin endpoints plus `GET .../events` to `server/routes/owner.routes.js` + `server/controllers/owner.controller.js` (platform role only, explicit validated UUID targets, thin handlers delegating to `server/services/subscriptions.service.js`) and extend `restaurants.service.js:listForOwner` select + owner listing response with `onboarding`-adjacent subscription columns (`planKey`, state, trial/period/grace ends) (depends on T006, T007)
- [X] T014 [US2] Extend the platform panel in `client/js/owner.js` + `client/owner.html` (per-business plan/state/dates/grace/entitlement summary, explicit actions only, events visible) plus `ar`+`en` strings in `client/js/i18n.js` — no billing console

**Checkpoint**: User Stories 1 AND 2 both work; admin-driven revenue path is operable and audited

---

## Phase 5: User Story 3 — Existing businesses keep working (Priority: P1)

**Goal**: Migration-day safety proven: every vintage behaves identically with exactly one coherent subscription row and no invented history

**Independent Test**: Seed admin-created, Task-13, NULL-end, future-end, and past-end businesses with orders; migrate; confirm identical storefront/ordering/dashboard behavior and single coherent states

### Tests for User Story 3 (write FIRST, ensure FAIL)

- [X] T015 [P] [US3] TDD `tests/subscription-legacy.test.js`: NULL-end and future-end businesses stay fully working under the seeded plan; past-end keeps exactly its current restricted behavior; each business has exactly one subscription row; zero audit rows exist for migrated history; historical orders/analytics read identically

### Implementation for User Story 3

- [X] T016 [US3] Address any migration/backfill gaps found by T015 in `database/migrations/029_subscriptions.sql` (defaults, grace derivation for past ends, RESTRICT/UNIQUE behavior) without touching `restaurants.subscription_ends_at` semantics

**Checkpoint**: Grandfathering holds by construction; quickstart §4 passes

---

## Phase 6: User Story 4 — Plan entitlements drive capabilities (Priority: P2)

**Goal**: The existing `can()` evaluator consumes plan mappings so plans have teeth; UI and server agree; forged claims change nothing

**Independent Test**: Different plans/configurations produce correct allow/deny both in UI and on direct requests; plan edits propagate immediately with no stale grants or denials

### Tests for User Story 4 (write FIRST, ensure FAIL)

- [X] T017 [P] [US4] TDD `tests/subscription-entitlements.test.js`: entitled boolean succeeds, non-entitled fails in UI-shape and direct-write; numeric limit boundary enforced (`MENU_LIMIT_REACHED` preserved) and reported honestly; forged plan/state/expiry/tenant claims ignored; missing-subscription-row fails closed with a clear code

### Implementation for User Story 4

- [X] T018 [US4] Extend `server/services/capabilities.service.js` `can()`/`effectiveFor()` to take plan entitlements as an input (plan allows AND type supports AND config enables AND state grants access), replacing the `trial-placeholder` literal with the assigned plan (missing row fails closed, never open); `requireCapability` and all gate signatures/positions unchanged (depends on T006, T007)
- [X] T019 [US4] Verify live propagation with no per-feature changes in `server/services/capabilities.service.js` (plan edit → immediate re-evaluation; no copied permissions anywhere); wire `advanced_analytics` as the first plan-differentiated hook without touching feature code

**Checkpoint**: Plans control access end to end; quickstart §5 passes

---

## Phase 7: User Story 5 — Per-surface access rules (Priority: P2)

**Goal**: The clarified matrix holds everywhere: grace works, expired shows the menu with ordering disabled and tracking intact, suspended shows the controlled notice, dashboards never dead-end

**Independent Test**: Walk one business through grace → expired → suspended checking storefront content, ordering acceptance, old-order tracking, dashboard reachability, and mutation gating at each stage

### Tests for User Story 5 (write FIRST, ensure FAIL)

- [X] T020 [P] [US5] TDD `tests/subscription-access.test.js`: grace storefront+ordering accepted with owner reminder state visible; expired storefront renders menu with ordering disabled + plain notice, checkout `403`, tracking `200`; suspended shows unavailable notice; dashboard GETs reachable in all states with correct guidance; management writes blocked where specified; expired owners still authenticate

### Implementation for User Story 5

- [X] T021 [US5] Change `restaurants.service.js:getPublicView()` to return the expired view with an `orderingBlocked` signal instead of `null` (the single intended behavior change), keep directory/sitemap exclusion filters, and render the plain customer notice in `client/js/restaurant.js` with `ar`+`en` strings (no internal terminology) (depends on T007 derivation)
- [X] T022 [US5] Extend owner dashboard states in `client/js/admin.js` (grace reminder, expired recovery path, suspended contact guidance; reads always reachable) plus `ar`+`en` DICT keys in `client/js/i18n.js`

**Checkpoint**: Access matrix holds per surface; quickstart §2–§3 stage assertions pass

---

## Phase 8: User Story 6 — Minimal subscription UX for owners and admins (Priority: P3)

**Goal**: Both audiences understand state, plan, time, and next action on mobile in both languages; copy stays jargon-free

**Independent Test**: Owner walkthroughs (trial/grace/expired) and an admin inspection + renewal complete unaided on a narrow phone in both languages

### Tests for User Story 6 (write FIRST where runnable)

- [X] T023 [P] [US6] Static `tests/subscription-ux.test.js` (no DB): every new subscription key used by `client/js/admin.js` + `client/js/owner.js` exists in both `ar` and `en` dicts; owner-facing strings contain no `entitlement`/`plan ID`/state-internals jargon

### Implementation for User Story 6

- [X] T024 [US6] Admin events-trail visibility in `client/js/owner.js` (newest-first actor/action/before-after/reason list) and final owner/admin copy pass in `client/js/i18n.js` (trial-left/active-until/expired-renew/suspended-contact variants)

**Checkpoint**: quickstart §6 comprehension walkthroughs pass

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Gates before converge — full-suite green, spec quality, smoke

- [X] T025 [P] `npm run check` 0 failures and `node --test tests/` fully green on disposable `TEST_DATABASE_URL` (existing + 013 suites unweakened, new suites included)
- [X] T026 Execute `specs/014-trial-subscription-lifecycle/quickstart.md` scenarios 1–7 end to end and fix gaps; constitution re-check (I–XXVIII) against the diff (no gateway/React/duplicates/deletion; additive migrations only; hidden-UI-never-authz); route smoke list green

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational completion
  - Then proceed in priority order (US1 → US2 → US3 → US4 → US5 → US6), or in parallel if staffed
- **Polish (Phase 9)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: After Foundational — trial attach extends the signup tx; no other story dependencies
- **US2 (P1)**: After Foundational — admin endpoints use the lifecycle service; independently testable via direct API calls
- **US3 (P1)**: After Foundational (migration written in T004) — verifies backfill; independently testable with vintage fixtures
- **US4 (P2)**: After Foundational + US2 plans exist — evaluator consumes mappings; independently testable per plan
- **US5 (P2)**: After Foundational + derivation (T007) — surface rules read derived state; storefront change independently testable
- **US6 (P3)**: After US1–US5 UI exists — copy/audit-visibility hardening; static test needs no DB

### Within Each User Story

- Test tasks MUST be written and FAIL before implementation (T008, T012, T015, T017, T020, T023)
- Migrations before services that use them (T003/T004 → T006/T007)
- Services before endpoints (T006/T007 → T010/T013/T018)
- Core implementation before client integration (T009 → T011, T013 → T014, T021 → T022)
- Story checkpoint validated before next priority starts

### Parallel Opportunities

- Phase 1: T002 parallel with T001 (verification-only, different concerns)
- Phase 2: T003 + T004 parallel (different migration files); T005 parallel with services (different files, validator names agreed)
- US1: T008 standalone; T011 parallel with T009/T010 (client copy vs server, different files)
- US2: T012 standalone; T014 parallel with T013 (client panel vs server endpoints)
- US3: T015 standalone (fixtures + migration only)
- US4: T017 standalone; T019 parallel with T018 (verification vs evaluator, different files)
- US5: T020 standalone; T022 parallel with T021 (dashboard vs storefront, different files)
- US6: T023 needs no DB and can run any time after copy exists
- Polish: T025 + T026 overlap allowed (checks vs scenario runs)

---

## Parallel Example: User Story 2

```bash
# Write the admin lifecycle test first (TDD, fails without endpoints):
Task: "TDD tests/subscription-admin.test.js — activate/extend/cancel/suspend/audit in tests/subscription-admin.test.js"

# Then build server and client in parallel (different files):
Task: "Admin endpoints + listing columns in server/routes/owner.routes.js + server/controllers/owner.controller.js"
Task: "Platform panel UX in client/js/owner.js + client/owner.html"
```

---

## Implementation Strategy

### MVP First (User Stories 1–3)

1. Complete Phase 1: Setup (T001–T002)
2. Complete Phase 2: Foundational (T003–T007) — CRITICAL, blocks all stories
3. Complete Phase 3: US1 trial (T008–T011) with tests failing first
4. Complete Phase 4: US2 admin activation (T012–T014)
5. Complete Phase 5: US3 migration safety (T015–T016)
6. **STOP and VALIDATE**: trial journey + admin renewal + grandfathering on disposable DB
7. Deploy/demo only with explicit user approval (constitution XXVI)

### Incremental Delivery

1. Setup + Foundational → plans seeded, derivation live
2. Add US1 → trial works end to end (MVP slice 1)
3. Add US2 → revenue operable without a gateway (MVP slice 2)
4. Add US3 → incumbents proven safe (release gate)
5. Add US4 → plans gain teeth in capabilities
6. Add US5 → per-surface matrix holds (incl. the one clarified storefront change)
7. Add US6 → copy/audit visibility hardening
8. Polish → gates green, quickstart 1–7 clean

### Parallel Team Strategy

With multiple developers (after Foundational):

1. Developer A: US1 trial + owner reads (T008–T011)
2. Developer B: US2 admin endpoints + panel (T012–T014)
3. Developer C: US4/US5 enforcement + surfaces (T017–T022)
4. US3 + US6 join once migrations and copy stabilize

---

## Notes

- [P] tasks = different files, no dependencies — safe for parallel agents
- [Story] label maps each story-phase task to its user story for traceability
- Data-model constraints quoted verbatim in tasks (UNIQUE per business, RESTRICT plan delete, `== end instant` expired, later-of extension, append-only audit)
- Commit after each task or logical group; stop at any checkpoint to validate the story independently
- Avoid: vague tasks, same-file parallel edits, cross-story dependencies that break independence
- Total: 26 tasks (Setup 2, Foundational 5, US1 4, US2 3, US3 2, US4 3, US5 3, US6 2, Polish 2)

## Format Validation

- All 26 tasks use `- [ ] TNNN [P]? [USn]? description + exact file path` — checkbox ✓, sequential IDs ✓, [P] only for parallelizable different-file tasks ✓, [USn] on every story-phase task and none elsewhere ✓
