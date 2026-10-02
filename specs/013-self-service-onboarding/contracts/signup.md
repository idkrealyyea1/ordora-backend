# Contract: Public Signup

**Base**: same origin as the app. **Envelope**: success = resource JSON; errors = `{ error: { code, message, details? } }` (existing `utils/errors.js` shape; prod hides internals). **Guards**: `authLimiter` + `originGuard` on all mutating calls. No authenticated session required (public); if a logged-in owner session with `restaurant_id` calls signup → `403 BUSINESS_ALREADY_EXISTS`.

## POST /api/signup — create account + business (atomic)

Creates one `admin`-role user and one tenant business in a single transaction, seeds settings + 7 hours rows, sets `subscription_ends_at = now() + trial_days`, marks onboarding `in_progress`, signs the owner in via the existing session mechanism (regenerate + set, same cookie contract as login).

Request:

```json
{
  "email": "owner@example.com",
  "username": "laylskitchen",
  "password": "••••••••",
  "businessName": "Layla's Kitchen",
  "businessType": "home_kitchen | restaurant | cafe | bakery | dessert_shop | cake_business | cloud_kitchen | other",
  "slug": "optional-custom-slug"
}
```

- `businessType`: the 6 named choices plus `other` (server-mapped to a stored CHECK value); raw stored CHECK values outside the signup set are rejected here.
- `slug` optional: when omitted it is derived from `businessName` via `normalizeSlug`; collisions resolve with a numeric suffix and the final slug is returned.

Success `201`:

```json
{
  "user": { "id": "uuid", "username": "laylskitchen", "role": "admin" },
  "business": { "id": "uuid", "name": "Layla's Kitchen", "slug": "layla-s-kitchen", "businessType": "home_kitchen", "onboardingStatus": "in_progress", "onboardingStep": "info" },
  "trialEndsAt": "2026-10-09T00:00:00.000Z"
}
```

Errors: `400 INVALID_*` (validation, bad type, reserved slug, weak password) · `409 DUPLICATE` (email/username taken; safe non-enumerating message) · `409 SLUG_TAKEN` only when even suffixed variants exhaust (returns a `suggestion`) · `403 BUSINESS_ALREADY_EXISTS` (session already owns a business) · `429 RATE_LIMITED` · `500` safe envelope on DB failure (no partial rows — transaction rolled back).

Notes: `password_hash` never returned. Client-supplied `plan`, `capabilities`, `owner_id`, `restaurant_id` fields are rejected, not read.

## GET /api/signup/slug-availability — live slug check

Query: `?slug=laila-kitchen` or `?name=Laila Kitchen` (name is normalized server-side with the same rules).

Success `200`:

```json
{ "slug": "laila-kitchen", "available": true, "suggestion": null }
```

When taken/reserved: `{ "slug": "x", "available": false, "suggestion": "x-2" }` (`suggestion: null` when the value itself is invalid/reserved). Public, rate-limited; same normalization, reserved list, and format rules as signup.
