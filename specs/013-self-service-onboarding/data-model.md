# Data Model: Self-Service Onboarding

**Feature**: `013-self-service-onboarding` | **Date**: 2026-10-02

Conventions: existing tables are reused unchanged unless noted with **NEW**. Money in cents. Tenant scope is always the session's `restaurant_id`; the client never supplies it.

## users (existing — no change)

Restaurant owners are rows with `role='admin'` + `restaurant_id` FK (the codebase's existing "restaurant owner" shape; `owner` means platform owner).

- Relevant columns: `id UUID PK`, `role` (`owner|admin|staff|delivery`), `restaurant_id FK → restaurants CASCADE NULL`, `username TEXT` (unique case-insensitive), `email NULL` (unique case-insensitive where not null), `password_hash` (bcrypt-12, never returned), `is_active BOOL`.
- Rules reused: `validateUsername`, `validatePassword`, `validateEmailOptional`; duplicate email/username rejected; session revocation on deactivate/reset preserved.
- 1:1 guard (application-level, research D8): signup refuses when the request's session user already has `restaurant_id`, or the email/username is taken.

## restaurants (existing + 2 NEW columns)

Existing columns reused: `id UUID PK`, `slug TEXT UNIQUE` (+ format `^[a-z0-9]+(-[a-z0-9]+)*$`, ≤63), `name`, `business_type` (CHECK 9-value set, default `'restaurant'`), `status` (`open|closed|temporarily_closed`), `is_active`, `max_menu_items` (default 30, the platform's existing numeric limit), `subscription_ends_at NULL` (trial clock).

**NEW** (one additive migration, nullable/defaulted so existing rows stay valid):

- `onboarding_status TEXT NOT NULL DEFAULT 'completed'` — `'in_progress' | 'completed'`. Existing and admin-created rows keep `'completed'` (never forced through onboarding).
- `onboarding_step TEXT NOT NULL DEFAULT 'done'` — last completed wizard position, e.g. `'type' | 'info' | 'setup' | 'product' | 'fulfillment' | 'hours' | 'review' | 'done'`. Drives resume ("next incomplete step") and the dashboard continuation banner.

Related rows created with every signup (same transaction as the business, mirroring `createRestaurant`):

- `restaurant_settings(restaurant_id PK FK)` — one row, column defaults (`currency`, `delivery_enabled TRUE`, `delivery_fee_cents`, timezone `UTC`, etc.); wizard fulfillment step updates it via existing `PATCH /api/admin/settings`.
- `restaurant_hours(restaurant_id, day_of_week 0–6)` — exactly 7 rows, defaults `09:00–22:00` open; wizard hours step replaces via existing `PUT /api/admin/hours` (exactly-7-rows validator reused).

Slug rules (existing, reused): `normalizeSlug` + `RESERVED_SLUGS` + length 2–63; collision now resolved with numeric suffix (`slug-2…`) inside the signup transaction, UNIQUE constraint as final arbiter.

Trial default (reused mechanism): `subscription_ends_at = now() + platform_settings.trial_days` (default 7) at signup; enforced by the existing expiry gates. No plan/tier columns — Task 14 owns those.

## categories + menu_items (existing — no change)

First product and optional categories go through the existing tables and `menu.service.createOwned` (category-ownership check, `max_menu_items` → `MENU_LIMIT_REACHED`, auto-position). Image path must satisfy the existing `assertUploadPath` allow-list (`uploaded_files` bytea flow unchanged). `is_preorder` bool + `preorder_note` (≤300) surfaced as optional per business-type profile.

## session (existing — no change)

`connect-pg-simple` `session` table; session holds only `userId`. Signup ends signed-in via the existing regenerate-and-set pattern (same as login).

## Business-type profile (static code, NOT a table)

One object per stored type key in `server/services/business-types.service.js`:

```text
profile = {
  key,                 # one of the 9 CHECK values
  choiceVisible,       # shown at signup (6 named + other-mapped) or hidden synonym
  fallbackFor,         # e.g. 'other' maps to small_food_business
  nameKey, descKey, helpKeys,   # i18n DICT keys (ar + en)
  flow,                # ordered wizard steps for this type (subset/order of the shared steps)
  terminology,         # e.g. productLabel: 'dish' | 'drink' | 'product'
  defaults,            # { fulfillment: pickup|delivery|both, categoriesPolicy, hoursHint }
  relevantCaps[],      # capability keys emphasized for this type
  optionalCaps[],      # capability keys offered but not emphasized
  dashboardEmphasis[]  # tab/module order hints, visibility-only
}
```

Validation: signup `businessType` must be one of the 6 named choices + `other` (mapped server-side to a stored CHECK value); anything else → 400. Stored value always satisfies the DB CHECK.

## Capability matrix (static code, NOT a table)

Entry shape in `server/services/capabilities.service.js`:

```text
capability = {
  key,                 # e.g. 'storefront', 'products', 'preorders', 'delivery', 'advanced_analytics'
  supportedTypes[],    # business-type keys; absent type => unavailable
  recommendedFor[],    # subset where UI emphasizes (vs merely allows)
  configKey|null,      # settings/row flag that must be enabled (e.g. delivery_enabled), else no config gate
  defaultOn,           # default when no config gate applies
  limitKind|null       # null | 'count' (evaluated live, e.g. menu_items used vs max_menu_items)
}
```

Effective rule: `available = typeSupports AND entitlementAllows AND configEnabled`. Today `entitlementAllows` = full-access placeholder gated only by `subscription_ends_at` (active trial); the `plan` field is the literal `'trial-placeholder'` — never a commercial tier name. Numeric limits evaluate live counts; nothing capability-derived is copied onto stored rows.

## Lifecycle / state transitions

```text
signup tx commits
  → restaurants(onboarding_status='in_progress', onboarding_step='info',
                subscription_ends_at=now()+trial_days)
  → step updates advance onboarding_step (type→info→setup→product→fulfillment→hours→review)
  → POST complete (gate: valid name/type/slug + fulfillment choice + 7 hours rows;
                    product count NOT a gate)
      → onboarding_status='completed', onboarding_step='done'
```

- Resume: any `in_progress` row loads its related rows and offers the next incomplete step; `completed` rows never re-enter the wizard.
- Abandonment: `in_progress` rows persist indefinitely (no auto-delete); dashboard shows readiness + next actions.
- Trial expiry (`subscription_ends_at` passing) is orthogonal: it triggers the existing `SUBSCRIPTION_EXPIRED` gates, never flips onboarding state.
- Legacy/admin rows: `onboarding_status='completed'` by default; evaluated capabilities use safe defaults (missing settings ⇒ `defaultOn`).

## What is deliberately NOT modeled

No `plans`, `subscriptions`, `entitlements`, `quotas`, or `business_type_profiles` tables; no payment fields; no per-type schema forks; no draft/onboarding tables. All deferred to Task 14 or rejected by research D1–D12.
