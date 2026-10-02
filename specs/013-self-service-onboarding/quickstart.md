# Quickstart: Self-Service Onboarding (validation guide)

**Feature**: `013-self-service-onboarding` | **Date**: 2026-10-02

This guide proves the feature end to end. It contains validation scenarios only — implementation details belong in `tasks.md` and the build phase. All DB-backed checks run on a **disposable** database, never production.

## Prerequisites

1. `TEST_DATABASE_URL` pointing at an empty disposable Postgres (the suite refuses to run without it).
2. Dependencies installed; `npm run check` reports `0 failure(s)`.
3. App boots: homepage `/`, login `/login.html`, new wizard `/signup.html`.

## 1 — Static gates

- `npm run check` → `0 failure(s)` (covers every new/extended JS file).
- New `ar` + `en` DICT keys verified present in `client/js/i18n.js` (wizard, banner, errors); page renders RTL under default `ar` and LTR under `en`.

## 2 — Full journey (bakery, desktop EN)

1. Open `/` → follow Start Free Trial → `/signup.html`.
2. Check `GET /api/signup/slug-availability?name=Layla Bakery` → `available: true`.
3. `POST /api/signup` (type `bakery`, name, credentials) → `201` with `business.slug`, `onboardingStatus: in_progress`, `trialEndsAt ≈ now+7d`; session cookie set.
4. `GET /api/onboarding/state` → step `info`, `next` non-empty.
5. `GET /api/onboarding/profile` → bakery flow/terminology/pre-order emphasis; `GET /api/onboarding/capabilities` → core `true`, limits shape sane.
6. Add category + first product via existing admin endpoints; set fulfillment (`PATCH /api/admin/settings`); set 7 hours rows (`PUT /api/admin/hours`).
7. `POST /api/onboarding/complete` → `200` with `storefrontUrl`, `dashboardUrl`, share + `qrUrl`.
8. As a guest open the storefront URL → product visible; place pickup order → `201`; owner sees it on the dashboard (existing SSE path unchanged).

Expected: storefront orderable, dashboard reachable, `onboardingStatus: completed`.

## 3 — Zero-product finish (home kitchen, mobile AR)

Complete the same flow with type `home_kitchen`, skipping the product step → `POST /api/onboarding/complete` still `200`; dashboard shows the add-products nudge/continuation item. Minimal wording, large touch targets, RTL layout throughout.

## 4 — Resume after interruption

Finish through `fulfillment`, close the browser (drop cookies), sign in via `/login.html` → `GET /api/onboarding/state` returns the saved step with prior data intact; exactly one business exists for the account; completing works with no duplicates.

## 5 — Adversarial / isolation

- Second account + second business: neither reads the other's `/api/onboarding/state`, admin data, or pushes (mirrors `tenant-isolation` patterns).
- Unauthenticated calls to onboarding/capability/admin endpoints → `401`; forged `restaurant_id`/`plan`/`capabilities` in bodies → ignored or rejected.
- Capability-off write (e.g. disable `delivery_enabled`, then call a delivery-gated op directly) → rejected server-side even though the button was hidden.
- Duplicate email signup → safe `409` with no partial rows (re-query: no user, no business).
- Slug collision (`?name=` of an existing store) → `available: false` + working `suggestion`; signup without explicit slug lands on the suggested variant.

## 6 — Regression (existing system untouched)

- `node --test tests/` fully green on the disposable DB (auth, tenant-isolation, subscription-gate, menu/orders journeys, push/notifications suites — none weakened).
- Admin-created businesses: create via `/api/owner/restaurants` as platform owner → works exactly as before, `onboardingStatus: completed` by default, storefront + orders unaffected.
- Pre-existing storefronts/orders/dashboards behave byte-identically (spot-check `/restaurant/:slug`, `/track`, owner panel, QR share).

## 7 — Smoke after every change (per constitution XXVI)

`/` · `/signup.html` · `/restaurant/:slug` · `/track` · login + both dashboards · pricing fetch · robots/sitemap · JSON-vs-HTML 404s — all pass before any deploy claim. No deploy without explicit user approval.
