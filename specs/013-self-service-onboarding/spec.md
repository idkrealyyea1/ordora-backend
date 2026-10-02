# Feature Specification: Self-Service Onboarding

**Feature Branch**: `013-self-service-onboarding`

**Created**: 2026-10-02

**Status**: Draft

**Input**: User description: "Create a complete feature specification for SELF-SERVICE SAAS ONBOARDING, BUSINESS TYPE PERSONALIZATION, CAPABILITY ENTITLEMENTS, AND STORE CREATION — public homepage to Start Free Trial to account creation to business-type choice to business-type-aware setup to first product to fulfillment to hours to review to published store to owner dashboard, on the existing multi-tenant platform with existing business_type foundation, common core + business-type profile + capability/entitlement + per-type defaults, trial/plan-ready without billing, resumable onboarding, dashboard personalization with server-side enforcement, Arabic/English mobile-first, no online customer payments, no Agent Reach, no React, no duplicate systems."

## Clarifications

### Session 2026-10-02

- Q: When during the wizard should the real tenant business record be created — right after the owner submits the business name and type, or only once at the final review step? → A: Create the business right after name + type are valid, then update it step by step (resumable draft state)
- Q: Can one owner account create and own multiple food businesses through this onboarding, or is it strictly one account to one business? → A: One account owns exactly one business; a second store needs a second account
- Q: Must the owner add at least one product to finish onboarding, or can they finish with zero products and add them later? → A: Finishing with zero products is allowed; dashboard nudges to add them
- Q: Which business-type choices must the onboarding offer on day one? → A: Six named types (restaurant, cafe, bakery, dessert/cake, home kitchen, cloud kitchen) plus an "other" fallback
- Q: What capabilities does a newly created business get before future subscription work lands? → A: Full access to everything the platform already offers; future plans restrict later

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Visitor creates an account and publishes a store (Priority: P1) 🎯 MVP

A person who has never used the platform visits the public homepage, chooses "Start Free Trial", creates an owner account with an email and password, enters a business name, gets a working storefront address, adds a first product, picks how customers can order (pickup / delivery as supported), sets opening hours, reviews, and finishes. The result is a real tenant business they own: the storefront opens for customers and the dashboard opens for the owner.

**Why this priority**: This is the entire business goal — self-service store creation without an administrator. Without it nothing else matters.

**Independent Test**: From a clean browser, complete the full wizard for a restaurant, then open the storefront link as a guest and open the dashboard as the owner; both work and the owner-business link is correct.

**Acceptance Scenarios**:

1. **Given** a new visitor on the public homepage, **When** they start onboarding and create an account with valid details, **Then** an owner account is created, they are signed in, and they can continue to business setup without admin help.
2. **Given** a signed-in new owner, **When** they submit a business name and choose a supported business type, **Then** a real tenant business is created with that type persisted and a unique storefront address assigned.
3. **Given** a new business in onboarding, **When** the owner adds a first product, configures supported fulfillment, and sets hours, **Then** the storefront shows the product and the ordering/availability behavior reflects that configuration.
4. **Given** completed setup, **When** the owner finishes, **Then** a success state shows working "open store", "go to dashboard", and "share store" actions, and onboarding is marked complete.

---

### User Story 2 - Onboarding adapts to the business type (Priority: P1)

An owner picks what kind of food business they run (restaurant, cafe, bakery, dessert/cake, home kitchen, cloud kitchen, or other supported type). The setup wording, defaults, recommended steps, and emphasis change to fit that type — e.g. bakery surfaces pre-order guidance, cloud kitchen emphasizes delivery/operations, home kitchen stays minimal — while the underlying platform stays shared.

**Why this priority**: Without differentiation every business gets an identical generic flow, which the product principle forbids; without a shared core plus profiles, the platform forks into unmaintainable copies.

**Independent Test**: Run onboarding for two different business types (e.g. bakery vs home kitchen) and compare: terminology, defaults, and recommended steps differ meaningfully, yet products, orders, storefront, and dashboard remain the same shared system.

**Acceptance Scenarios**:

1. **Given** an owner choosing a business type, **When** they view the type list, **Then** each type shows a plain-language name and description that a nontechnical owner understands.
2. **Given** a selected business type, **When** the owner proceeds through setup steps, **Then** wording, defaults (fulfillment, categories where offered, hours guidance), and recommended optional features reflect that type's profile.
3. **Given** any business type, **When** setup completes, **Then** the business works with the same shared ordering, storefront, and dashboard foundations — no type has a separate incompatible data model.

