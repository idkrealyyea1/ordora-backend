# Implementation Plan: Production Hardening + Demand-Driven Advanced Features (Task 17 + Task 18)

**Branch**: `016-production-hardening-demand-features` | **Date**: 2026-10-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/016-production-hardening-demand-features/spec.md`

## Summary

Task 17 hardens the existing Restivo monolith (Express 4 + PostgreSQL + vanilla JS, Wasmer Edge single instance) into a reliably operable SaaS: verification + race-hardening of the existing idempotent checkout (`submission_key` UUID with per-business unique constraint — audit showed no new migration needed), liveness/readiness split (`/api/healthz` kept, `/api/readyz` added with a bounded DB probe), fail-fast startup probe, SSE-aware graceful shutdown, failure isolation for non-critical paths, tenant/subscription/capability verification, rate-limit and input-security audits, JSON observability without secrets, documented backup/rehearsal and deploy pipeline, and scale classification docs. Task 18 adds only an evidence-template + decision record (docs-level); no new product feature ships unless it clearly passes the gate. Target scale: hundreds of businesses, ~1,000 orders/day, ~50 concurrent checkouts. No new infrastructure, no framework migration, no payment gateway.

## Technical Context

**Language/Version**: Node.js >= 20 (`node` runtime, `'use strict'` CommonJS throughout)

**Primary Dependencies**: express 4, pg 8, express-session + connect-pg-simple (PG session store), helmet, express-rate-limit 7, multer (memory → `bytea`), bcryptjs (cost 12), qrcode, web-push — no new runtime dependencies planned

**Storage**: PostgreSQL (Wasmer managed PG via `DB_*` + TLS, or `DATABASE_URL`); idempotent SQL migrations in `database/migrations/*.sql` (001–033) tracked by `schema_migrations`; money in integer cents; images as `bytea` in `uploaded_files`

**Testing**: `node --test tests/` against disposable `TEST_DATABASE_URL` only (helpers refuse to run without it); `npm run check` (`scripts/check-syntax.js`) must pass with 0 failures; 60+ existing test files covering auth, isolation, orders, subscriptions, onboarding, push

**Target Platform**: Wasmer Edge, region `fr-roub1`, single application instance (`app.yaml` name `restaurants`); static assets CDN-cached ~1h

**Project Type**: Web-service monolith (server-rendered static + JSON API; vanilla HTML/CSS/JS frontend, no build step, no TypeScript)

**Performance Goals**: Guest storefront-to-order completable in under 3 minutes on mid-range mobile; 95% of storefront menu reads under 2 seconds on throttled mobile; order submission stays responsive under concurrent dashboard/analytics load

**Constraints**: Strict CSP (`default-src 'self'`, no inline scripts); server-side sessions (HttpOnly, SameSite=Lax, `__Host-`+Secure in prod); client-sent money/ownership ignored; guest checkout mandatory; no online payments; single-instance in-process SSE hub and rate counters; explicit human approval for production deploys

**Scale/Scope**: Hundreds of businesses, ~1,000 orders/day, bursts of ~50 concurrent checkouts; horizontal-scale work is classification + documentation only

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Gate (constitution) | Status |
|---|---------------------|--------|
| II | No React/framework migration, vanilla JS untouched | PASS — no frontend framework changes planned |
| III | No architecture rebuild without evidence; small revertable changes | PASS — additive deltas only (one column, one endpoint, probe, hub cleanup) |
| VII/VIII | Safe idempotent migrations, no destructive change without path | PASS — one backward-compatible nullable column + partial index; no DROP/TRUNCATE |
| IX | Tenant identity only from `req.user.restaurant_id`; every tenant query scoped | PASS — idempotency key scoped per `restaurant_id`; isolation tests extended, not weakened |
| X | No security weakening (sessions, CSRF/origin, rate limits, CSP, uploads) | PASS — all existing protections retained; rate limits only extended |
| XII/XIII/XIV | Simplicity; no speculative features; every feature names a beneficiary | PASS — Task 18 ships framework + decision record only |
| XVI/XVII | Guest checkout core; no payment gateway | PASS — checkout flow unchanged, key is optional-safe metadata |
| XXV/XXVI | Tests required, never weakened; `npm run check` 0 failures; smoke routes | PASS — new tests added alongside existing suite |
| V | Code/migrations/tests/runtime are source of truth over stale docs | PASS — plan grounded in inspected `server.js`, `app.js`, `auth.js`, `sse.js`, `ratelimit.js`, `orders.service.js`, `subscriptions.service.js`, `capabilities.service.js`, `migrate.js` |

Post-design re-check: no new violations introduced (see research.md decisions — all additive, all reversible).

## Project Structure

### Documentation (this feature)

```text
specs/016-production-hardening-demand-features/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── checkout-idempotency.md
│   ├── health.md
│   ├── errors.md
│   └── evidence-template.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
server/
├── app.js                      # mount /api/readyz, keep /api/healthz as-is
├── routes/public.routes.js      # checkout accepts idempotency key; readiness route
├── services/orders.service.js   # key-checked createCheckout in tx
├── services/subscriptions.service.js  # verify-only (no redesign)
├── services/capabilities.service.js   # verify-only (no redesign)
├── middleware/sse.js            # export closeAll for shutdown
├── middleware/ratelimit.js      # extend coverage (signup/track/upload)
├── utils/errors.js              # existing envelope (verify-only)
├── utils/observe.js             # NEW: tiny JSON log helper (stdlib only)
└── db/pool.js                   # bounded probe helper for startup/readyz
database/migrations/034_order_idempotency.sql  # DROPPED after audit: 019 already provides submission_key + per-business UNIQUE — no new migration ships
tests/
├── order-idempotency.test.js    # NEW: replay/double-submit/concurrency
├── tenant-isolation.test.js     # EXTEND: idempotency-key cross-tenant probe
├── health-readiness.test.js     # NEW: liveness vs readiness incl. DB-down
└── existing 60+ files          # untouched, must keep passing
docs/
├── backups.md                   # NEW (or extend DEPLOYMENT.md): real procedure + rehearsal log
├── scaling.md                   # NEW: A/B/C/D classification + triggers
└── advanced-feature-evidence.md # NEW: Task 18 template + decision record
server.js                        # startup DB probe + SSE-aware shutdown
config/index.js                  # no new secrets; verify classification docs
client/js/restaurant.js          # generate + send idempotency key per checkout intent
```

**Structure Decision**: Single-repo monolith layout retained exactly; one additive migration, two small server deltas (readyz, shutdown), one client one-liner (key generation via `crypto.randomUUID()`), docs-level Task 18 artifacts. No new directories in source.

## Complexity Tracking

> No constitution violations; nothing to justify. This section intentionally left empty.
