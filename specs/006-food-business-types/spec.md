# Feature Specification: Food Business Types (Task 2)

**Feature Branch**: `006-food-business-types`

**Created**: 2026-09-29

**Status**: Draft

**Input**: User description: "Task 2: evolve the restaurant-focused domain into a broader Food Business model supporting multiple food-business types (at minimum Restaurant, Cafe, Bakery, Dessert Shop, Home Kitchen, Cloud Kitchen) while preserving all existing restaurant functionality and data. Extensible type concept, persistent business data, capabilities varying by type without duplicated systems, shared ordering flow, guest checkout, tenant isolation, safe reversible migrations. Out of scope: rewrite, React, table/terminology renames, bookings, self-service onboarding, full i18n, full multi-currency (preserve Task 1 foundation), payments."

**Predecessor**: Task 1 (`specs/005-food-business-foundation/`, implemented in working tree, DB validation pending) delivered: additive `restaurants.business_type` column (closed set of 9, default `restaurant`), creation/update plumbing through the existing owner flow, creation-time currency passthrough on the existing per-business currency field, pre-order contract reserve, 4 new test files. This spec treats that code and its migrations as the source of truth and builds only the remaining domain work.

## Clarifications

### Session 2026-09-29

- Q: Should customers see each business's type on its storefront, or should type stay invisible data? → A: Dashboards only (type visible in owner and admin dashboards, hidden from customer storefronts).
- Q: Who should be allowed to change a live business's type after creation? → A: Owner only (only the platform owner can change type; tenant admins cannot; type is never customer-editable).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Existing restaurant works exactly as before (Priority: P1)

An existing restaurant's customers and owners notice no change: same URLs,
same storefront, same menu and prices, same guest checkout, same order
tracking, same dashboard, same data.

**Why this priority**: Preservation is the governing constraint of this
task. Any regression fails the task regardless of new capability.

**Independent Test**: Can be fully tested by replaying the pre-Task-2
acceptance checks (menu, cart, guest pickup/delivery checkout, tracking,
dashboard management) on a restaurant created before Task 1 with zero
behavioral difference.

**Acceptance Scenarios**:

1. **Given** a restaurant created before Task 1, **When** its data and
   pages are inspected after Task 2, **Then** URLs, slugs, orders, users,
   menu items, settings, and behavior are unchanged.
2. **Given** an existing restaurant, **When** a guest checks out, **Then**
   pricing, fees, availability, hours, and subscription enforcement behave
   exactly as before.

---

### User Story 2 - A typed food business operates on the shared platform (Priority: P2)

A cafe, bakery, dessert shop, home kitchen, or cloud kitchen exists as a
food business with its type stored as persistent data, gets a public
storefront and a private dashboard on the same platform, and accepts guest
pickup/delivery orders through the shared core ordering flow.

**Why this priority**: This is the task goal: one platform, many business
kinds, no parallel systems.

**Independent Test**: Can be fully tested by creating one business of each
required type and completing a guest order on each through the unchanged
shared flow.

**Acceptance Scenarios**:

1. **Given** a new cafe-type business, **When** it is created through the
   existing owner-managed flow, **Then** its stored type is cafe and it has
   a working storefront, dashboard, and guest checkout.
2. **Given** businesses of different types, **When** each operates, **Then**
   each uses the same core ordering flow with no duplicated application.

---

### User Story 3 - Capabilities vary by type without app duplication (Priority: P3)

A business type that does not offer a capability (for example delivery)
has that capability disabled through configuration, while the shared flow
and codebase stay single.

**Why this priority**: Proves the model is capability-driven rather than a
collection of per-type forks — the maintainability core of the task.

**Independent Test**: Can be fully tested by disabling delivery for one
type, confirming delivery orders are refused with pickup intact, and
confirming no type-specific code path or second application exists.

**Acceptance Scenarios**:

1. **Given** a business type without delivery, **When** a customer attempts
   a delivery order, **Then** the order is refused clearly and pickup
   remains available.
2. **Given** any two business types, **When** their code paths are
   compared, **Then** both execute the shared ordering flow.

---

### Edge Cases

- Business with an unrecognized or missing type value: treated with safe
  restaurant defaults; storefront never errors and no cross-tenant data
  leaks.
- Type change on a live business: only the platform owner may change
  it; tenant admins cannot. Existing orders, users, menu items, and
  settings remain valid and untouched; only future capability behavior
  follows the new type.
- Inactive, closed, or subscription-expired business of any type:
  ordering refused with the same safe behavior as restaurants today.
- Concurrent checkouts across types: totals, availability, hours, and
  subscription re-validated at write time per business.
- Attempt to create a type outside the supported set: rejected clearly at
  creation/update time, never stored.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The platform MUST support at minimum Restaurant, Cafe,
  Bakery, Dessert Shop, Home Kitchen, and Cloud Kitchen as food-business
  types on one shared system, not separate applications.
