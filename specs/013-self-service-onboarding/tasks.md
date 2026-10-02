# Tasks: Self-Service Onboarding (`013-self-service-onboarding`)

**Input**: Design documents from `/specs/013-self-service-onboarding/` (plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md)

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Included — the feature spec (§40 Testing) and constitution (XXV) explicitly require comprehensive automated tests. Tests are written FIRST and MUST fail before implementation (TDD per constitution workflow for non-trivial logic).

**Organization**: Tasks grouped by user story; each story phase is an independently testable increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Web app: `server/` (routes → controllers → services → parameterized SQL), `client/` (vanilla HTML/JS/CSS), `database/migrations/`, `tests/`
- New test files: `tests/signup.test.js`, `tests/signup-journey.test.js`, `tests/business-type-profiles.test.js`, `tests/onboarding.test.js`, `tests/onboarding-capabilities.test.js`, `tests/onboarding-i18n.test.js`
- Existing suites (`tests/auth.test.js`, `tests/tenant-isolation.test.js`, `tests/domain-business-types.test.js`, `tests/domain-capabilities.test.js`, …) are extended in place only where noted and NEVER weakened

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Baseline verification before any code changes

- [X] T001 Record green baseline: `npm run check` reports 0 failures and `database/migrate.js` runs clean twice (idempotent) on a disposable `TEST_DATABASE_URL`; no code changes
- [X] T002 [P] Confirm next migration number is `027` (`026_push_label.sql` is latest) and the `schema_migrations` idempotency convention for `database/migrations/027_onboarding_state.sql`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared backend both the wizard and every user story depend on (atomic signup, onboarding state, validators, slug resolution)

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Write additive migration `database/migrations/027_onboarding_state.sql`: `ALTER TABLE restaurants ADD COLUMN onboarding_status TEXT NOT NULL DEFAULT 'completed'` (only `'in_progress' | 'completed'`) and `ADD COLUMN onboarding_step TEXT NOT NULL DEFAULT 'done'`; idempotent guard per `database/migrate.js` convention; existing rows keep working defaults
- [X] T004 Extend `server/validators/index.js` with `validateSignup` (email/username/password via existing primitives; `businessType` limited to the 6 named choices + `other`; unknown `plan`/`capabilities`/`restaurant_id`/`owner_id` fields rejected, never read), `validateSlugAvailability`, and `validateOnboardingStep` (only `setup | product | fulfillment | hours | review`)
- [X] T005 [P] Add numeric-suffix slug resolver next to `normalizeSlug` in `server/utils/checks.js` (`slug`, `slug-2`, `slug-3`…); existing `RESERVED_SLUGS`, format `^[a-z0-9]+(-[a-z0-9]+)*$`, length 2–63 rules unchanged; DB UNIQUE stays final arbiter
- [X] T006 Create `server/services/signup.service.js`: single `withTx` transaction creating `users` (`role='admin'`, bcrypt-12 via existing helpers) + `restaurants` (name, mapped `business_type` satisfying the 9-value CHECK, resolved slug) + `restaurant_settings` row + exactly 7 `restaurant_hours` rows + `subscription_ends_at = now() + platform_settings.trial_days`; 1:1 guard (session already has `restaurant_id`, or email/username taken → refuse); client-sent plan/capability claims ignored
- [X] T007 Create `server/controllers/signup.controller.js` + `server/routes/signup.routes.js` (`POST /api/signup` → 201 per `contracts/signup.md`, `GET /api/signup/slug-availability`; `authLimiter` + `originGuard`, `{ error: { code, message } }` envelope) and mount the router in `server/app.js` following the existing route-mount pattern (depends on T006)
- [X] T008 Create `server/services/onboarding.service.js` + `server/controllers/onboarding.controller.js` + `server/routes/onboarding.routes.js` (`GET /api/onboarding/state`, `PUT /api/onboarding/state`, `POST /api/onboarding/complete`; tenant ONLY from `req.user.restaurant_id`; complete gate = valid name/type/slug + fulfillment choice + exactly 7 hours rows, product count NOT a gate, idempotent) and mount in `server/app.js` (depends on T004)
- [X] T009 [P] Add signup/onboarding console-event logging (account created, business created, type selected, completed, resumed, failed) in the new services using existing `console.*` server patterns; never log request bodies

**Checkpoint**: Foundation ready — `POST /api/signup` → 201 + session, state endpoints round-trip, migration re-runnable; user story work can now begin

---

## Phase 3: User Story 1 — Visitor creates account and publishes store (Priority: P1) 🎯 MVP

**Goal**: Full public journey for a restaurant: homepage → signup → wizard → first product → fulfillment → hours → review → storefront orderable + dashboard reachable