---

### User Story 3 - Owner resumes interrupted onboarding (Priority: P2)

An owner creates an account and a business but leaves halfway (closes browser, logs out, connection drops). When they return and sign in, they land back where they left off with prior entries preserved, see what percent is ready and what remains, and can finish without data corruption or duplicate businesses.

**Why this priority**: Real users interrupt setup; losing progress creates orphan/duplicate tenants and kills conversion.

**Independent Test**: Start onboarding, complete two steps, close the browser, sign back in, and continue to completion with no re-entry of saved data and no second business created.

**Acceptance Scenarios**:

1. **Given** a partially onboarded business, **When** the owner returns, **Then** progress (completed steps, entered data) is restored and the next incomplete step is offered.
2. **Given** an incomplete business, **When** the owner opens the dashboard, **Then** a clear continuation state (e.g. readiness percent plus next actions) is shown instead of a broken or empty dashboard.
3. **Given** an abandoned setup, **When** time passes, **Then** the business is NOT silently deleted and remains resumable under the existing data lifecycle.

---

### User Story 4 - Features are gated by capability, enforced server-side (Priority: P2)

An owner only sees and can only use features their business type supports, their configuration enables, and their entitlement allows. Hiding a button is never the only protection: calling the underlying operation directly without the capability is refused. Future plans can change what is allowed without rewriting each feature.

**Why this priority**: Visibility without enforcement is a security hole; hard-coded plan checks everywhere make future subscriptions impossible.

**Independent Test**: As a business lacking a capability, confirm the UI hides/disables it AND a direct request to the underlying operation is rejected; then grant the capability and confirm the same operation succeeds.

**Acceptance Scenarios**:

1. **Given** a business whose type does not support or whose entitlement does not allow a feature, **When** the owner views the dashboard/onboarding, **Then** the feature is hidden or clearly disabled with plain guidance.
2. **Given** the same business, **When** the owner attempts the operation directly (bypassing the UI), **Then** the request is rejected and no data changes.
3. **Given** a capability granted through type plus entitlement plus configuration, **When** the owner uses it, **Then** it works normally.
4. **Given** a future entitlement change (e.g. trial state or plan change), **When** capabilities are re-evaluated, **Then** access changes without stale copied permissions and without code changes per feature.

---

### User Story 5 - Owner manages their store after launch in their language on mobile (Priority: P3)

After launch, the owner continues configuring the store from the dashboard, which emphasizes the modules relevant to their business type without overwhelming them. The whole journey works on a small phone, in Arabic (RTL) or English (LTR), with keyboard navigation, labels, and clear errors.

**Why this priority**: Launch is day one; daily usability, language, and mobile access determine whether nontechnical owners succeed.

**Independent Test**: Complete onboarding on a narrow mobile viewport in Arabic, then switch to English and continue managing products/hours from the dashboard using keyboard plus touch.

**Acceptance Scenarios**:

1. **Given** a completed business, **When** the owner opens the dashboard, **Then** navigation emphasizes modules relevant to their type and configuration (e.g. operations for cloud kitchen, simple catalog for home kitchen) while all authorized routes remain server-protected.
2. **Given** Arabic selected, **When** the owner goes through onboarding and dashboard, **Then** layout is RTL with natural wording; in English it is LTR; no technical internals (tenant/plan/capability jargon) are shown.
3. **Given** a mobile device with a slow connection, **When** the owner onboards, **Then** steps load quickly, touch targets are usable, validation messages are clear, and image upload failures are explained without data loss.

---

### Edge Cases

- Duplicate email on signup: rejected with a safe, non-enumerating message; no partial account left behind.
- Invalid or reserved storefront address (collision, reserved route word, invalid characters): normalized, checked, and a free variant offered; internal IDs never exposed as public identifiers unless the existing architecture requires it.
- Unsupported or tampered business type sent by the client: rejected server-side; onboarding cannot proceed with it.
- Product validation failure (missing name, bad price, bad image): step shows field-level errors; nothing half-saved corrupts the catalog.
- Fulfillment misconfiguration (e.g. delivery enabled where the platform cannot support it for that business): rejected with guidance; existing ordering model unchanged.
- Invalid hours (closing before opening, malformed time, empty week): rejected with guidance; existing hours system remains the authority.
- Session expiry mid-wizard: progress preserved; re-authentication resumes cleanly.
- Database failure mid-creation: initial account + business creation is atomic (no orphan owner-without-business or business-without-ownership); later step updates save incrementally so resume never loses completed steps (clarified 2026-10-02).
- Existing businesses (older types, missing onboarding state, older settings): continue working untouched; safe defaults apply; re-onboarding is never forced.
- Platform-admin-created businesses: continue working identically to self-service ones at the data level.
- Client attempts to claim a plan, entitlement, capability, owner id, or tenant id: ignored; the server derives identity and entitlement from the session and stored records.
- Trial-expiry-shaped states (future): onboarding architecture carries a lifecycle state the future subscription work can attach trial/plan/expiry to without rewriting onboarding.

