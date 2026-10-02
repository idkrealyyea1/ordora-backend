# Research: Self-Service Onboarding

**Feature**: `013-self-service-onboarding` | **Date**: 2026-10-02

All unknowns below were resolved by direct repository inspection (routes, controllers, services, validators, middleware, migrations, client, tests) plus the spec Clarifications session 2026-10-02. No NEEDS CLARIFICATION remains. Each entry records the decision, why, and what was rejected.

## D1 — Where business-type profiles live

- **Decision**: New static module `server/services/business-types.service.js` holding one profile object per stored type key (display i18n key, description key, recommended flow/terminology, default fulfillment, categories policy, relevant/optional capability keys, dashboard emphasis, checklist, help-text keys, visibility rules). Single authority; no database table.
- **Rationale**: The type set is closed by CHECK `021_business_type.sql` (9 values) and validated by `validators.validateBusinessType`; profiles are read-mostly config. A static module is the smallest change satisfying FR-008/015/016 and keeps `if businessType === ...` out of callers.
- **Alternatives considered**: New `business_type_profiles` table — rejected (needs migrations, admin UI, cache invalidation for static data; violates simplicity); scattering per-type branches — rejected (explicitly forbidden by spec FR-008).

## D2 — Capability evaluation shape

- **Decision**: New `server/services/capabilities.service.js` with a static `CAPABILITIES` matrix (`key`, `supportedTypes[]`, `optionalFor[]`, `configKey|null`, `defaultOn`) plus a pure live evaluator `can(businessRow, key)` = type-support AND entitlement-allowance AND configuration-enabled. Entitlement input today is `{ plan: 'trial-placeholder', subscriptionEndsAt }` (full-access placeholder per clarification); numeric limits read live values (e.g. `menu_items` count vs `max_menu_items`). Enforcement via small `requireCapability(key)` middleware composed after `requireRestaurantAdmin` in the same `middleware/auth.js` file.
- **Rationale**: No plan/subscription/capability tables exist (verified by grep — only `subscription_ends_at`, `trial_days`, `max_menu_items`). Live evaluation means future plan changes take effect with zero stale copies (FR-019); one call point keeps callers ignorant of tables/plan names (FR-017); static matrix + live row = no migration for the matrix itself.
- **Alternatives considered**: `plan_entitlements` DB tables now — rejected (inventing commercial structure the spec forbids; no present beneficiary); copying capabilities onto the business row — rejected (goes stale on plan change); per-route inline plan checks — rejected (unmaintainable, blocks Task 14).

## D3 — Onboarding persistence (no draft tables)

- **Decision**: Two additive nullable columns on `restaurants` — onboarding status + current step (exact names in data-model.md) — with progress data living in the real rows (products in `menu_items`, hours in `restaurant_hours`, toggles in `restaurant_settings`). Resume = read business row + related rows; completion = explicit finish action flipping status.
- **Rationale**: Matches clarified early-creation model (business exists after name+type, steps update it); reuses existing tables as the progress store, so nothing can drift between "draft" and "real"; safe defaults keep existing/admin-created rows working (status defaults to completed/legacy).
- **Alternatives considered**: Separate `business_onboarding` table — rejected (orphan-record risk, joins on every check, more code for the same facts); client-only draft until finish — rejected (breaks resume-after-logout requirement FR-009).

## D4 — Signup atomicity

- **Decision**: Signup runs account creation + `createRestaurant`-shape inserts inside one `withTx` transaction (user row with role `admin` + restaurant + settings + 7 hours + trial default). This tightens the existing admin path's gap (where `users.createAdmin` runs outside the tx) for the self-service path only; the admin path is left untouched.
- **Rationale**: Spec forbids owner-without-business / business-without-ownership states; the tx is the existing codebase's own mechanism (`withTx` + session-row revocation pattern in `users.service.js`).
- **Alternatives considered**: Reusing the admin endpoint as-is — rejected (requires platform-owner session; not public); two-phase create with cleanup job — rejected (no approved cleanup mechanism exists; spec forbids silent deletion).

## D5 — Slug collisions

- **Decision**: Reuse `normalizeSlug` + `RESERVED_SLUGS` + format/length rules in `server/utils/checks.js` unchanged; add a small numeric-suffix loop (`slug`, `slug-2`, `slug-3`…) inside the signup service transaction, backed by the existing `slugExists` check and the UNIQUE constraint as final arbiter. Availability-check endpoint exposes the same logic for live UX.
- **Rationale**: Current behavior is hard 400/409 on collision (`SLUG_TAKEN`), which fails the "offer a free variant" requirement (FR-006); suffixing is the minimal delta reusing every existing rule.
- **Alternatives considered**: Random suffixes — rejected (ugly, unmemorable store addresses); client-side guessing — rejected (race-prone, trusts the client).

