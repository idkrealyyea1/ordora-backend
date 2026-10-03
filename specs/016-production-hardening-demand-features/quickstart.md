# Quickstart: Validating Production Hardening + Evidence Gate

**Feature**: `016-production-hardening-demand-features` | **Date**: 2026-10-03

How to prove the phase works end-to-end. Implementation details live in `tasks.md` (next command); this guide contains only runnable validation.

## Prerequisites

- Node.js >= 20, disposable Postgres for tests (`TEST_DATABASE_URL`), real `DATABASE_URL` or Wasmer `DB_*` for deploy checks.
- `npm ci`, `npm run migrate`, `npm run check` (0 failures required before any validation counts).

## 1 — Idempotent checkout (FR-001)

1. Create a demo business with one available item; note its slug.
2. Submit checkout twice with the same `submissionKey` UUID in the request body (double-click simulation + manual retry).
3. Expected: one order row; first response `201`, replay `201` with the same `code` and totals.
4. Change the item price, replay the same key → original snapshot totals, still one row.
5. Replay business B's key against business A's slug → denied/not-found, no B data leaked.
6. Automated: `node --test tests/order-idempotency.test.js` (burst of ~50 concurrent replays).

## 2 — Tenant isolation sweep (FR-004/FR-005)

1. Authenticate as restaurant A; request every tenant-scoped path of restaurant B (products, categories, orders, images, settings, notifications, analytics).
2. Expected: all denied, no B fields in any body.
3. Automated: `node --test tests/tenant-isolation.test.js`.

## 3 — Startup / health / shutdown (FR-007/008/009)

1. Boot with `DATABASE_URL` pointed at a closed port → process exits non-zero naming the database (no secret in output).
2. Boot healthy → `GET /api/healthz` is `200 {ok:true}`; `GET /api/readyz` is `200` only after the DB answers.
3. Stop a running instance mid-request with an open dashboard SSE stream → requests settle within the bounded window, process exits, pool released.
4. Automated: `node --test tests/health-readiness.test.js`.

## 4 — Failure isolation + error envelope (FR-010/015/016)

1. Place an order with notification delivery disabled/broken → order still created, failure traced without secrets.
2. Hit a failing endpoint in production mode → stable `code` + safe message, no stack trace.
3. Trigger each FR-016 event → attributable trace within minutes, denylist respected.

## 5 — Backup rehearsal (FR-017)

1. Follow `docs/backups.md` against a disposable database (never production).
2. Expected: businesses, menus, orders, subscriptions recovered; date + outcome appended to the rehearsal log.

## 6 — Scale classification + performance (FR-019/021)

1. Read `docs/scaling.md`: every subsystem classified A/B/C/D with triggers.
2. Run the load scenario (browsing + ~50 concurrent checkouts + dashboard/analytics) → menu-read and order-submission targets from the spec hold; bottlenecks recorded with measurements.

## 7 — Evidence gate (Task 18, FR-023)

1. Open `docs/advanced-feature-evidence.md`; confirm the three initial candidates each carry a full record with a `ship`/`defer` verdict.
2. Confirm no candidate shipped schema, API, or UI in this phase unless its record shows a clear pass, and that any shipped item resolves through `capabilities.service.js` with guest checkout untouched.

## Full suite

```bash
npm run check && TEST_DATABASE_URL=<disposable> node --test tests/
```
