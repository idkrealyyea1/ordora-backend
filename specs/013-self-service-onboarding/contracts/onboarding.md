# Contract: Onboarding State & Progress

**Auth**: all endpoints require a signed-in session (`requireAuth`); the tenant is derived **only** from `req.user.restaurant_id` (never from params/query/body). Guards: `originGuard` on mutating calls; existing global limiter.

## GET /api/onboarding/state — resume snapshot

Returns the persisted wizard position plus what is already configured (read from the real rows), so any device/session can resume.

Success `200`:

```json
{
  "business": { "id": "uuid", "name": "…", "slug": "…", "businessType": "bakery" },
  "onboardingStatus": "in_progress",
  "onboardingStep": "fulfillment",
  "completeness": 62,
  "next": ["fulfillment", "hours", "review"],
  "configured": { "hasProduct": false, "fulfillmentSet": true, "hoursSet": false },
  "storefrontUrl": "/restaurant/<slug>"
}
```

- `completeness`: 0–100 weighting of the shared steps (product step counts full marks when skipped-by-choice only after its screen is seen; see complete gate below).
- `completed` businesses return the same shape with `onboardingStatus: "completed"`, `onboardingStep: "done"`, `next: []`.

Errors: `401` unauthenticated · `404 NO_BUSINESS` (session has no tenant — e.g. platform owner).

## PUT /api/onboarding/state — advance/record step

Body: `{ "step": "setup | product | fulfillment | hours | review" }`. Records the last seen/completed step; idempotent. Step content itself is saved through the existing tenant endpoints (menu-items, hours, settings), not here.

Success `200`: the same snapshot shape as GET. Errors: `400 INVALID_STEP` (unknown value or jumping past `review` before `complete`) · `401` · `404 NO_BUSINESS`.

## POST /api/onboarding/complete — finish and publish

Gate (server-checked): valid name/type/slug + a fulfillment choice recorded + exactly 7 hours rows present. Product count is NOT a gate (clarified). On success flips `onboarding_status='completed'`, `onboarding_step='done'`.

Success `200`:

```json
{
  "onboardingStatus": "completed",
  "storefrontUrl": "/restaurant/<slug>",
  "dashboardUrl": "/admin.html",
  "share": { "url": "<absolute store url>", "qrUrl": "/api/admin/qr" }
}
```

Errors: `409 INCOMPLETE_SETUP` with `details.missing[]` (e.g. `["hours"]`) · `401` · `404 NO_BUSINESS`. Completing twice is idempotent (returns the success shape).

## Wizard reuse note (not new contracts)

Step payloads flow through existing tenant endpoints unchanged: `POST /api/admin/categories`, `POST /api/admin/menu-items` (+ image upload flow), `PUT /api/admin/hours`, `PATCH /api/admin/settings`. Those keep their current validators, tenancy, limits (`MENU_LIMIT_REACHED`, `DELIVERY_UNAVAILABLE`), and error codes.
