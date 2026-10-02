# Quickstart: Trial Subscription Lifecycle (validation guide)

**Feature**: `014-trial-subscription-lifecycle` | **Date**: 2026-10-02

Validation scenarios only — implementation details belong in `tasks.md` and the build phase. All DB-backed checks run on a **disposable** database, never production.

## Prerequisites

1. `TEST_DATABASE_URL` pointing at an empty disposable Postgres (suites refuse to run without it).
2. `npm run check` reports `0 failure(s)`.
3. Migrations applied; seeded `standard` plan mirrors the platform price.

## 1 — Static gates

- `npm run check` → `0 failure(s)` (covers every new/extended file).
- New `ar` + `en` DICT keys present (trial/active/grace/expired/cancelled/suspended copy, recovery guidance, suspension notice); page renders RTL/ LTR correctly.

## 2 — Trial journey (self-service bakery)

1. Sign up → business shows `state: trial`, correct plan, `trialEndsAt ≈ now+7d`, days-left copy.
2. Full access during trial: product, hours, checkout `201`, dashboard green.
3. Force end to past (test-only clock travel via SQL): state derives `grace`; ordering still accepted; dashboard shows reminder.
4. Force past grace: state derives `expired`; storefront URL still renders the menu with ordering disabled + plain notice; checkout `403`; tracking of the earlier order still works; dashboard shows status + recovery, mutations `403`; data (menu, orders, settings) intact.

## 3 — Admin activation and renewal

1. As platform admin, `activate` the expired business (plan + period + reason) → full access returns; audit row records actor/before/after/reason.
2. `extend` mid-period → end moves to later-of(now, old end) — no lost days.
3. `suspend` with reason → unavailable notice, ordering blocked, dashboard guidance-only; `reactivate` → full access; each step audited.
4. `cancel` with `period_end` → access continues until then; re-activate before effect → reversal works; `cancel` with `now` → immediate expired-like behavior.
5. Invalid transitions (e.g. extend a `cancelled-effective` record as a trial) → `409 INVALID_TRANSITION`.
6. Owner attempts to call any admin endpoint or forge plan/expiry fields → rejected; cross-tenant admin targets → rejected.

## 4 — Existing-business migration

1. Seed admin-created and Task-13 businesses with orders (one with NULL end, one with a future end, one already past end).
2. Migrate → NULL/future stay fully working under the seeded plan with no end-date surprise; the past-end one keeps exactly its current restricted behavior; each has exactly one subscription row; zero audit rows invented.
3. Historical orders/analytics read identically before and after.

## 5 — Entitlement integration

1. Effective capabilities on trial/active match the seeded plan; `advanced_analytics` stays off (future hook untouched).
2. Plan edit (disable a capability) → affected writes rejected server-side while UI reflects it; re-enable → restored with no stale denial.
3. Numeric limit (`max_menu_items`) enforced at creation (`MENU_LIMIT_REACHED` preserved) and reported honestly in limits output.

## 6 — Regression (existing system untouched)

- `node --test tests/` fully green (auth, tenant-isolation, menu/orders journeys, notifications/push, 013 suites — none weakened).
- Login, both dashboards, pricing fetch, directory, sitemap, QR share, and the 404 HTML-vs-JSON split behave as before except the single clarified expired-storefront change.

## 7 — Smoke after every change (per constitution XXVI)

`/` · `/restaurant/:slug` (active + expired) · `/track` · login + both dashboards · pricing fetch · robots/sitemap · JSON-vs-HTML 404s — all pass before any deploy claim. No deploy without explicit user approval.
