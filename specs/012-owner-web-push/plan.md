# Implementation Plan: Owner Web Push

**Branch**: `012-owner-web-push` | **Date**: 2026-09-30 | **Spec**: `specs/012-owner-web-push/spec.md`

**Input**: Feature specification from `specs/012-owner-web-push/spec.md` (real end-to-end owner/admin new-order push + preserved SSE; 3 clarification answers integrated 2026-09-30)

## Summary

Activate the dormant `push` channel in the Tasks 9–12 notification abstraction without touching the SSE path. Server: VAPID config from environment (single platform keypair, clarified), authenticated subscription endpoints bound to the session tenant (admins only, staff refused), a real push sender fanning out to the business's active subscriptions with claim-dedup, dead-endpoint deactivation, and no-retry failure policy (clarified). Client: a settings notifications card with gesture-initiated permission UX and device list, plus additive service-worker push/click handlers that deep-link to the dashboard order view. Everything rides the existing `emit()` flow, `notification_events` rows, and `push_subscriptions` table; one tiny additive migration adds an optional device label.

## Technical Context

**Language/Version**: Node.js 20+, vanilla HTML/CSS/JS frontend, no build step, no TypeScript

**Primary Dependencies**: Existing only, plus ONE proposed addition — a small Web Push sending library (VAPID signing + payload encryption), chosen at plan time under constitution XI because hand-rolled Web Push crypto is a reliability/security risk. No other new runtime dependency.

**Storage**: PostgreSQL via `server/db/pool.js`. Reuse `push_subscriptions` (025) and `notification_events` (025); one additive migration (`026_push_label.sql`, optional device label) only if the settings device list needs it.

**Testing**: `node --test tests/` on disposable `TEST_DATABASE_URL` with push-service calls stubbed at the sender boundary; `npm run check` 0 failures; manual production checklist with real keys + real devices.

**Target Platform**: Wasmer Edge (`app.yaml` name `restaurants`, remote build) + local Node for dev/test. Browsers with Push API support; graceful unavailable states elsewhere.

**Project Type**: Web service + vanilla frontend (static `client/` + JSON `/api/*`).

**Performance Goals**: Push fan-out completes within seconds of order commit for a business's devices; one slow/dead endpoint never delays others (bounded concurrency); checkout latency unchanged (after-commit, non-blocking); SSE cadence unchanged.

**Constraints**: Single platform VAPID keypair (clarified); admins-only audience (staff refused, clarified); no-retry-on-transient-failure (clarified); minimal payload (title/code/business, no customer PII); private key env-only, never logged/committed/exposed; existing SW caching behavior preserved; AR RTL + EN LTR.

**Scale/Scope**: One deployment; per-business device counts are small (single digits); per-order fan-out is one indexed query + a handful of HTTPS sends.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I Preserve working functionality** — PASS: SSE path byte-identical; tracking/checkout untouched; push is additive.
- **II Vanilla only** — PASS: settings card + SW handlers in existing vanilla files, no framework.
- **III Small isolated changes** — PASS: sender swap + 3 endpoints + SW handlers + settings card; no rewrites.
- **IV–VI Inspect, code-wins, shared code** — PASS: plan grounded in inspected `notifications.service.js`, `sw.js`, `pwa.js`, `admin.routes.js`, `auth.js`, `025_notifications.sql`, `admin.js` settings; client-supplied ids never trusted.
- **VII–VIII Safe migrations** — PASS: at most one additive nullable column; no history rewrite.
- **IX Tenant isolation** — PASS: stricter-than-`requireRestaurantAdmin` guard (staff refused per clarification); tenant from session; fan-out scoped by `restaurant_id`.
- **X Security posture** — PASS: authN/Z, origin guard, rate limits, validation, parameterized SQL, key hygiene, minimal payloads; VAPID private never leaves server.
- **XI Dependencies** — ONE new dep proposed with explicit value justification (see research R1); documented here, not smuggled.
- **XII–XIV Simplicity, no speculation, purpose-gated** — PASS: push on `order.created` only; no status push; no parallel system; beneficiary is the off-dashboard owner.
- **XV–XVI Simple CX, guest checkout** — PASS: guest flow untouched; owner opt-in is one card + one tap.
- **XVII No payment gateway** — PASS: untouched.
- **XVIII–XIX One system** — PASS: no per-type branches.
- **XX–XXIII i18n honesty, SEO honesty, no fabrication, identity** — PASS: AR+EN strings, no fake claims, SW cache behavior preserved.
- **XXIV Reliability** — PASS: push secondary; failures contained; no retry loops; dead-endpoint cleanup.
- **XXV–XXVI Tests + verify** — PASS: stubbed-sender tests, disposable-DB suite, production checklist.
- **XXVII–XXVIII Flag weak approaches, ask when ambiguous** — PASS: 3 clarifications integrated (VAPID scope, audience, retry).

Post-design re-check: no new violations (see Complexity Tracking — empty).

## Project Structure

### Documentation (this feature)

```text
specs/012-owner-web-push/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── subscriptions.md
│   ├── push-delivery.md
│   └── service-worker.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
server/
├── services/
│   └── notifications.service.js  # extend: real push sender (VAPID, fan-out, dead-endpoint handling)
├── controllers/
│   └── admin.controller.js       # extend: push subscription handlers + public-key handler
├── routes/
│   └── admin.routes.js           # extend: GET/POST/DELETE /push-subscriptions, GET /push-public-key (admin-only guard)
├── middleware/
│   └── auth.js                   # extend: admin-only (no staff) guard for push routes (existing guards untouched)
├── validators/
│   └── index.js                  # extend: subscription + label validators
database/
└── migrations/
    └── 026_push_label.sql        # NEW (if needed): optional device label on push_subscriptions
client/
├── js/
│   ├── admin.js                  # extend: settings notifications card (permission UX, device list)
│   └── i18n.js                   # extend: AR+EN push strings
└── sw.js                         # extend: additive push + notificationclick handlers (cache behavior unchanged)
tests/
└── push-notifications.test.js    # NEW: subscription authZ/isolation/dedup/cleanup/failure-containment/SSE-coexistence
```

**Structure Decision**: Single-project layout preserved; all changes are in-place extensions plus one sender swap, three endpoints, and one test file. No new service, no parallel notification system.

## Complexity Tracking

> No constitution violations requiring justification. The single proposed dependency is justified in research R1, not as a violation.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