## Requirements *(mandatory)*

### Functional Requirements

**Self-service account**

- **FR-001**: Visitors MUST be able to create an owner account through the public flow using the existing authentication and session mechanisms, with server-side validation, secure password handling, duplicate-account handling, and clear errors.
- **FR-002**: Authentication state after signup MUST sign the owner in safely under the existing session, CSRF/origin, and security protections; no second auth system may be created and existing protections MUST NOT be weakened.

**Business creation**

- **FR-003**: The system MUST create a real tenant business immediately after business name + type validate (clarified 2026-10-02), using the existing business model, owner/admin relationship, settings/hours records, and tenant-isolation rules; later wizard steps update that business; the client MUST NOT choose tenant ids, owner ids, plans, or capabilities.
- **FR-004**: The selected supported business type MUST be validated server-side against the existing business-type foundation and persisted on the business; day-one choices are six named types plus an "other" fallback (clarified 2026-10-02); unsupported or tampered values MUST be rejected.
- **FR-005**: The existing platform-admin creation path MUST keep working and MUST produce data-compatible businesses with the self-service path (same model, type handling, storefront, products, orders, dashboard, capabilities).

**Storefront address**

- **FR-006**: The system MUST derive a normalized, unique, URL-safe storefront slug from the business name (reusing the existing slug utility where one exists), handle collisions, reject invalid/reserved slugs, and never expose internal ids publicly unless the existing architecture requires it.

**Onboarding flow**

- **FR-007**: The system MUST provide a progressive wizard (type → business info → type-specific setup → first product → fulfillment → hours → review → finish) where each step answers one question, shows position/remaining/optional status, and skips unnecessary settings.
- **FR-008**: Wizard content, defaults, terminology, recommended categories (only where safe and deletable-free), and help text MUST be driven by a centralized business-type profile, NOT by scattered per-type conditionals across the codebase.
- **FR-009**: Onboarding progress and state (account created, business created, started, partially configured, completed) MUST be persisted so the owner can resume after logout, browser close, or failure; partial states MUST be safe and MUST NOT auto-delete the business.
- **FR-010**: The dashboard MUST show a continuation state for incomplete businesses (readiness plus next actions) and a success state on completion (open store, dashboard, share, QR where QR already exists).

**First product, categories, fulfillment, hours**

- **FR-011**: First-product creation MUST reuse the existing product model, validation, and creation path (name, price, category, image, availability at minimum) with no duplicated product logic; adding a product during onboarding is optional (clarified 2026-10-02: zero products allowed, dashboard nudges afterward); type-relevant options (e.g. pre-order) MUST be surfaced as optional/recommended, never forced.
- **FR-012**: Category handling during onboarding MUST stay minimal: no forced complex menu trees and no fake seed categories the owner must delete; defaults offered only where safe.
- **FR-013**: Fulfillment setup MUST reuse the existing pickup/delivery ordering concepts with per-type defaults but owner-overridable configuration; no customer online-payment gateway may be introduced.
- **FR-014**: Hours setup MUST reuse the existing hours system (open/close times, closed days, open/closed state) with no duplicated hours logic.

**Business-type profiles**

- **FR-015**: The system MUST provide a centralized, extensible business-type profile definition covering display name, key, description, visual identifier where appropriate, recommended flow, product terminology, default settings, default fulfillment, default categories policy, relevant/optional capabilities, dashboard module emphasis, setup checklist, help text, feature-visibility rules, and storefront behavior notes.
- **FR-016**: Adding a future business type MUST require configuration plus targeted work only, not a platform rewrite; business-type differences MUST be meaningful but MUST NOT create feature silos or fake functionality.

**Capability / entitlement model**

