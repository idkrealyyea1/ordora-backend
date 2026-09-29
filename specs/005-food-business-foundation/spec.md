# Feature Specification: Food Business Foundation

**Feature Branch**: `005-food-business-foundation`

**Created**: 2026-09-29

**Status**: Draft

**Input**: User description: "Prepare the existing Restivo SaaS for its next evolution from a restaurant-focused ordering system into a broader Food Business Ordering Platform. This is an existing project. Do not rebuild it. Minimum safe product and architectural foundation for the next roadmap phases (cafes, dessert shops, bakeries, cake businesses, home kitchens, cloud kitchens, small food businesses) on one shared model with configurable capabilities, plus multi-currency and pre-order foundations. No payment gateways, no React migration, no homepage redesign, no full i18n, no unrelated features."

## Clarifications

### Session 2026-09-29

- Q: Should the business-type value be limited to the 9 listed types, or kept open for future types? → A: Closed list (fixed set of the 9 listed types; adding a new type requires a later spec plus migration).
- Q: Should existing internal names like restaurant and menu item stay unchanged in this foundation? → A: Keep restaurant names (existing identifiers, routes, URLs, and slugs stay as-is; Food Business is product wording only).
- Q: Who should be able to create a new-type food business in this foundation? → A: Existing owner flow (platform-owner creation plus public request flow; no self-serve signup in this feature).
- Q: Which capabilities should vary by business type in this foundation? → A: Core four only (menu/products, pickup/delivery, hours, availability; bookings and analytics stay as-is, not per-type capabilities).
- Q: Should this feature let owners change their business currency, or only respect the stored value? → A: Owner editable UI (dashboard control to change the business currency ships in this feature).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Existing restaurant keeps working unchanged (Priority: P1)

A regular customer orders from an existing restaurant exactly as today:
discovers the storefront, builds a cart, checks out as a guest (pickup or
delivery), and tracks the order by code. The restaurant owner manages menu,
orders, hours, and settings in the existing dashboard.

**Why this priority**: Constitution principle I. If this regresses, nothing
else matters. Backwards compatibility is the top gate for this feature.

**Independent Test**: Can be fully tested by placing a guest pickup and a
guest delivery order on a pre-existing restaurant and managing both through
the existing dashboard, with zero change in steps, fields, or behavior.

**Acceptance Scenarios**:

1. **Given** an existing active restaurant, **When** a customer opens its
   public menu, **Then** menu, prices, fees, hours, and availability match
   pre-feature behavior.
2. **Given** a guest cart, **When** the customer checks out without an
   account, **Then** the order is priced server-side, snapshots prices, and
   returns a trackable code.
3. **Given** an existing owner account, **When** the owner manages menu,
   categories, orders, and settings, **Then** all actions behave as before.

---

### User Story 2 - New food business type onboards on the same system (Priority: P2)

A cafe, bakery, dessert shop, cake business, home kitchen, or cloud kitchen
onboards as a food business on the same platform (not a separate app), gets
a public storefront and a private dashboard, and accepts guest pickup /
delivery orders with capabilities appropriate to its type.

**Why this priority**: This is the core roadmap unblock: one shared model
with configurable capabilities instead of per-type applications.

**Independent Test**: Can be fully tested by onboarding one non-restaurant
business (e.g. home bakery), configuring its capabilities, and completing a
guest order end to end on the same flows as Story 1.

**Acceptance Scenarios**:

1. **Given** a new bakery-type business, **When** it is created,
   **Then** it
   appears in the public directory and has a working storefront, dashboard,
   and guest checkout with no separate application. Creation uses the
   existing platform-owner plus public-request flow; no self-serve signup
   ships in this feature.
2. **Given** two businesses of different types, **When** each configures
   its own menu, hours, and pickup/delivery options, **Then** neither sees
   nor affects the other's data.
3. **Given** a business type that does not offer delivery, **When** a
   customer attempts a delivery order, **Then** the order is refused with a
   clear message and pickup remains available.

---

### User Story 3 - Prices stay correct per business currency (Priority: P2)

A customer viewing any business sees prices formatted in that business's
currency, while all money stays numeric internally and totals are computed
server-side. No global-currency assumption leaks into totals, fees, or
snapshots.

**Why this priority**: Multi-currency is an explicit future requirement.
The foundation MUST lock the numeric-money plus presentation-formatting
contract now, so per-business currency selection later is a setting change,
not a redesign.

**Independent Test**: Can be fully tested by setting two businesses to two
different currencies and verifying displayed prices, fees, totals, and
tracked-order totals each follow their own business currency with correct
server-side math.

**Acceptance Scenarios**:

