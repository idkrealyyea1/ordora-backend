# Implementation Plan: Post-Order Experience Insights

**Branch**: `011-post-order-experience-insights` | **Date**: 2026-09-30 | **Spec**: `specs/011-post-order-experience-insights/spec.md`

**Input**: Feature specification from `specs/011-post-order-experience-insights/spec.md` (Tasks 9–12 as one phase; 5 clarification answers integrated 2026-09-30)

## Summary

Tasks 9–12 extend the proven Tasks 1–8 ordering core without rebuilding it. Task 9 enriches the existing guest confirmation (`restaurant.js:renderSuccess`) and tracking page (`track.js`, 15s polling) with full summaries, kind-correct timelines, live-definition reorder, and plain error states — polling-only for guests (clarified). Task 10 sharpens the existing owner orders board (`admin.js`, `PATCH /orders/:id/status`, SSE refresh) with visual-only new-order prominence, pickup/delivery and pre-order distinction, and prioritized lists. Task 11 introduces one internal notification abstraction over the existing in-process SSE hub with persisted per-event dedup records, keeping dashboard realtime and adding Web Push-ready foundation (no live push — clarified). Task 12 extends the existing analytics endpoints (`orders.dashboardCounts/analyticsSeries/topItems/byDayOfWeek/byHour/exportRows`) with today/7/30-day presets plus a bounded custom range, exact per-currency aggregation, and option-safe product counts. All schema change is additive and idempotent; all money stays server-computed in frozen cents.

## Technical Context

**Language/Version**: Node.js 20+ (engines field), vanilla HTML/CSS/JS frontend, no build step, no TypeScript

**Primary Dependencies**: Existing only — `express@4`, `pg`, `express-session` + `connect-pg-simple`, `helmet`, `express-rate-limit`, `multer`, `qrcode`, `bcryptjs`. No new runtime dependency planned; Web Push (if ever shipped) would need explicit approval per constitution XI.

**Storage**: PostgreSQL via `server/db/pool.js` (`Pool` + `withTx`). Existing tables reused as-is (`orders`, `order_items`, `order_item_options`, `menu_items`, `option_groups/choices`, `restaurants`, `restaurant_settings`). Two new additive tables max: notification event/dedup log + push subscription shape (see data-model.md). Idempotent migrations in `database/migrations/*.sql` via `database/migrate.js`.

**Testing**: `node --test tests/` against disposable `TEST_DATABASE_URL` (never prod) + `tests/helpers.js` wiring; `npm run check` (`scripts/check-syntax.js`) 0 failures required; manual AR+EN mobile-viewport smoke.

**Target Platform**: Wasmer Edge (`app.yaml` name `restaurants`, `fr-roub1`, remote build) + local Node for dev/test. Single-node runtime assumed (existing SSE hub is in-process).

**Project Type**: Web service + vanilla frontend (server-rendered static `client/` + JSON `/api/*`).

**Performance Goals**: Guest confirmation/tracking first paint unchanged-or-faster on weak phones (reuse CSS, no new assets); new order visible on open dashboard within ~15s of checkout via existing SSE; guest status correct within improved polling interval; analytics endpoints bounded by period (≤90 days / bounded custom range) and `restaurant_id`, no N+1.

**Constraints**: Single-node in-process SSE (no broker); no customer accounts; no payment gateway; no GPS/drivers; no paid email/SMS; Web Push default-off, no invented credentials; money in integer cents, client prices ignored; AR RTL + EN LTR intact; skeleton/offline patterns intact.

