# Feature Specification: Trial Subscription Lifecycle

**Feature Branch**: `014-trial-subscription-lifecycle`

**Created**: 2026-10-02

**Status**: Draft

**Input**: User description: "TASK 14 — TRIAL, SUBSCRIPTION LIFECYCLE, PLAN ENTITLEMENTS, AND ACCOUNT/BUSINESS ACCESS CONTROL — continuing directly from completed Task 13 (self-service SaaS onboarding, business-type personalization, capability entitlements, store creation). Build the commercial subscription foundation: free-trial lifecycle, subscription lifecycle with grace/expiry/suspension/cancellation, data-driven plan model with plan-to-capability mapping, per-surface access rules (storefront, ordering, owner dashboard, management, platform admin), admin-managed activation for externally handled payment, auditability, existing-business backward compatibility, onboarding integration, no payment gateway, no React, no Agent Reach, smallest correct state machine."

## Clarifications

### Session 2026-10-02

- Q: When a business's trial or subscription fully expires (after grace), what should customers experience on the storefront? → A: Storefront stays visible but ordering is disabled; past order tracking keeps working
- Q: Which lifecycle states should the subscription model implement? → A: Six states: trial, active, grace, expired, cancelled, suspended
- Q: How many days should the grace period last after a trial or subscription ends? → A: 7 days
- Q: When an admin cancels a subscription, when should access end? → A: End of the paid period by default; access continues until then, immediate only when explicitly chosen
- Q: What subscription state should pre-existing operating businesses receive at migration? → A: Grandfathered active with no end date; stays fully working until an admin explicitly changes it

## User Scenarios & Testing *(mandatory)*

### User Story 1 - New business gets a working trial and understands it (Priority: P1) 🎯 MVP

A newly onboarded owner finishes signup and immediately sees plain-language trial status ("your free trial ends in N days") in their dashboard. The trial runs its configured length on server time, and the owner can work normally throughout it. Near the end they are warned; if it lapses without renewal, management functions restrict while their data stays intact and a clear recovery path is shown.

**Why this priority**: The trial is the commercial entry point for every self-service business; without a deterministic trial, nothing else in this feature has meaning.

**Independent Test**: Create a business through onboarding, confirm trial-active status with a correct end date, advance past expiry in a controlled environment, and confirm the defined expired behavior plus intact data.

**Acceptance Scenarios**:

1. **Given** a newly onboarded eligible business, **When** setup completes, **Then** a trial with a server-computed start and end is attached and the dashboard states the plan name and days remaining in plain language.
2. **Given** an active trial, **When** the owner uses the storefront, ordering, dashboard, and management functions, **Then** everything works as a fully entitled business.
3. **Given** a lapsed trial with no renewal, **When** the owner opens the dashboard, **Then** management functions are restricted but business data (menu, products, orders, history, settings, assets) is untouched and a recovery explanation with next steps is shown.

---

### User Story 2 - Platform admin activates and renews externally paid businesses (Priority: P1)

A business owner pays the SaaS fee outside the platform (manually, locally, or through a future provider). The platform administrator records that payment by activating or extending the subscription: picks the plan, sets the paid period, and the business becomes fully active with entitlements restored. The change is traceable (who, what changed, old/new values, when, why).

**Why this priority**: This is the entire first-version revenue path — no payment gateway exists, so admin-managed activation IS billing integration for now, and the same operation must later serve automated providers.

**Independent Test**: As platform admin, activate a paid period for a trial-lapsed business and confirm full access returns; extend, suspend, and reactivate others; inspect the audit trail for each change.

**Acceptance Scenarios**:

1. **Given** an expired or trialing business, **When** the platform admin assigns a plan with a paid period and reason, **Then** the business becomes active for exactly that period with the plan's entitlements.
2. **Given** an active subscription, **When** the admin extends, suspends, or reactivates it, **Then** only valid state transitions succeed, invalid ones are safely rejected, and each change is recorded with actor, before/after values, and timestamp.
3. **Given** any admin subscription change, **When** the owner next opens the dashboard, **Then** the new status, plan, and expiration are shown in plain language.

---

### User Story 3 - Existing businesses keep working untouched (Priority: P1)

Businesses created before this feature — by platform admins or through self-service onboarding, with orders and history — continue operating exactly as before after the subscription model lands. They receive safe deterministic defaults (a valid plan attachment and lifecycle state consistent with their current standing) with no silent deactivation and no forced migration steps.

**Why this priority**: Breaking paying or trialing incumbents to ship a billing foundation would destroy trust; backward compatibility is the release gate.

**Independent Test**: Seed admin-created and self-service businesses with orders, apply the migration, and confirm storefronts, ordering, dashboards, and analytics behave identically with coherent subscription states.

**Acceptance Scenarios**:

1. **Given** a pre-existing operating business, **When** the subscription model is introduced, **Then** it keeps full access under a deterministic default plan/state and none of its data changes.
2. **Given** mixed-vintage businesses (no subscription record, older trial clock, existing limits), **When** evaluated, **Then** each resolves to exactly one coherent lifecycle state with no duplicates or contradictions.
3. **Given** historical orders and analytics, **When** subscription states change, **Then** past records remain readable and intact.

---

### User Story 4 - Plans control capabilities through the existing entitlement system (Priority: P2)

A plan defines which boolean capabilities and numeric limits it permits; the existing centralized entitlement evaluation answers "can this business perform X?" from subscription state + assigned plan + plan entitlements + business configuration. Owners cannot escalate by editing requests, and no feature checks plan names directly.

**Why this priority**: Without plan-driven entitlements, plans are decorative labels; without centralized enforcement, every plan becomes a bypass waiting to happen.

**Independent Test**: Assign different plans/configurations, confirm allowed operations succeed and disallowed ones are rejected both in the UI and via direct requests; attempt forged plan/state/expiry claims and confirm they change nothing.

**Acceptance Scenarios**:

1. **Given** a business on a plan, **When** it uses an entitled boolean capability or stays within a numeric limit, **Then** the operation succeeds.
2. **Given** the same business, **When** it attempts a non-entitled capability or exceeds a numeric limit, **Then** the UI hides/disables it AND the direct operation is rejected server-side.
3. **Given** a plan change, **When** re-evaluated, **Then** effective access updates immediately with no stale permissions and no per-feature code changes.

---

### User Story 5 - Each surface behaves explicitly under grace, expiry, and suspension (Priority: P2)

When access lapses, every surface — public storefront, customer ordering, owner dashboard, management operations, platform admin — follows its own explicit rule: customers see a simple non-technical message rather than breakage, order tracking stays coherent, the owner always keeps a path to status and recovery, and nothing is deleted.

**Why this priority**: A single blunt lockout either breaks customer trust (store vanishes) or has no commercial teeth (nothing enforced); per-surface rules are the product decision that makes expiry both humane and real.

**Independent Test**: Move one business through grace → expired → suspended, checking storefront content, ordering acceptance, tracking of old orders, dashboard reachability, and management gating at each stage.

**Acceptance Scenarios**:

1. **Given** a business in grace, **When** customers visit or order, **Then** the explicitly defined grace behavior holds (documented at spec level, e.g. storefront/order availability rules) with no data loss.
2. **Given** an expired business, **When** customers visit, **Then** the storefront stays visible with ordering disabled and a simple non-technical notice, while past order tracking keeps working (clarified 2026-10-02).
3. **Given** an expired or suspended owner, **When** they sign in, **Then** they reach status, plan, expiration, reason, and renewal guidance — never a dead end — while restricted operations stay blocked.

---

### User Story 6 - Owners and admins get minimal clear subscription UX (Priority: P3)

Owners see status, plan, trial/subscription end, and next actions in plain words on mobile in both languages; admins see per-business plan, state, dates, grace, and entitlement summary with a small set of explicit actions. Subscription changes are traceable without building a billing console.

**Why this priority**: Opaque commercial states generate support load and failed renewals; minimal legible UX is the cheapest retention tool.

**Independent Test**: Walk an owner (trial, grace, expired) and an admin through their screens on a narrow phone in both languages, completing status comprehension and a renewal action without help.

**Acceptance Scenarios**:

1. **Given** any subscription state, **When** the owner views the dashboard, **Then** status, plan, remaining time or expiration, and the single next action are understandable without technical terms.
2. **Given** the platform admin view, **When** inspecting a business, **Then** type, plan, state, trial/subscription dates, grace, and entitlement summary are visible with explicit permitted actions only.
3. **Given** any admin subscription change, **When** reviewed later, **Then** actor, before/after state and plan, old/new expiration, reason, and timestamp are retrievable.

---

### Edge Cases

- Duplicate trial claims (same account/business re-onboarding): at most one trial per eligibility scope; repeats are denied or mapped to the existing record, never stacked.
- Failed onboarding mid-subscription-creation: no orphan subscription state; retry/resume yields exactly one coherent record.
- Clock manipulation: client clocks never affect evaluation; only persisted server timestamps decide boundaries, inclusive/exclusive rules documented.
- Exactly-at-expiry requests: deterministic outcome defined (expired at or after the end instant, server clock).
- Timezone differences: instants stored absolutely; displays localized; no off-by-one-day drift.
- Manual extension overlapping an active period: extends from the later of now or current end (no lost paid days), audited.
- Cancellation with future effective date: access continues until then, then transitions without data loss; reversible before effect where defined.
- Suspended business with in-flight customer orders: tracking and history stay coherent; new ordering follows the suspended rule.
- Owner attempts self-service plan/state/expiry/capability changes: rejected; only platform admins (and later the payment boundary) may mutate.
- Cross-tenant admin calls (spoofed business id): rejected by tenant isolation; admins act through explicit identified targets.
- Plan deactivated while assigned: assigned businesses keep resolving deterministically (graceful fallback defined, no crash, no silent full-access).
- Missing regions (business without subscription record post-migration): safe default applies; never an error state to the owner.