- **FR-002**: Business type MUST be stored as persistent data on the
  business record, readable across storefront, dashboard, and ordering
  flows. Type is visible in owner and admin dashboards only; customer
  storefronts MUST NOT display a type badge or label.
- **FR-003**: The type set MUST be extendable later without creating
  separate systems per type; adding a type MUST NOT require duplicating
  ordering, checkout, tracking, or dashboard flows.
- **FR-004**: All existing restaurant URLs, slugs, data (orders, users,
  menu items, settings), and behavior MUST continue working exactly as
  before; existing rows MUST read as the restaurant type by default.
- **FR-005**: Capability differences between types MUST be expressed as
  configuration on the shared flow (menu/products, pickup/delivery,
  hours, availability), not as per-type code branches or applications.
- **FR-006**: The core ordering flow MUST stay shared across all types:
  guest checkout without an account, server-side pricing, price
  snapshotting, order tracking by public code.
- **FR-007**: Tenant isolation MUST hold across types: a business of any
  type can access only its own data; cross-business access stays
  explicitly gated and server-checked.
- **FR-008**: Security controls MUST NOT weaken for any type: server-side
  authorization, session handling, origin protection on mutations, rate
  limiting on public writes, validated input, safe errors.
- **FR-009**: Every data change MUST ship as a safe, reversible,
  backwards-compatible migration with safe defaults; no existing data
  removed or invalidated.
- **FR-010**: The `restaurants` table name and existing restaurant
  terminology MUST be preserved unless implementation proves a rename
  strictly necessary (no such necessity is in scope for this task).
- **FR-011**: The Task 1 currency foundation MUST be preserved unchanged:
  per-business currency, integer money, presentation-only formatting, no
  global-currency assumption; no full multi-currency system ships here.
- **FR-012**: Visual identity MUST remain intact; no redesign in this task.

### Key Entities *(include if feature involves data)*

- **Food Business**: the shared tenant record (stored in the existing
  `restaurants` table, name unchanged). Attributes: identity/slug, type
  (at minimum the six required kinds), status, active flag, subscription
  window. Existing rows default to the restaurant type.
- **Business Type**: a persistent, constrained value on the business
  record. Closed, validated set today; extension path defined (new value
  admitted through a later scoped task, never through code forks).
- **Capability Profile**: the per-business configuration expressing
  type-appropriate behavior (products, pickup/delivery, hours,
  availability) on the shared flow. No per-type tables or pipelines.
- **Customer**: guest purchaser, unchanged (name, contact, address for
  delivery, notes; no account).
- **Order**: guest purchase on the shared flow, unchanged (snapshotted
  lines, server-side totals, pickup/delivery, status lifecycle, tracking
  code).

## Constraints & Out of Scope

- Do not rewrite, do not migrate to React, do not rename tables or
  terminology, do not redesign visuals or homepage.
- Do NOT ship: bookings/reservations, self-service onboarding, full
  multi-language system, full multi-currency system, online payment
  gateways, per-type applications, unrelated features.
- Task 1 foundation (type column, owner-flow plumbing, currency
  passthrough, pre-order reserve) is reused as-is, not rebuilt.

## Migration & Compatibility Expectations

- Pre-Task-1 restaurants MUST work unchanged: same URLs
  (`/restaurant/:slug`, `/r/:slug` redirect), same public
  menu/checkout/tracking contracts, same dashboards, same stored orders.
- Data changes MUST be additive with safe defaults and reversible
  without data loss; disabling new surface MUST restore prior behavior.
- Verification MUST cover: legacy restaurant ordering, each required
  type ordering, cross-type isolation both directions, type validation
  rejections, closed/inactive/expired refusals, and currency foundation
  preservation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time customer completes guest checkout on an
  existing restaurant and on each required business type in under 3
  minutes per order, with zero account requirement.
- **SC-002**: 100% of pre-Task-1 acceptance checks for menu, cart,
  checkout, tracking, and dashboard management pass unchanged.
- **SC-003**: Each of the six required types onboards through the
  existing owner-managed flow and takes its first guest order with no
  separate application or duplicated flow.
- **SC-004**: Cross-type data access attempts are denied in 100% of
  tested read/write paths.
- **SC-005**: An unsupported type value is rejected in 100% of creation
  and update attempts, with existing data untouched.
- **SC-006**: Currency behavior matches the Task 1 foundation on every
  type with 0 regressions (per-business display, integer math, snapshot
  stability).

## Assumptions

- Task 1 artifacts (`specs/005-food-business-foundation/`, migration
  `021`, plumbing, 4 new test files) are the implemented baseline; this
  task extends the domain on top of them rather than re-specifying them.
- The current stored type set from Task 1 already covers the six
  required kinds; this task locks the domain guarantees, not the
  enumeration.
- Type extension means admitting a new validated value through a later
  scoped task, not a schema redesign; the closed validated set is the
  anti-fork mechanism.
- Owner-managed onboarding (platform owner plus existing request flow)
  is reused; no self-serve signup surface is designed here.
- Tests run against a disposable database via an explicit test target,
  never production, per existing practice.
