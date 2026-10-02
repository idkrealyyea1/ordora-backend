# Research: Trial Subscription Lifecycle

**Feature**: `014-trial-subscription-lifecycle` | **Date**: 2026-10-02

Resolved by direct inspection of expiry gates, pricing, owner panel, demo/signup trials, capability enforcement, and audit options, plus the spec Clarifications session. No NEEDS CLARIFICATION remains.

## D1 — No scheduler: effective state derives at read time

- **Decision**: There is no cron, worker, queue, or polling infrastructure anywhere in the codebase. Trial/active/grace/expired resolve from `(stored status, period end, grace until, server now)` on every read; `suspended`/`cancelled` are stored overrides. Nothing ever "transitions" a row in the background.
- **Rationale**: Adding a scheduler would be new infrastructure for a problem pure functions solve; the existing gates already compare instants per request (`getSubscription()`, `requireRestaurantAdmin`, checkout pre-checks).
- **Alternatives considered**: Expiry worker/cron — rejected (new infra, deployment contract change, race with reads); stored-only status flipped by login hooks — rejected (stale for never-logging-in businesses, public surfaces would lie).

## D2 — Keep `subscription_ends_at` as the access clock

- **Decision**: The existing `restaurants.subscription_ends_at` (NULL/future = access) remains the single clock every current gate reads. The new `subscriptions` row carries state and period metadata; the two are written together in the same transaction, and reads join them once per request.
- **Rationale**: Eight existing enforcement points already key off this column with the `== instant counts as expired` boundary; replacing it would touch login, middleware, ordering, bookings, storefront, directory, sitemap, and capabilities for zero behavioral gain.
- **Alternatives considered**: New clock column owned by subscriptions only — rejected (parallel clocks drift; double the gate edits).

## D3 — One mapping table, not two

- **Decision**: A single `plan_entitlements(plan_id, capability_key, allowed, limit_value NULL)` table covers booleans (`allowed`) and numeric limits (`limit_value`, e.g. `max_menu_items`) instead of separate entitlement + limit tables.
- **Rationale**: One join serves `can()` and limit checks; the codebase favors small normalized tables and this halves the migration surface.
- **Alternatives considered**: JSONB entitlements on `plans` — rejected (unqueryable, unvalidatable at the DB level, foreign to project style); two tables — rejected (twice the code for one join).

## D4 — Clarified expired storefront: visible menu, ordering disabled

- **Decision**: `getPublicView()` stops returning `null` for expired businesses and instead returns the view with an `orderingBlocked` signal; the checkout/bookings 403s stay exactly as they are; the public directory and sitemap keep excluding expired stores (they advertise, the direct link serves).
- **Rationale**: Clarified 2026-10-02 (Option A). Tracking (`getByCode`/`cancelByCustomer`) already ignores subscription state, so coherence is free.
- **Alternatives considered**: Keep 404 — rejected (contradicts the clarification); full-access expired — rejected (no commercial teeth).

## D5 — One seeded plan from the existing price

- **Decision**: Seed exactly one plan (`standard`) from `platform_settings` (`pricing_cents` 1999, USD, monthly, trial-eligible), granting every capability the matrix currently defaults on plus the existing `max_menu_items` semantics. The public pricing page and owner pricing card are untouched.
- **Rationale**: Spec demands one paid plan + trial association while preserving the repository's intended price; inventing tiers would violate the no-speculation rule.
- **Alternatives considered**: Multiple tiers now — rejected (no beneficiary); hardcoded plan constants — rejected (spec requires data-driven).

## D6 — Grandfathering is a non-event by construction

- **Decision**: Existing rows keep their `subscription_ends_at` untouched (NULL = active forever, matching clarified "no end date"); the backfill attaches each to the seeded plan with a neutral state and writes no audit rows for history it did not perform. No existing business can change access on migration day by construction, not by careful scripting.
- **Rationale**: The current NULL/future rule already implements the clarified default; the migration only adds attribution, never behavior.
- **Alternatives considered**: Time-boxed transition periods — rejected (creates deadlines the spec forbids); fresh trials for incumbents — rejected (contradicts the clarification).

## D7 — Trial attaches inside the existing signup transaction

- **Decision**: `signup.service.js` already computes `trialEndsAt` from `platform_settings.trial_days` in its `withTx`; Task 14 adds the subscription row (trial state, plan link, one-trial-per-business by UNIQUE) to that same transaction. Demo/lead creation reuses the same service path instead of its current hardcoded `+7d`.
- **Rationale**: The identity-before-subscription rule and atomicity requirement are satisfied by the transaction that already exists; one-trial-per-business falls out of one-row-per-business.
- **Alternatives considered**: Post-signup trial endpoint — rejected (orphan window, duplicate-claim race).

## D8 — Admin surface extends the owner panel, nothing new

- **Decision**: Owner listing gains subscription columns; six thin admin endpoints (view, assign/activate, extend, suspend/reactivate, cancel, plans list/get) land in the existing `owner.routes.js`/`owner.controller.js` behind the existing platform role; the dashboard card gains state/grace/plan copy via existing DICT keys.
- **Rationale**: The panel, role checks, CSV/report patterns, and pricing card already exist; a billing console would be speculation.
- **Alternatives considered**: Separate billing admin pages — rejected (unrequested surface, double authZ).

## D9 — Audit is one narrow table

- **Decision**: New `subscription_events` table (business, actor, action, old/new state and plan, old/new expiration, reason, timestamp). Nothing existing fits: `notification_events` is order-scoped with a UNIQUE event key, `pipeline_history` is lead-scoped JSON, and console logs are explicitly non-audit.
- **Rationale**: Commercially sensitive changes need actor + before/after; this is the minimum schema that records it.
- **Alternatives considered**: Reusing notification_events — rejected (wrong grain, unique-key collision); console-only — rejected (unqueryable, no actor linkage).

## D10 — Capabilities consume plans; gates keep their shape

- **Decision**: `can()`/`effectiveFor()` take plan entitlements as an additional input (plan allows AND type supports AND config enables AND state grants access); `requireCapability`, `requireRestaurantAdmin`, and all checkout guards keep their signatures and positions — they just read the joined row from D2.
- **Rationale**: The "can this business perform X" contract is preserved; Task 14 changes what feeds it, not how callers ask. The `advanced_analytics` empty-support hook becomes the first real plan-differentiated capability candidate without any code change.
- **Alternatives considered**: Parallel plan-check middleware — rejected (second source of truth, bypass surface); rewriting gates around subscription status — rejected (churn across eight points).
