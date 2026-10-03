# Data Model: Production Hardening + Demand-Driven Advanced Features

**Feature**: `016-production-hardening-demand-features` | **Date**: 2026-10-03

Source: [spec.md](./spec.md) Key Entities + [research.md](./research.md) R1. Only deltas to the existing schema are listed; everything else is verify-only.

## Delta 1 — `orders.submission_key` (verify-only, no new migration)

**Table**: `orders` (existing; grain: one row per placed order)

> Task 17 audit outcome: the planned new column was NOT needed. Migration
> `019_booking_overlap.sql` already adds nullable `orders.submission_key UUID`
> with per-business `CONSTRAINT orders_submission_key_uniq UNIQUE
> (restaurant_id, submission_key)`. No `034` migration ships.

| Column | Type | Null | Default | Rule |
|--------|------|------|---------|------|
| `submission_key` | `UUID` | YES | `NULL` | Client-generated per checkout intent (`crypto.randomUUID()`); validated as UUID in `validators.validateCheckout`; `NULL` means "no key supplied" (legacy one-row-per-request path; `NULL`s never collide) |

**Dedupe guarantee**: replay lookup `(restaurant_id, submission_key)` runs inside the existing checkout transaction; concurrent replays serialize on the unique index and the loser returns the winner's row (`23505` race branch in `createCheckout`).

**Relationships**: none new — key lives on the order it created; lookup is `(restaurant_id, idempotency_key) → orders.*`, always scoped by the business resolved server-side for the `:slug` (never from client-supplied `business_id`/`restaurant_id`).

## Verify-only entities (no schema change)

- **Tenant boundary** — enforced by `attachUser` + `tenantIdOf` (`server/middleware/auth.js`); restaurant identity from the session user's DB record. Task 17 extends `tenant-isolation.test.js` to probe the idempotent-replay path cross-tenant (B's key against A's slug must not resolve).
- **Subscription state** (`subscriptions` + `restaurants.subscription_ends_at`, six-state machine with live derivation, no scheduler) — verify transitions, grace access, grandfathered `NULL` handling, audit rows; no redesign per R-decision.
- **Capability grant** (central `can()` in `capabilities.service.js`: business type AND plan entitlement AND subscription state AND configuration) — Task 18 routes every candidate through it; no scattered plan checks, no parallel system.
- **Health signals** — no stored data; liveness stays static, readiness is a live pool probe.
- **Operational trace** — stdout JSON lines only (see `contracts/errors.md` envelope + `observe.js`); no new tables, no PII beyond what the order already stores.
- **Feature evidence record** — a docs file (`docs/advanced-feature-evidence.md`), deliberately NOT a database table (no feedback platform per spec).

## Validation rules (at trust boundaries, `server/validators/`)

- Key format enforced before any DB touch; malformed key → 400 validation error, no order created.
- Checkout still re-validates prices, quantities, delivery fee, availability, hours, status, subscription access server-side at submit time — the key affects identity of the request only, never its economics.
- Mass-assignment safety preserved: unknown fields (including any client-sent totals) rejected/ignored as today.