## D6 — Trial readiness without billing

- **Decision**: At signup set `restaurants.subscription_ends_at = now() + platform_settings.trial_days` (default 7), reusing `platform.service.js` + `validateTrialWindow` precedent from the leads demo flow (`leads.attachDemo` +7d). Lifecycle state for Task 14 = (`subscription_ends_at`, onboarding status). No payment fields, no provider, no plan names stored.
- **Rationale**: The expiry gate already exists and is enforced in `middleware/auth.js`, `orders.service.js`, and `public.routes.js`; reusing it makes new stores trial-shaped on day one with zero billing code (FR-022).
- **Alternatives considered**: New `subscriptions`/`trials` tables — rejected (full lifecycle belongs to Task 14; premature here); NULL `subscription_ends_at` (never expires) — rejected (incompatible with the intended 7-day commercial model).

## D7 — Owner identity model (no new roles)

- **Decision**: Self-service owners are `users` rows with `role='admin'` + `restaurant_id` FK — the exact role the codebase already means by "restaurant owner". No new role, no schema change to `users`.
- **Rationale**: `attachUser`, `requireRestaurantAdmin`, `tenantId()`, and the whole `/api/admin/*` surface already key off this shape; a new role would fork every authorization check.
- **Alternatives considered**: New `owner` per-business role — rejected (`owner` already means platform owner; collision + migration churn).

## D8 — 1:1 account-to-business enforcement

- **Decision**: Application-level guard in signup: a session whose user already has `restaurant_id` set, or an email already in use (existing unique index), cannot create a second business. No schema change.
- **Rationale**: Clarified 1:1 rule; `users_email_lower_idx` already blocks duplicate emails; the session check blocks logged-in owners from stacking tenants. Keeps resume unambiguous (your business = session tenant).
- **Alternatives considered**: DB-level one-business-per-user constraint — rejected (schema churn on a shared table for an application rule; future multi-business would need revert).

## D9 — Zero-product completion

- **Decision**: Completion requires explicit finish with valid name/type/slug + fulfillment choice + hours present; product count is NOT a gate (clarified). Empty catalogs get a dashboard nudge via the continuation mechanism.
- **Rationale**: Matches clarification B and keeps launch friction lowest for home kitchens; readiness percent weights the remaining steps.
- **Alternatives considered**: Mandating ≥1 product — rejected (contradicts clarification; blocks launch for unready owners).

## D10 — Wizard steps reuse existing endpoints

- **Decision**: Product/hours/fulfillment steps call the existing tenant-scoped endpoints (`POST /api/admin/categories`, `POST /api/admin/menu-items`, `PUT /api/admin/hours`, `PATCH /api/admin/settings`, image upload flow) with the owner's session. Only genuinely new endpoints are signup, slug-availability, onboarding state, and capability/profile reads (see contracts/).
- **Rationale**: Maximal reuse per FR-011/013/014; those endpoints already enforce tenancy, validation, and limits (`MENU_LIMIT_REACHED`, `DELIVERY_UNAVAILABLE`); the wizard is an orchestration layer, not a parallel API.
- **Alternatives considered**: Onboarding-specific product/hours endpoints — rejected (duplicate logic, duplicate auth surface, drift risk).

## D11 — Dashboard personalization is visibility-only

- **Decision**: `admin.js` reads profile + effective capabilities and reorders/emphasizes tabs and shows the continuation banner; no route is removed and every gated operation keeps its server middleware. Admin visibility (type, onboarding state, completeness, effective capabilities) comes from existing owner-listing shapes plus the two new columns.
- **Rationale**: Satisfies FR-024 personalization while honoring "hidden UI is not security" (FR-020/027); no subscription-management UI (belongs to Task 14).
- **Alternatives considered**: Per-type dashboard variants — rejected (forks the UI, violates one-system principle).

## D12 — Observability and limits reuse

- **Decision**: Signup/business-created/type-selected/completed/resumed/failed events go through existing `console.*` server patterns (PII rule: never log bodies) — no new analytics system. Rate limiting reuses `authLimiter` for signup and global limiter elsewhere. The only numeric limit exercised is the existing `max_menu_items`; the limit-evaluation abstraction (D2) covers future quotas without inventing numbers.
- **Rationale**: FR-028/029 require existing patterns only; `notifications.emit` stays order-scoped and is not reused for onboarding events.
- **Alternatives considered**: New analytics tables/events — rejected (heavy system for six log lines).