**Independent Test**: Clean browser, complete the wizard for a restaurant, open the storefront as guest (product visible, pickup order 201s) and the dashboard as owner; owner–business link correct

### Tests for User Story 1 (write FIRST, ensure FAIL before implementation)

- [X] T010 [P] [US1] TDD `tests/signup.test.js`: successful signup (201 shape per `contracts/signup.md` + signed-in session), duplicate email/username safe-409 with zero partial rows, invalid business type/slug rejected, second-business attempt by an owning session → 403, `trialEndsAt ≈ now()+7d`, transaction rollback leaves no orphan user/business
- [X] T011 [P] [US1] TDD `tests/signup-journey.test.js`: end-to-end `POST /api/signup` → category + menu-item via existing admin endpoints (name 1–100, `priceCents` 0–10M) → fulfillment toggle → 7 hours rows → `POST /api/onboarding/complete` → guest checkout 201 on the new storefront → dashboard SSE path unaffected

### Implementation for User Story 1

- [X] T012 [US1] Create wizard shell `client/signup.html` (skeleton-loader-first per convention, `data-i18n` attrs, `lang`/`dir` handling, mobile-firstviewport, one-question-per-step layout)
- [X] T013 [P] [US1] Implement generic step machine in `client/js/signup.js` (type → info → setup → product → fulfillment → hours → review → done; progress/position display; calls existing `POST /api/admin/categories`, `POST /api/admin/items`, `PUT /api/admin/hours`, `PATCH /api/admin/settings` plus new state endpoints; no dashboard data fetched)
- [X] T014 [P] [US1] Add core wizard strings to both `ar` and `en` dicts in `client/js/i18n.js` (plain nontechnical wording; no tenant/plan/capability jargon)
- [X] T015 [US1] Add "Start Free Trial" entry link in `client/index.html` → `/signup.html`
- [X] T016 [US1] Build success screen in `client/signup.html` + `client/js/signup.js` (open store, go to dashboard, share via existing share pattern, QR via existing `GET /api/admin/qr`)

**Checkpoint**: User Story 1 fully functional and independently testable (quickstart §2)

---

## Phase 4: User Story 2 — Onboarding adapts to business type (Priority: P1)

**Goal**: Type-driven wizard (wording, defaults, recommended steps, emphasis) from one central profile module; shared platform underneath

**Independent Test**: Run onboarding for bakery vs home kitchen side by side — terminology, defaults, recommended steps differ; products/orders/storefront/dashboard remain the same shared system

### Tests for User Story 2 (write FIRST, ensure FAIL)

- [X] T017 [P] [US2] TDD `tests/business-type-profiles.test.js`: signup accepts the 6 named choices + `other` (mapped server-side to a stored CHECK value), raw stored-only values outside the signup set rejected, per-type profile flow/terminology/defaults returned; extends `tests/domain-business-types.test.js` patterns without weakening them

### Implementation for User Story 2

- [X] T018 [US2] Create `server/services/business-types.service.js`: static profile per stored type key (flow subset/order, product terminology, default fulfillment, categories policy, relevant/optional capability keys, dashboard emphasis, checklist, help-text i18n keys); adding a type = config + targeted work (depends on T017 failing first)
- [X] T019 [US2] Add `GET /api/business-types` (public chooser: key + i18n keys + icon, no entitlement data) and `GET /api/onboarding/profile` (session tenant) to the new route files per `contracts/capabilities.md` (depends on T018)
- [X] T020 [US2] Drive `client/js/signup.js` steps from the fetched profile (terminology, defaults, recommended/optional features, help text); zero scattered `if businessType ===` branches outside the profile consumer
- [X] T021 [P] [US2] Add type names/descriptions/help strings to `ar`+`en` in `client/js/i18n.js` and render friendly labels wherever the raw snake_case value leaks to owners today (`client/js/owner.js` options, `client/js/admin.js` display; behavior unchanged)

**Checkpoint**: User Stories 1 AND 2 both work; type differences visible, platform shared

---

## Phase 5: User Story 3 — Owner resumes interrupted onboarding (Priority: P2)

**Goal**: Drop-and-return continuity: persisted progress, next-step resume, dashboard continuation state, safe abandonment

**Independent Test**: Complete two steps, close browser, sign back in → prior data intact, next incomplete step offered, exactly one business, finish succeeds with no duplicates

### Tests for User Story 3 (write FIRST, ensure FAIL)

- [X] T022 [P] [US3] TDD `tests/onboarding.test.js`: mid-wizard resume after re-login (step + data preserved), abandonment persists with no auto-delete, `POST /api/onboarding/complete` with missing hours → 409 `INCOMPLETE_SETUP` + `details.missing[]`, double-complete idempotent, unauthenticated access → 401