- **FR-017**: The system MUST evaluate feature availability as the combination of (a) business-type support, (b) entitlement/plan allowance, and (c) business configuration — through one authoritative capability evaluation point (e.g. "can this business use feature X") so callers never inspect subscription tables, plan names, or type strings directly.
- **FR-018**: The model MUST support both boolean capabilities (enabled/disabled) and numeric limits/quotas (e.g. whether another product may be created) in the same abstraction, without hard-coding commercial numbers, prices, tiers, or providers in this feature.
- **FR-019**: Plan/entitlement data MUST be evaluated live (not permanently copied into business records in a stale way) so future trial→paid, plan-change, expiry, and cancellation flows (separate future work) take effect without rewriting features.
- **FR-020**: Every capability-gated operation MUST be enforced server-side in addition to UI hiding/disabling; hidden UI MUST NOT be treated as protection and MUST NOT permanently block access to data or routes beyond authorization.
- **FR-021**: A centralized capability matrix MUST record, per feature, supported business types, recommended/optional status, entitlement requirement placeholder, and default state; it MUST be the single authority consumed by onboarding, dashboard, and server checks where practical.

**Trial / plan readiness (no billing in this feature)**

- **FR-022**: Every new business MUST carry a lifecycle state that future trial/subscription work can attach trial-start/end, plan, subscription state, and expiry behavior to; this feature MUST NOT implement payment processing, billing flows, or payment-method collection.
- **FR-023**: No final commercial plans, prices, tiers, or provider choices may be hard-coded; until future subscription work lands, the placeholder entitlement grants full access to everything the platform already offers (clarified 2026-10-02); the abstraction MUST let future plans define enabled capabilities, limits, and quotas.

**Dashboard personalization**

- **FR-024**: Dashboard navigation and module visibility MUST consider business type, effective capability, configuration state, and (future) entitlement, emphasizing relevant modules per type while keeping server-side authorization on every route.

**Existing-business compatibility**

- **FR-025**: Existing and admin-created businesses, storefronts, and order flows MUST continue working unchanged; businesses missing new onboarding/capability metadata MUST receive safe backward-compatible defaults with no forced re-onboarding.

**Admin visibility**

- **FR-026**: Platform administrators MUST be able to see business type, onboarding state, setup completeness, and effective capabilities/limits using only the minimum fields needed for this feature; no full subscription-management UI may be built here.

**Security**

- **FR-027**: Tenant isolation, owner authorization, server-side validation, session/CSRF/origin/rate-limit protections, password hashing, safe slug handling, mass-assignment safety, and safe error envelopes MUST be preserved; cross-tenant access MUST be impossible and client-supplied identity/entitlement claims MUST be ignored.

**Observability and API hygiene**

- **FR-028**: Key onboarding events (signup started, account created, business created, type selected, completed, resumed, abandoned, failed) MUST be observable through existing logging/monitoring patterns with no new heavy analytics system.
- **FR-029**: Any new endpoints MUST follow existing API patterns: authenticated/authorized where required, tenant-isolated, capability-checked, input-validated, with safe errors and no unnecessary exposure of entitlement internals.

**UX / language / accessibility / performance**

- **FR-030**: Onboarding and dashboard copy MUST use plain nontechnical language, short steps, minimal fields, mobile-first layout, large touch targets, and no jargon; it MUST work in Arabic (RTL) and English (LTR) through the existing language architecture in an extendable way, meeting basic accessibility (labels, focus, keyboard, semantic controls, non-color-only status).
- **FR-031**: Onboarding MUST stay lightweight and fast on weak devices/networks: no loading the full dashboard during onboarding, no huge bundles, no repeated queries or irrelevant data fetches.

### Key Entities

- **Owner account**: the self-service-created user who owns exactly one business (clarified 2026-10-02: one account to one business; a second store needs a second account); linked to the new tenant as owner/admin via the existing relationship.
- **Business (tenant)**: the real food-business record carrying name, persisted business type, unique storefront slug, settings, hours, fulfillment config, and onboarding state; behaves identically whether self-service- or admin-created.
- **Business-type profile**: centralized configuration per type (display name, key, description, recommended flow, terminology, defaults, relevant/optional capabilities, dashboard emphasis, checklist, help text, visibility rules).
- **Capability**: a named feature or limit evaluated as type-support AND entitlement-allowance AND configuration; boolean or numeric; single evaluation point, single matrix authority.
- **Entitlement context (placeholder)**: the future plan/trial attachment point (current plan reference, trial/lifecycle state); minimal in this feature, authoritative in the future billing work.
- **Onboarding state/progress**: persisted per-business record of step completion and entered data enabling resume, continuation display, and completion marking.
- **Storefront address (slug)**: normalized unique public identifier derived from the business name with collision/reserved-word handling.
- **First product / category / fulfillment / hours**: instances of the existing product, category, ordering, and hours models created or configured during onboarding via reused paths.