## Requirements *(mandatory)*

### Functional Requirements

**Plans**

- **FR-001**: The system MUST provide a data-driven plan model (stable key, display name, description, active flag, pricing in the project's money conventions with billing interval, trial eligibility, timestamps) manageable without code changes; pricing MUST NOT be scattered through frontend code.
- **FR-002**: The initial catalog MUST stay minimal (one paid plan plus its trial association, preserving any price the repository already intends); the model MUST support additional plans later with no redesign.
- **FR-003**: Plans MUST map to entitlements (boolean capabilities and numeric limits) through the existing centralized capability system; no feature may branch on plan names directly.

**Trial**

- **FR-004**: Eligible new businesses MUST receive exactly one trial per eligibility scope with server-computed start/end from the configured duration; trial status MUST derive consistently from persisted data, never client clocks.
- **FR-005**: Trial expiry MUST transition deterministically to the defined next state; platform admins MUST be able to extend a trial with an audited record.
- **FR-006**: Duplicate trial attempts MUST NOT stack or duplicate records; failed/resumed onboarding MUST leave exactly one coherent subscription state.

**Subscription lifecycle**

- **FR-007**: The system MUST implement exactly six lifecycle states — trial, active, grace, expired, cancelled, suspended (clarified 2026-10-02) — with the valid transitions enforced and invalid ones safely rejected; no additional states may be introduced without a spec update.
- **FR-008**: Activation, extension, suspension, and reactivation MUST be supported, plus cancellation that is end-of-period by default (access continues until the paid-through instant, reversible before effect) with explicitly-chosen immediate cancellation as the only alternative (clarified 2026-10-02), through one centralized service that a future payment integration can call instead of bypassing.
- **FR-009**: Renewal/reactivation after external payment MUST extend from the later of now or current end and restore entitled access; no payment provider may be required.

**Access rules per surface**

- **FR-010**: The system MUST define and enforce distinct rules for public storefront access, customer ordering, owner dashboard access, business management operations, and platform admin access across trial, active, grace, expired, and suspended states.
- **FR-011**: Expiration/suspension MUST NEVER delete business data (menus, products, orders, history, settings, assets, analytics); it restricts SaaS functionality only.
- **FR-012**: Expired storefronts MUST stay publicly visible with customer ordering disabled and a simple non-technical notice (clarified 2026-10-02); existing order tracking MUST keep working; no internal terminology may leak to customers.
- **FR-013**: Expired/suspended owners MUST retain reachability to status, plan, expiration, reason, and renewal guidance; there MUST be no dead-end screen.

**Entitlements and limits**

- **FR-014**: Effective access MUST evaluate as subscription state + assigned plan + plan entitlements + business configuration through the existing centralized evaluation point; numeric limits (only for real existing functionality) and boolean capabilities MUST both be supported.
- **FR-015**: All capability and quota decisions MUST be enforced server-side; UI hiding MUST NOT be the boundary; forged plan/state/expiry/capability/tenant claims MUST be ignored.

**Admin management and audit**

- **FR-016**: Platform admins MUST be able to view (business, type, plan, state, trial/subscription dates, grace, entitlement summary) and perform only the minimum actions (assign/activate plan, extend trial/subscription, suspend/reactivate, cancel) — no billing console.
- **FR-017**: Every administrative subscription change MUST record actor, before/after state and plan, old/new expiration, reason/note, and timestamp in the project's existing observability/logging approach, with no duplicate logging framework.

**Existing data and onboarding**

- **FR-018**: Pre-existing businesses (admin-created, self-service, with orders, without subscription records) MUST be grandfathered to active with no end date (clarified 2026-10-02) via an explainable migration; they stay fully working until an admin explicitly changes them, with no silent disablement and no conflicting duplicate states.
- **FR-019**: Onboarding MUST attach the initial trial/plan within the same atomic business-creation flow (no subscription before business identity exists); the existing onboarding flow MUST NOT be duplicated or rewritten.

**Time, security, performance, UX**

- **FR-020**: All lifecycle timestamps MUST be server-authoritative absolute instants with documented inclusive/exclusive boundaries and exactly-at-expiry behavior; no new incompatible date/time abstraction may be introduced.
- **FR-021**: Subscription management MUST be platform-admin-only with authentication, tenant isolation, existing CSRF/origin/session protections, and IDOR-safe explicit targeting; owners MUST NOT be able to mutate their own plan or state.
- **FR-022**: Per-request subscription/entitlement resolution MUST reuse resolved context safely within the request where the architecture allows, with no new caching dependencies or heavy infrastructure.
- **FR-023**: Owner and admin subscription UX MUST use plain human-readable states in both supported languages, mobile-first, with customer surfaces free of internal terminology.

### Key Entities

- **Plan**: the commercial package (stable key, names, active flag, pricing in minor units with interval, trial eligibility, timestamps); data-driven, admin-manageable.
- **Plan entitlement mapping**: which boolean capabilities and numeric limits each plan permits; consumed by the existing capability evaluation, never branched on by features.
- **Subscription**: the business's commercial access record (business link, plan link, lifecycle state, start/end instants, grace markers, cancellation data); at most one authoritative active record per business.
- **Lifecycle state**: the derived or stored position (trial, active, grace, expired, cancelled, suspended as implemented) with enforced transitions computed from server time.
- **Subscription history/audit record**: who changed what (before/after state and plan, old/new expiration, reason, timestamp) using existing observability patterns.
- **Effective access**: the evaluated result (subscription state + plan + entitlements + configuration) answering "can this business perform X?".

### Explicit out-of-scope

- Online payment gateways of any kind (cards, wallets, crypto), payment forms, webhooks, automatic recurring billing.
- Invoicing, accounting, tax, coupons, affiliates, commissions, enterprise billing consoles.
- Full multi-currency system (design must not assume one currency forever, but conversion/management stays out).
- Agent Reach in any form.
- Any migration to React or a frontend framework/build pipeline.
- Duplicate plan, entitlement, subscription-state, business-status, or account systems.
- Destructive lockout (data deletion on expiry) under any circumstance.

### Dependencies

- Task 13 implementation as built: self-service onboarding and atomic business creation, business-type profiles, centralized capability evaluation with placeholder entitlement, owner/admin dashboards, session auth, tenant isolation, existing expiry-clock fields and gates.
- Existing money conventions (minor units), date/time utilities, logging patterns, migration system, and test conventions.
- Future payment integration as a caller of the subscription service (boundary defined here, implementation deferred).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of newly onboarded eligible businesses show a correct trial with accurate end date, and trial-lapsed businesses exhibit exactly the specified restricted behavior with all data intact.
- **SC-002**: 100% of admin activation, extension, suspension, reactivation, and cancellation trials produce the specified state and access outcome, with invalid transitions rejected and every change traceable to actor, before/after values, and timestamp.
- **SC-003**: 100% of pre-existing businesses (admin-created, self-service, with orders, with or without prior subscription data) operate exactly as before after migration, each resolving to a single coherent state with zero silent deactivations.
- **SC-004**: 100% of entitlement probes behave plan-correctly: allowed operations succeed and disallowed ones fail both in the UI and on direct requests, including forged plan/state/expiry claims and cross-tenant attempts, with zero bypasses.
- **SC-005**: At each lifecycle stage (grace, expired, suspended), the storefront message, ordering acceptance, order-tracking coherence, and owner recovery path each match the specified per-surface rules in every trial run.
- **SC-006**: 90% of first-time owner walkthroughs correctly identify their status, plan, remaining time, and next action (in both supported languages on a narrow phone) without help, and admin reviewers complete inspection plus a renewal action unaided.
- **SC-007**: Zero forbidden-scope regressions detected in review: no payment gateway code, no framework migration, no duplicate plan/entitlement/subscription systems, no data deletion on expiry.
- **SC-008**: Automated suites cover plans, trial, lifecycle transitions, entitlements/limits, security/IDOR, existing-data migration, onboarding integration, storefront stages, and time boundaries with no weakened pre-existing tests.

## Assumptions

- The repository's current code, migrations, tests, and runtime behavior are authoritative; Task 13's capability modules, onboarding flow, expiry-clock fields, and gates are reused and extended, never forked.
- The intended paid price is whatever the repository already carries for the platform offering; no new commercial price is invented in the spec.
- Trial length intent remains 7 days unless the repository's configured trial policy says otherwise; grace length is 7 days (clarified 2026-10-02); exact per-surface matrix values are set at planning time from these defaults.
- One trial per business (eligibility scope) is the default; per-account nuances are resolved during planning against the 1:1 account-to-business rule from Task 13.
- Payment remains external/manual for this feature; the subscription service is the integration seam future providers will call.
- Owner-facing copy stays nontechnical and bilingual; customers never see plan, entitlement, or subscription internals.
- Partial businesses never auto-delete; expiry never destroys data; cancellation takes effect per its effective date with access until then.