### Implementation for User Story 3

- [X] T023 [US3] Implement resume landing in `client/js/signup.js` from `GET /api/onboarding/state` (restore entered data from real rows, jump to next incomplete step, never create a second business)
- [X] T024 [US3] Add dashboard continuation banner + readiness percent with next actions in `client/js/admin.js` + `client/admin.html` (visibility only; no route removed) plus its `ar`+`en` strings in `client/js/i18n.js`

**Checkpoint**: Abandoned setups resume cleanly; quickstart §4 passes

---

## Phase 6: User Story 4 — Capability gating with server-side enforcement (Priority: P2)

**Goal**: One matrix + live evaluator (type AND entitlement AND configuration); UI hides/disables AND server rejects bypass attempts; future plans plug in without rewrites

**Independent Test**: Business lacking a capability shows it hidden/disabled AND its direct endpoint call is rejected; granting (type/config/entitlement) makes it succeed; entitlement change re-evaluates live

### Tests for User Story 4 (write FIRST, ensure FAIL)

- [X] T025 [P] [US4] TDD `tests/onboarding-capabilities.test.js`: matrix evaluation true/false per type, hidden-feature direct write rejected (e.g. delivery-gated op with `delivery_enabled=false`), re-evaluation after config change flips access, numeric limit boundary (`menuItemsUsed` vs `max_menu_items`, `canAddProduct`, `MENU_LIMIT_REACHED` preserved), forged `plan`/`capabilities` claims ignored; extends `tests/domain-capabilities.test.js` patterns without weakening them

### Implementation for User Story 4

- [X] T026 [US4] Create `server/services/capabilities.service.js`: static `CAPABILITIES` matrix (`key`, `supportedTypes[]`, `recommendedFor[]`, `configKey|null`, `defaultOn`, `limitKind|null`) + pure live `can(businessRow, key)`; entitlement input is `{ plan: 'trial-placeholder', subscriptionEndsAt }` — no commercial tier names (depends on T025 failing first)
- [X] T027 [US4] Add `requireCapability(key)` in `server/middleware/auth.js` (composed after `requireRestaurantAdmin`, session-derived tenant only) and enforce on gated writes: `PUT /api/admin/delivery-groups` plus one second gated write; document the application pattern for future routes (depends on T026)
- [X] T028 [US4] Add `GET /api/onboarding/capabilities` (live effective set + `limits{maxMenuItems,menuItemsUsed,canAddProduct}` + `entitlement.plan:'trial-placeholder'`) to `server/routes/onboarding.routes.js` per `contracts/capabilities.md` (depends on T026)
- [X] T029 [P] [US4] Render hidden/disabled + emphasized states from profile + effective capabilities in `client/js/admin.js` and `client/js/signup.js` (visibility only; authorization stays server-side)

**Checkpoint**: Bypass attempts fail server-side; quickstart §5 passes

---

## Phase 7: User Story 5 — Post-launch management in Arabic/English on mobile (Priority: P3)

**Goal**: Continued configuration from a per-type-emphasized dashboard; full AR-RTL/EN-LTR parity; accessible, fast onboarding on weak devices

**Independent Test**: Complete onboarding on a 360px viewport in Arabic, switch to English, manage products/hours from the dashboard by touch + keyboard with understandable errors

### Tests for User Story 5 (write FIRST, ensure FAIL)

- [X] T030 [P] [US5] TDD `tests/onboarding-i18n.test.js`: every wizard/banner key used by `client/signup.html` + `client/js/signup.js` exists in both `ar` and `en` dicts; owner-facing strings contain no `tenant`/`plan`/`capability` jargon

### Implementation for User Story 5

- [X] T031 [US5] Accessibility + language pass on `client/signup.html`: semantic controls with labels, visible focus, keyboard-reachable steps, non-color-only status, RTL layout under default `ar` and LTR under `en`
- [X] T032 [P] [US5] Mobile/weak-network pass: wizard fetches no dashboard data (profile + state + step endpoints only), skeleton paints first, image-upload failures explained without data loss; per-type dashboard module emphasis in `client/js/admin.js` (reorder/emphasize tabs, never remove routes)

**Checkpoint**: quickstart §3 passes on narrow viewport in both languages

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Gates before converge — full-suite green, spec checklists, smoke