### Explicit out-of-scope

- Full trial/subscription lifecycle and billing behavior (separate future work); no payment providers, prices, tiers, or payment-method requirements.
- Online customer payment gateways of any kind (cards, wallets, crypto); customer ordering keeps its existing non-online-payment model.
- Agent Reach in any form.
- Any migration to React or a second architecture; implementation stays within the existing vanilla frontend and established backend patterns.
- Duplicate authentication, business, product, order, settings, hours, or tenant systems.
- Complete event-management for cakes/occasions; only occasion/date/notes concepts the existing product model already supports cleanly.
- Full subscription-management admin UI; only minimum visibility fields for this feature.
- Heavy new analytics/observability platform; only existing logging patterns.

### Dependencies

- Existing business-type foundation, business/tenant model, owner relationship, slug utility (if present), product/category/fulfillment/hours systems, storefront, dashboard, ordering/pre-order, analytics, realtime notifications, auth/session/security middleware, migrations, and tests — all reused, none rebuilt.
- Public homepage "Start Free Trial" entry point leading into the new wizard.
- Future trial/subscription work will consume the lifecycle state and entitlement abstraction defined here.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 90% of first-time test owners complete account creation through store-ready without admin help or documentation in a guided walkthrough (covers acceptance criteria 1–7, 21–27).
- **SC-002**: Onboarding for two different business types shows visibly different terminology, defaults, and recommended steps while sharing the same storefront/order/dashboard backend, confirmed by side-by-side walkthrough (covers 7–10).
- **SC-003**: Capability checks pass 100% of adversarial tests: hidden UI plus direct-request rejection for disallowed features, success when allowed, and live re-evaluation on entitlement change with zero stale grants (covers 11–15).
- **SC-004**: 100% of existing-business regression checks pass: pre-existing storefronts, orders, dashboards, auth, and isolation behave exactly as before with no forced re-onboarding (covers 16–20).
- **SC-005**: 100% of interrupted-onboarding trials resume correctly: prior data preserved, next step offered, no duplicate business, no corrupted partial state (covers 21–22).
- **SC-006**: First product, fulfillment (pickup/delivery), and hours configure successfully in 95% of trial runs with field-level errors guiding the rest, and the storefront reflects the configuration on first load (covers 23–26).
- **SC-007**: Arabic RTL and English LTR walkthroughs each complete on a 360px-wide mobile viewport with all steps reachable by touch and keyboard and errors understandable without jargon (covers 28–31).
- **SC-008**: Automated tests cover signup, business/type/slug, tenancy isolation, onboarding lifecycle, product/fulfillment/hours, capabilities/limits, existing-system regression, and capability-bypass attempts with zero weakened pre-existing tests (covers 32).
- **SC-009**: Zero regressions of forbidden scope: no customer payment gateway, no Agent Reach reference, no framework migration, no duplicate core systems, no billing implementation, no hard-coded commercial pricing detected in review (covers 33–39).

## Assumptions

- The repository's current code, migrations, tests, and runtime behavior are authoritative on conflict; stale docs are advisory.
- An existing business-type data foundation exists and can be extended with profiles/defaults rather than replaced.
- Whether a plan/subscription/limit model already exists is unknown at spec time and will be confirmed by repository inspection during planning; if absent, only the minimum entitlement abstraction is built.
- Trial length intent is 7 days for future work, but no trial clock runs in this feature — only the lifecycle state that future work needs.
- Owners are nontechnical, mobile-first, on weak devices/networks; plain language and minimal steps are defaults.
- Arabic (RTL default) and English (LTR) ship for every new string through the existing language approach; future languages stay possible.
- No payment method is collected during onboarding.
- Partial businesses are resumable, never auto-deleted, unless an already-approved cleanup mechanism exists.
- Hiding a feature in the UI never weakens or replaces server-side authorization.
- Scope is bounded to self-service creation, personalization, entitlements-readiness, and store creation; full subscription lifecycle is explicitly deferred.
