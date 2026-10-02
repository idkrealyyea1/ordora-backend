# Data Model: Trial Subscription Lifecycle

**Feature**: `014-trial-subscription-lifecycle` | **Date**: 2026-10-02

Conventions: money in integer cents; timestamps absolute server instants (`TIMESTAMPTZ`); `== end instant` counts as expired (existing boundary preserved); tenant scope always from the session.

## plans (NEW table)

Data-driven commercial packages. Exactly one row is seeded (`standard`).

- Columns: `id UUID PK`, `key TEXT UNIQUE` (stable code, e.g. `standard`), `name TEXT`, `description TEXT DEFAULT ''`, `is_active BOOL DEFAULT TRUE`, `price_cents INT >= 0` (from `platform_settings.pricing_cents` at seed), `currency CHAR(3)` (from `platform_settings.pricing_currency`), `period TEXT CHECK(month|year)`, `trial_eligible BOOL DEFAULT TRUE`, `created_at/updated_at`.
- Rules: inactive plans stay assignable-history-safe (existing assignments keep resolving; new assignments prefer active ones); keys immutable after seed; prices never duplicated into frontend code (public page keeps reading `GET /api/pricing`).

## plan_entitlements (NEW table, single mapping for booleans + limits)

- Columns: `plan_id FK → plans CASCADE`, `capability_key TEXT` (vocabulary owned by the capability matrix), `allowed BOOL DEFAULT TRUE`, `limit_value INT NULL` (only for limit-kind keys such as `max_menu_items`), `PK(plan_id, capability_key)`.
- Rules: unknown keys rejected at write time against the matrix vocabulary; boolean rows use `allowed`, limit rows use `limit_value`; seed grants every currently default-on capability and the existing `max_menu_items` semantics.

## subscriptions (NEW table, one row per business)

- Columns: `id UUID PK`, `restaurant_id FK → restaurants UNIQUE` (one authoritative record; also the duplicate-trial prevention), `plan_id FK → plans RESTRICT` (history-safe: a plan with subscribers cannot be deleted), `status TEXT CHECK(trial|active|grace|expired|cancelled|suspended)`, `trial_started_at TIMESTAMPTZ NULL`, `current_period_start TIMESTAMPTZ NOT NULL`, `current_period_end TIMESTAMPTZ NULL` (NULL = no end date, i.e. grandfathered/active-forever), `grace_until TIMESTAMPTZ NULL` (= end + 7 days when applicable), `cancelled_at TIMESTAMPTZ NULL`, `cancel_effective_at TIMESTAMPTZ NULL`, `suspended_at TIMESTAMPTZ NULL`, `suspend_reason TEXT DEFAULT ''`, `created_at/updated_at`.
- Kept in sync in-transaction: `restaurants.subscription_ends_at` mirrors the effective access end (trial end or period end) so all eight existing gates keep working unchanged.
- Rules: transition table enforced in the service (trial→active/grace/expired; active→grace/expired/cancelled/suspended; grace→active/expired; cancelled→active on reassign; suspended→active; anything else rejected); extension sets end to later-of(now, current end) — never steals paid days; end-of-period cancel writes `cancel_effective_at` and flips status only when it arrives (derived at read); immediate cancel flips at once with an audit reason.

## Effective state derivation (read-time, no scheduler)

```text
stored suspended            → suspended
stored cancelled AND (no future effective OR now >= cancel_effective_at) → cancelled
stored cancelled AND now < cancel_effective_at → active (paid-through)
now <= current_period_end (or end IS NULL) → stored trial|active
current_period_end < now <= grace_until → grace
now > grace_until (or no grace window) → expired
```

- Stored `trial`/`active` are starting points, not timers; derivation decides what each surface enforces. The `grace` and `expired` stored values are written opportunistically (admin views, transitions) but never required for correctness.

## subscription_events (NEW audit table)

- Columns: `id UUID PK`, `restaurant_id FK → restaurants CASCADE`, `actor_user_id FK → users NULL` (null = system/migration, never a customer), `action TEXT` (e.g. `trial_started`, `activated`, `extended`, `cancelled`, `suspended`, `reactivated`, `plan_assigned`, `trial_extended`), `old_status/new_status TEXT NULL`, `old_plan_key/new_plan_key TEXT NULL`, `old_ends_at/new_ends_at TIMESTAMPTZ NULL`, `reason TEXT DEFAULT ''`, `created_at`.
- Rules: every admin mutation writes exactly one row in the same transaction; no event is ever updated or deleted.

## Per-surface access (derived state → behavior)

```text
trial / active:      everything works (storefront, ordering, tracking, dashboard, management)
grace:               storefront visible, ordering accepted with a plain renewal reminder to the owner;
                     dashboard fully reachable; management works (recovery-first)
expired:             storefront visible with ordering disabled + simple notice (clarified);
                     tracking of past orders works; dashboard reachable in read/restricted mode
                     with status + recovery guidance; management mutations blocked
cancelled:           like expired once effective; before effective date, like active
suspended:           storefront shows the controlled unavailable notice, ordering blocked;
                     dashboard restricted to status + contact guidance; nothing deleted
```

- Owner dashboard reads stay available in every state (existing GET-readable convention extended); mutations follow the matrix above. Platform admin surfaces ignore subscription state entirely (operators must always reach the business).

## Migration / backfill (safe by construction)

- Existing `restaurants` rows: `subscription_ends_at` untouched (NULL stays active-forever = clarified grandfather default; past values keep their current meaning).
- One `subscriptions` row per existing business: `plan_id` = seeded plan, `status` = neutral `active`, `current_period_start` = business creation, `current_period_end` = existing `subscription_ends_at` (NULL stays NULL), `grace_until` = end + 7 days where an end exists, no audit rows for history not performed.
- New self-service signups: subscription row created in the same `withTx` as account + tenant (trial state, plan link, trial start/end = computed end), preserving the no-orphan guarantee.

## What is deliberately NOT modeled

No invoices, taxes, coupons, proration, dunning, payment-method vaults, webhook endpoints, multi-currency conversion, or usage metering. No `suspended` reason taxonomy beyond a free-text note. No per-seat/per-location quotas (no such functionality exists to limit).