**Scale/Scope**: One deployment, many tenants with small per-tenant order volumes; directory/menu reads stay paginated/bounded as today; analytics aggregates per business per period; CSV export capped (existing 5000-row pattern).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I Preserve working functionality** — PASS: every story states "improve in place, never duplicate/rebuild"; Tasks 1–8 transition map, checkout, snapshots, URLs frozen.
- **II No React / vanilla only** — PASS: `restaurant.js`/`track.js`/`admin.js` extended, no framework, no build.
- **III Small isolated changes** — PASS: four independently testable stories; notification abstraction is the only new module and it wraps (not rewrites) order writes.
- **IV–VI Inspect, code-wins, no guessing on shared code** — PASS: plan grounded in inspected `orders.service.js`, `admin.controller.js:analytics/events`, `public.routes.js` track/cancel, `sse.js`, `track.js`, `restaurant.js:renderSuccess/submitOrder`, validators; client money stays ignored.
- **VII–VIII Safe additive migrations** — PASS: max 2 new tables + optional indexes, `IF NOT EXISTS`, defaults safe, history immutable; no destructive change.
- **IX Tenant isolation** — PASS: owner reads scoped by `req.user.restaurant_id`; guest by code knowledge with uniform 404; notification events carry/check `restaurant_id`.
- **X Security posture** — PASS: authN/Z, origin guard, rate limits, server validation, parameterized SQL, error envelope all preserved; guest stays polling-only (no new anonymous push channel to secure).
- **XI Dependencies** — PASS: none added.
- **XII–XIV Simplicity, no speculation, purpose-gated** — PASS: polling-only guests, visual-only prominence, foundation-only push, presets+bounded custom range (user-chose custom; still bounded/server-validated); every addition names its beneficiary.
- **XV–XVI Simple CX, guest checkout** — PASS: no accounts, few steps, mobile-first, AR/EN.
- **XVII No payment gateway** — PASS: explicitly out of scope.
- **XVIII–XIX One system, configurable capabilities** — PASS: kind badges presentational; no per-type forks.
- **XX–XXIII i18n/currency honesty, SEO honesty, no fabricated proof, visual identity** — PASS: per-currency grouping no FX, zero-filled/empty states, no fake metrics, identity frozen.
- **XXIV Reliability over count** — PASS: failures in notifications/realtime/analytics never break orders; dedup; bounded queries.
- **XXV–XXVI Tests + verify** — PASS: TDD smallest checks, extend `tests/` in place, never weaken; `check` + disposable-DB suite + smoke required.
- **XXVII–XXVIII Flag weak approaches, ask when ambiguous** — PASS: 5 clarifications resolved and integrated (polling-only, visual-only, persisted events, foundation-only push, presets+custom).

Post-design re-check: no new violations introduced (see Complexity Tracking — empty, none needed).

## Project Structure

### Documentation (this feature)

```text
specs/011-post-order-experience-insights/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── guest-tracking.md
│   ├── owner-orders.md
│   ├── notifications.md
│   └── analytics.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
server/
├── services/
│   ├── orders.service.js        # extend: confirmation payload shape, reorder-live-check helper, analytics custom-range + preorder split (no lifecycle change)
│   └── notifications.service.js # NEW: emit(event) abstraction, channel registry, persisted dedup, SSE adapter (wraps sse.js)
├── controllers/
│   └── admin.controller.js      # extend: analytics custom-range params, listOrders ordering/priority, events() via notifications service
├── routes/
│   ├── public.routes.js         # unchanged shapes (track/cancel); polling contract documented
│   └── admin.routes.js          # unchanged shapes; analytics query params extended additively
├── middleware/
│   └── sse.js                   # reused as transport adapter (unchanged or thin wrap)
├── validators/
│   └── index.js                 # extend: custom-range date validation (bounded), reuse checkout/status validators
database/
├── migrate.js                   # reused
└── migrations/
    └── 025_notifications.sql    # NEW: notification_events dedup log + push_subscriptions (IF NOT EXISTS, default-off)
client/
├── js/
│   ├── restaurant.js            # extend renderSuccess: full summary + next steps + reorder with selections
│   ├── track.js                 # extend: improved polling cadence/visibility/offline, kind timelines, live-definition reorder, error states
│   ├── admin.js                 # extend: new-order prominence, kind badges, priority ordering, analytics presets+custom range
│   └── i18n.js                  # extend: new keys in AR + EN
└── css/                         # reuse existing; small additive classes only
tests/
├── journey-confirmation.test.js # NEW (Task 9)
├── operations-board.test.js     # NEW (Task 10)
├── notifications-foundation.test.js # NEW (Task 11)
└── analytics-insights.test.js   # NEW (Task 12)
```

**Structure Decision**: Single-project layout preserved exactly; one new service module (`notifications.service.js`) plus one additive migration; all other changes are in-place extensions of existing files following `routes → controllers → services → parameterized SQL` and vanilla-JS frontend conventions.

## Complexity Tracking

> No constitution violations requiring justification. Table intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