1. **Given** a business with currency X, **When** a customer views menu,
   cart, checkout, and tracked order, **Then** every amount is presented in
   X while stored and computed as integers.
2. **Given** client-submitted totals or prices, **When** checkout runs,
   **Then** they are ignored and recomputed from stored prices plus fees.

---

### User Story 4 - Future pre-order does not break today's ordering (Priority: P3)

The system does not hard-assume every product is immediately available in a
way that would block a future pre-order concept, but no pre-order engine
ships in this feature. When pre-order arrives later, a customer selecting a
pre-order product will clearly understand it is not immediately available
and when it will be prepared or available.

**Why this priority**: Explicit future requirement, explicitly deferred.
This feature only reserves the concept so the roadmap does not require a
breaking change later.

**Independent Test**: Can be fully tested by confirming today's
available/unavailable semantics are unchanged, and that the public product
contract has a defined, backwards-compatible place for future availability
messaging without altering checkout behavior now.

**Acceptance Scenarios**:

1. **Given** any product today, **When** it is available or unavailable,
   **Then** customer messaging and checkout enforcement behave exactly as
   before.
2. **Given** a future pre-order product (not implemented now), **When** the
   concept is added later, **Then** it MUST be expressible without breaking
   existing clients or changing existing order flows.

---

### Edge Cases

- Unknown or missing business type: system falls back to safe restaurant
  defaults; never errors the storefront or leaks another tenant's data.
- Missing or invalid currency on a business: storefront still renders with
  a documented default; checkout math stays integer-based and never mixes
  currencies across businesses.
- Inactive, closed, or subscription-expired business: ordering is refused
  with the same safe, non-enumerating behavior as today.
- Concurrent checkouts and status flips: totals, availability, hours, and
  subscription are re-validated at write time; no duplicate or mispriced
  orders.
- Delivery requested where disabled: refused clearly; pickup unaffected.
- Private/admin pages (dashboards, owner tools): never indexed as public
  search pages even as public pages gain SEO structure.
- Social proof without real customers: no logos, testimonials, ratings, or
  usage claims are shown until backed by verifiable sources.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support restaurants, cafes, dessert shops,
  bakeries, cake businesses, home kitchens, home food businesses, cloud
  kitchens, and small food businesses on one shared platform, not separate
  applications. The supported type set is CLOSED to exactly these 9 values
  in this feature; adding a type requires a later spec plus migration.
- **FR-002**: Business type MUST be data (an attribute of the food
  business), and differences between types MUST be expressed as
  configurable capabilities limited to menu/products, pickup/delivery,
  hours, and availability in this feature, not forks or parallel flows.
  Bookings and analytics are not per-type capabilities now.
- **FR-003**: Existing guest checkout MUST remain account-free for pickup
  and delivery, with order tracking by public code unchanged.
- **FR-004**: Tenant isolation MUST be preserved: business identity comes
  only from the authenticated user's record; every tenant query is scoped
  by business; cross-business access stays explicitly gated and
  server-checked.
- **FR-005**: All money MUST remain integer minor units internally,
  computed server-side from stored prices; client-sent totals/prices MUST
  be ignored; order lines MUST snapshot prices at purchase time.
- **FR-006**: Currency MUST be per-business (ISO 3-letter), and formatting
  MUST be presentation logic only; the system MUST NOT assume one global
  currency in math, storage, fees, or snapshots. Owners can change their
  business currency from the dashboard in this feature; existing orders
  keep their snapshotted currency behavior.
- **FR-007**: Product availability MUST remain backwards compatible today
  while reserving a forward-compatible expression for future pre-order
  (customer-visible non-immediate availability with a future date/time);
  no pre-order engine, scheduling, or payment ships in this feature.
- **FR-008**: Public pages MUST keep honest SEO structure (titles,
  descriptions, canonical URLs, sitemap including active businesses up to
  a bounded count, robots rules, semantic structure, social metadata, and
  only truthful structured data); private pages MUST stay non-indexed.
- **FR-009**: Existing visual identity MUST remain intact (dark teal/navy,
  coral/orange, yellow accents, cream background, grid/paper language,
  rounded cards, offset shadows, product mockups, mobile-first); no
  homepage redesign in this feature.
- **FR-010**: Social proof MUST NOT be fabricated: no customer/business
  logos, testimonials, ratings, or usage claims without verifiable
  sources; empty state shows nothing rather than invented content.
- **FR-011**: Every data change MUST ship as a backwards-compatible,
  idempotent, additive migration with safe defaults; no destructive change
  without explicit justification and a safe path; existing data preserved.
- **FR-012**: Security posture MUST NOT weaken: server-side authorization
  on every sensitive operation, session handling, origin protection on
  mutations, rate limiting on public write paths, validated/sanitized
  input at trust boundaries, parameterized data access, safe uploads, and
  error responses that hide internals.