- [X] T033 Address reviewer findings in `specs/013-self-service-onboarding/checklists/capabilities.md` (reviewer-owned markers; implementation fixes only, no marker editing by implementer)
- [X] T034 [P] `npm run check` 0 failures and `node --test tests/` fully green on disposable `TEST_DATABASE_URL` (existing suites unweakened, new suites included)
- [X] T035 Execute `specs/013-self-service-onboarding/quickstart.md` scenarios 1–7 end to end and fix gaps (journey, zero-product, resume, adversarial/isolation, regression, smoke)
- [X] T036 [P] Constitution re-check (I–XXVIII) against the diff: no React/build, no new deps, additive migration only, no payments, no duplicate auth/business/product/order/hours/tenant code, hidden-UI-never-authz

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational completion
  - Then proceed in priority order (US1 → US2 → US3 → US4 → US5), or in parallel if staffed
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: After Foundational — no other story dependencies (generic wizard flow)
- **US2 (P1)**: After Foundational — enhances US1's wizard via profiles; independently testable via profile endpoints + per-type flows
- **US3 (P2)**: After Foundational (state endpoints) — integrates with US1's wizard client; resume logic independently testable
- **US4 (P2)**: After Foundational — matrix/evaluator independent; enforcement touches existing admin routes (delivery-groups +1) with tests proving no regression
- **US5 (P3)**: After US1–US4 UI exists — language/mobile/a11y hardening; independently verifiable per quickstart §3

### Within Each User Story

- Test tasks MUST be written and FAIL before implementation (T010/T011, T017, T022, T025, T030)
- Services/modules before endpoints that use them (T006→T007, T018→T019, T026→T027/T028)
- Core implementation before client integration (T012→T013/T016, T019→T020)
- Story checkpoint validated before next priority starts

### Parallel Opportunities

- Phase 1: T002 parallel with T001 (verification-only, different concerns)
- Phase 2: T005 + T009 parallel with the T003 → T004 → T006 → T007 chain (different files, no dependencies)
- US1: T010 + T011 parallel (different test files); T013 + T014 parallel with T012 (different files, agreed element/endpoint contracts)
- US2: T017 parallel with nothing (single test file); T021 parallel with T018/T019/T020 (i18n + display labels, different files)
- US3: T022 standalone; T023/T024 sequential (shared client state shapes) — no forced parallelism
- US4: T025 standalone; T029 parallel with T026/T027/T028 (client visibility vs server enforcement, different files)
- US5: T030 + T032 parallel (test vs client perf, different files)
- Polish: T034 + T036 parallel (checks vs diff review, no shared files)

---

## Parallel Example: User Story 1

```bash
# Launch US1 test tasks together (different files, TDD first):
Task: "TDD tests/signup.test.js — signup cases in tests/signup.test.js"
Task: "TDD tests/signup-journey.test.js — end-to-end journey in tests/signup-journey.test.js"

# Launch US1 client tasks together (different files, agreed contracts):
Task: "Generic step machine in client/js/signup.js"
Task: "Core wizard strings ar+en in client/js/i18n.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T002)
2. Complete Phase 2: Foundational (T003–T009) — CRITICAL, blocks all stories
3. Complete Phase 3: User Story 1 (T010–T016) with tests failing first
4. **STOP and VALIDATE**: quickstart §2 + §6 (journey + no regressions on disposable DB)
5. Deploy/demo only with explicit user approval (constitution XXVI)

### Incremental Delivery

1. Setup + Foundational → atomic signup + onboarding state ready
2. Add US1 → independently testable public store creation (MVP!)
3. Add US2 → type-personalized wizard, same shared backend
4. Add US3 → resume + continuation banner
5. Add US4 → capability enforcement live on gated writes
6. Add US5 → bilingual mobile/a11y hardening
7. Polish → gates green, quickstart 1–7 clean

### Parallel Team Strategy

With multiple developers (after Foundational):

1. Developer A: US1 wizard client (T012–T016)
2. Developer B: US2 profiles + endpoints (T017–T021)
3. Developer C: US4 matrix + enforcement (T025–T029)
4. US3 + US5 join once US1's client contracts stabilize

---

## Notes

- [P] tasks = different files, no dependencies — safe for parallel agents
- [Story] label maps each story-phase task to its user story for traceability
- Data-model constraints quoted verbatim in tasks (slug regex/length, 9-value CHECK, exactly-7-hours, `priceCents` 0–10M, bcrypt-12, `trial-placeholder` literal)
- Commit after each task or logical group; stop at any checkpoint to validate the story independently
- Avoid: vague tasks, same-file parallel edits, cross-story dependencies that break independence
- Total: 36 tasks (Setup 2, Foundational 7, US1 7, US2 5, US3 3, US4 5, US5 3, Polish 4)

## Format Validation

- All 36 tasks use `- [ ] TNNN [P]? [USn]? description + exact file path` — checkbox ✓, sequential IDs ✓, [P] only for parallelizable different-file tasks ✓, [USn] on every story-phase task and none elsewhere ✓
