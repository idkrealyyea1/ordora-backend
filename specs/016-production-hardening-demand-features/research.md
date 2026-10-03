# Research: Production Hardening + Demand-Driven Advanced Features

**Feature**: `016-production-hardening-demand-features` | **Date**: 2026-10-03

No `NEEDS CLARIFICATION` items remained in Technical Context (stack, storage, testing, platform all known from the repo). The five spec clarifications (idempotency mechanism, scale, backup bar, Task 18 scope, health shape) are recorded in `spec.md` Clarifications. This document resolves the remaining implementation-level decisions with evidence from the codebase.

## R1 — Duplicate-order prevention mechanism

- **Decision**: Reuse the existing client-generated key path end-to-end (audit outcome — no new mechanism): `submissionKey` UUID in the checkout body, persisted as nullable `orders.submission_key` with the existing per-business `UNIQUE (restaurant_id, submission_key)` from migration `019_booking_overlap.sql`; replay inside the checkout transaction returns the existing order instead of creating a duplicate. (The new-column design originally considered here was dropped after inspection showed 019 already provides it.)
- **Rationale**: Matches clarification B; deterministic across double-click, refresh, retry, and multi-tab (the client mints one UUID per attempt in `client/js/restaurant.js:738-758` and reuses it across retries). Server-checked inside the existing checkout transaction, so concurrent replays serialize on the unique index instead of racing (`23505` winner-returns branch in `orders.service.js`). Existing `order-double-submit` / `order-submission-burst` tests give the harness to extend.
- **Rationale**: Matches clarification B; deterministic across double-click, refresh, retry, and multi-tab (all share the key generated for one checkout intent). Server-checked inside the existing checkout transaction, so concurrent replays serialize on the unique index instead of racing. Investigated code: `createCheckout({ restaurantId, payload })` in `server/services/orders.service.js:177` already runs server-priced validation in a transaction (`withTx`); the key check composes inside that same transaction with no new locking scheme. Existing `order-double-submit` / `order-submission-burst` tests give the harness to extend.
- **Alternatives considered**: (a) Server heuristic window (same contact + items + time) — rejected: nondeterministic, false-positives on genuine repeat orders, untestable boundary. (b) Separate `order_idempotency_keys` table — rejected: an extra join and entity for what a nullable column + partial index expresses; YAGNI until key lifecycle (TTL/reuse policy) demands it.

## R2 — Health signal shape on Wasmer Edge

- **Decision**: Keep `GET /api/healthz → {ok:true}` untouched as liveness (Wasmer `instaboot.requests` in `app.yaml` probes `/` and `/api/healthz`); add `GET /api/readyz` that runs a bounded `SELECT 1` against the pool and returns 200 only when the database answers, 503 otherwise, with no secrets or tenant data in either body.
- **Rationale**: Matches clarification A; smallest change giving the platform both signals. Investigated: `server/routes/public.routes.js:139` healthz has no DB touch (safe liveness); `server/db/pool.js` already centralizes the pool, so the probe reuses it with a statement timeout rather than a new connection path.
- **Alternatives considered**: Query-param deep-check on one endpoint — rejected: pollutes the liveness probe Wasmer already relies on; split endpoints are unambiguous for routing.

## R3 — Startup determinism and shutdown completeness

- **Decision**: (a) Before `app.listen`, run a bounded DB probe; on failure log the dependency name (never the connection string) and exit non-zero in every environment. (b) On `SIGTERM`/`SIGINT`, keep the existing 10s force-exit, add SSE hub drain (`closeAll` exported from `server/middleware/sse.js`) before `pool.end()`.
- **Rationale**: Investigated `server.js`: prod-only `migrate()` with fail-fast exists, but non-prod boots deaf to an unreachable DB, and shutdown never touches the SSE `clients` Map (connections hold the process/restart semantics unclear). Probe-before-listen closes the "silently broken app" gap (FR-007); hub drain closes the restart-leak gap (FR-008). Both are additive and reversible.
- **Alternatives considered**: Retry-with-backoff startup — rejected: masks a misconfigured deploy and fights the platform's own restart policy; fail fast with a clear message, let Wasmer restart.

## R4 — Single-instance subsystems (no new infrastructure)

- **Decision**: Keep in-process rate limiting (`express-rate-limit` memory store) and the in-process SSE hub; classify per FR-019: sessions = safe (PG-backed `connect-pg-simple`); rate counters = intentionally-single-instance (diverge across nodes, documented); SSE hub = needs-later-architectural-change (events don't cross nodes, vanish on restart — already marked with a `ponytail:` ceiling comment in `sse.js`); images in `bytea` = acceptable at current scale with documented caps (2MB/file via `MAX_UPLOAD_MB`, retrieval via indexed primary-key fetch, backup impact via managed-PG backups).
- **Rationale**: Matches "complexity must be earned" and the moderate scale target (hundreds of businesses, ~1k orders/day): measured load does not justify shared stores. Both `ratelimit.js` and `sse.js` already carry comments stating the single-node ceiling — the work is verification + `docs/scaling.md`, not replacement.
- **Alternatives considered**: Shared store / broker now — rejected: no measurement demands it; would add an undeclared dependency Wasmer Edge `app.yaml` does not provide.

## R5 — Observability without secrets

- **Decision**: Tiny `server/utils/observe.js` helper (stdlib only, JSON-line to stdout) with an explicit denylist (password, secret, token, vapid, session, card); log the FR-016 event list at `info`, unexpected errors at `error` with a stable code. No log framework dependency.
- **Rationale**: Existing code uses ad-hoc `console.log`/`console.error` (e.g. `[migrate]`, `[app]`); a 30-line helper standardizes attribution (who/business/when/outcome) without adding a dependency the Edge build must carry. Error envelope in `server/utils/errors.js` already exists — verify-only, no redesign.
- **Alternatives considered**: Log framework (pino/winston) — rejected: dependency + transport config for what stdout JSON lines satisfy at this scale.

## R6 — Backup/restore honesty on managed Postgres

- **Decision**: Document the actual Wasmer managed-database backup behavior (automatic backups, retention as shown by the platform at implementation time) plus the manual safety net (`pg_dump` against `DATABASE_URL`/`DB_*` to operator storage), and rehearse restore on a disposable database recording date + outcome; never claim an unverified backup as protection.
- **Rationale**: `README.md` states automatic backups ≥14 days but the recovery click-path was never verified in-repo; FR-017 demands reflecting actual platform capabilities. Rehearsal on a non-production copy is the only honest Done signal (SC-006).
- **Alternatives considered**: Asserting platform restores work without rehearsal — rejected explicitly by the spec ("a backup never restored is not verified").

## R7 — Task 18 scope: framework + decision record, no pre-approved feature

- **Decision**: Task 18 deliverable is `docs/advanced-feature-evidence.md` (template from FR-023 fields) plus one decision record evaluating the top candidates visible in-repo (reorder, promotions/coupons, loyalty) and deferring each with a stated reason unless live evidence clearly passes the gate. No schema, API, or UI for any candidate ships in this phase.
- **Rationale**: Matches clarification B and constitution XIII/XIV (no speculative features; every feature names a beneficiary). Candidates recur in the roadmap text as possibilities only; the repo shows no demand telemetry (no feature-usage events, no feedback store), so the honest record is "evaluated → deferred pending evidence" with the trigger metric that would reopen each.
- **Alternatives considered**: Pre-approving reorder or coupons now — rejected: would expand schema/API/UI and regression surface without the evidence the whole task demands.