- **FR-013**: Analytics MUST continue working across business types on the
  existing order model (counts/revenue by status) without per-type
  pipelines.

### Key Entities *(include if feature involves data)*

- **Food Business**: the shared tenant (today: restaurant). Attributes:
  identity/slug, type (CLOSED set of 9 per Clarifications 2026-09-29),
  status, active flag, subscription window. Existing internal identifiers,
  routes, URLs, and slugs keep their current restaurant naming; Food
  Business, Store, and Product are product wording only in this feature.
  One record scopes everything below.
- **Store**: per-business presentation and policy (description, contact,
  address, timezone, branding, currency, delivery policy/fees, hours).
  Currency is per-store; formatting is display-only.
- **Product**: sellable item within a category (name, description, integer
  price, availability). Future pre-order is a forward-compatible
  availability expression, not a separate object in this feature.
- **Customer**: guest purchaser (name, contact, address for delivery,
  notes). No account in this feature; identity lives on the order.
- **Order**: guest purchase (items with snapshotted prices, subtotal, fee,
  total, pickup/delivery, status lifecycle, tracking code). Priced and
  validated server-side at write time.
- **Fulfillment (Pickup / Delivery)**: per-order mode gated by per-store
  capability; delivery-only states apply to delivery orders.
- **Analytics**: aggregates over orders by business and status; no
  per-type duplication.

## Constraints & Out of Scope

- Do not rebuild, do not migrate to React, do not redesign the homepage,
  do not add unrelated features.
- Do NOT ship: payment gateways, full pre-order system, full
  multi-language support, per-type applications, homepage messaging or
  conversion rework.
- Future homepage social proof (e.g. horizontal/marquee logos) and SEO
  positioning for broader food businesses are roadmap work, not this
  feature; visual identity is frozen for that work.
- Necessary technical constraints (not plan details): additive idempotent
  migrations only; tenant scoping on every query; integer money
  server-side; per-business ISO currency; origin-checked mutations;
  rate-limited public writes; `noindex` on private pages.

## Migration & Compatibility Expectations

- Existing restaurants, slugs, URLs (`/restaurant/:slug`, `/r/:slug`
  redirect), public menu/checkout/tracking contracts, dashboards, and
  stored orders MUST work unchanged after the foundation lands.
- Data changes MUST be additive with safe defaults (e.g. default type
  behaves like today's restaurant; default currency preserves current
  behavior) and MUST be idempotent under the existing migration runner.
- Rollback MUST be safe: disabling the new type/capability surface MUST
  restore today's restaurant-only behavior without data loss.
- Verification MUST cover: pre-existing restaurant ordering, new-type
  business ordering, cross-tenant isolation both directions, currency
  formatting per business with integer math, closed/inactive/expired
  refusals, and sitemap/robots/private-`noindex` behavior.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time customer completes guest checkout (pickup and
  delivery) on both an existing restaurant and a new-type food business in
  under 3 minutes each, with zero account requirement.
- **SC-002**: Zero regressions in existing restaurant flows: 100% of
  pre-feature acceptance checks for menu, cart, checkout, tracking, and
  dashboard management still pass unchanged.
- **SC-003**: A new bakery-type business onboards and takes its first
  guest order using only the shared platform, with no separate
  application or duplicated ordering flow.
- **SC-004**: Two businesses on different currencies each display and
  total correctly in their own currency, with 100% of checkout totals
  recomputed server-side and 0 cases of cross-currency mixing.
- **SC-005**: Cross-business data access attempts are denied in 100% of
  tested read/write paths, and private pages remain non-indexed in 100%
  of checks.
- **SC-006**: Public pages expose complete honest SEO essentials (title,
  description, canonical, sitemap entry for active businesses, robots
  rules, semantic headings, social metadata) with 0 fabricated claims,
  logos, or reviews.

## Assumptions

- Existing per-business currency field, integer-cents pricing, and
  presentation-side formatting are the baseline contract to lock in and
  extend with an owner-editable currency control (per Clarifications
  2026-09-29); historical order snapshots keep prior behavior.
- Default business type behaves exactly like today's restaurant so all
  existing rows remain valid without backfill risk.
- Existing auth/session model, guest checkout, pickup/delivery modes,
  opening-hours enforcement, subscription gating, and status lifecycle
  are reused unchanged.
- Marketing pages for additional business types beyond those that exist
  today are homepage roadmap work, not this foundation.
- Performance, concurrency, and deployment characteristics stay within
  current single-instance behavior; horizontal scaling is out of scope.
- Tests run against a disposable database via an explicit test database
  target, never production, per existing practice.
