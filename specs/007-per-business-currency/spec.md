# Feature Specification: Per-Business Currency (Task 3)

**Feature Branch**: `007-per-business-currency`

**Created**: 2026-09-29

**Status**: Draft

**Input**: User description: "Task 3: per-business currency foundation. Each Food Business owns its currency; owner selects/changes it via owner UI; ISO 4217 with prepared set ILS, USD, EUR, GBP, JOD, SAR, AED, EGP; numeric-only money in storage with presentation-layer formatting; no exchange rates or conversion; no price conversion on currency change; orders preserve creation-time currency context and values; legacy works without migration or repair; checkout, totals, fees, analytics, admin preserved; no payments, no full i18n, no rewrite/React, no extra dependencies; safe reversible migrations; isolation; back-compat; future currencies without model change."

**Predecessors**: Task 1 (`specs/005-food-business-foundation/`) established per-business currency storage with integer-cents math and presentation-only formatting; Task 2 (`specs/006-food-business-types/`) locked the domain model. Verified source truth 2026-09-29: all money stored as integer minor units (item prices, order subtotals/fees/totals, delivery fees, revenue aggregates, CSV exports); per-business ISO-3 currency field with constraint; locale-aware formatting at presentation only; no symbols or formatted strings in storage; no conversion logic anywhere.

## Clarifications

### Session 2026-09-29

- Q: Who should be able to change a business's currency — the platform owner, the business admin, or both? → A: Business admin (the business's own admin changes currency via business settings; the platform owner sets only the initial creation default).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Existing restaurant works without migration or repair (Priority: P1)

An existing restaurant keeps its prices, orders, analytics, and behavior
exactly as before, with no manual data fixes and no migration of stored
values.

**Why this priority**: Stability of current businesses is the governing
constraint; any forced repair fails the task.

**Independent Test**: Can be fully tested by replaying all ordering,
tracking, dashboard, and analytics checks on a pre-Task-3 restaurant with
zero difference and zero data intervention.

**Acceptance Scenarios**:

1. **Given** a restaurant created before Task 3, **When** it operates
   after Task 3, **Then** prices, totals, fees, analytics, and behavior
   are unchanged with no data repair.
2. **Given** existing stored orders, **When** they are tracked or
   reported, **Then** their monetary values match creation time.

---

### User Story 2 - Business admin sets the business currency (Priority: P2)

The business admin selects or changes their Food Business currency from
the prepared set through business settings, with immediate effect on
display and no effect on stored numeric values. (The platform owner sets
only the initial creation default.)

**Why this priority**: This is the task goal: per-business currency
control without destabilizing money handling.

**Independent Test**: Can be fully tested by changing a business currency
through business settings and verifying display follows while every stored
amount stays numerically identical.

**Acceptance Scenarios**:

1. **Given** a business admin, **When** they select a prepared-set currency,
   **Then** menus, cart, checkout, tracking, dashboards, and analytics
   for that business present in the new currency.
2. **Given** a currency change, **When** stored prices, fees, orders, and
   aggregates are inspected, **Then** every numeric value is unchanged
   (no conversion, no repricing).

---

### User Story 3 - Historical orders keep creation-time context (Priority: P3)

An order placed before a currency change still shows the monetary values
and currency context that were valid when it was created.

**Why this priority**: Money history must never be rewritten by a later
settings change; trust and auditability depend on it.

**Independent Test**: Can be fully tested by placing an order, changing
the business currency, and re-tracking the order with original values
and context intact.

**Acceptance Scenarios**:

1. **Given** an order placed under currency X, **When** the business
   switches to currency Y and the old order is tracked, **Then** it
   shows its original values with currency context X.
2. **Given** the same business, **When** a new order is placed after the
   switch, **Then** it uses currency context Y with correct math.

---

### Edge Cases

- Unsupported or malformed currency code submitted: rejected clearly,
  stored value untouched.
- Currency change with open, pending, or in-progress orders: those
  orders keep their creation context; only new orders use the new
  currency.
- Analytics mixing businesses on different currencies: never summed
  into a single unlabeled total; each figure carries its currency
  context or stays per-business.
- Missing currency on a business record: safe default applies and the
  storefront still renders; math stays integer-based.
- Concurrent order during a currency change: the order is computed and
  snapshotted under exactly one consistent currency context.
- Zero-amount items, fees, and refunds-of-record: formatted correctly in
  every prepared currency.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Currency MUST belong to the individual Food Business; each
  business has exactly one active currency at a time.
- **FR-002**: The business admin MUST be able to select and change the
  business currency through business settings from a prepared set
  containing at minimum ILS, USD, EUR, GBP, JOD, SAR, AED, and EGP.
  The platform owner sets only the initial creation default.
- **FR-003**: Only standard ISO 4217 three-letter codes MUST be
  storable; any other value MUST be rejected at write time.
- **FR-004**: All stored money MUST remain plain numeric minor units
  with no currency symbols, codes, or formatted strings in storage.
- **FR-005**: All currency formatting MUST happen at the presentation
  layer from the numeric value plus the business currency context.
- **FR-006**: The system MUST NOT implement exchange rates, automatic
  conversion, or price repricing; changing currency MUST NOT alter any
  stored numeric value.
- **FR-007**: Every order MUST preserve the currency context and
  monetary values valid at its creation, independent of later currency
  changes.
- **FR-008**: Checkout totals, delivery fees, analytics aggregates, and
  exports MUST keep their existing computation; only the presented
  currency context follows the business setting.
- **FR-009**: Aggregates spanning businesses on different currencies
  MUST NOT be presented as a single unlabeled total; figures MUST carry
  currency context or remain per-business.
- **FR-010**: Existing restaurants MUST work with no migration of stored
  values and no manual data repair; prior behavior is the default.
- **FR-011**: Tenant isolation and existing security controls MUST hold
  for currency management: a business can change only its own currency
  through gated, validated paths.
- **FR-012**: Future currencies MUST be addable to the prepared set
  without changing the core data model.

### Key Entities *(include if feature involves data)*

- **Business Currency**: the ISO 4217 code owned by one Food Business;
  single active value, validated set, safe default; display follows it,
  storage never embeds it in amounts.
- **Money Amount**: integer minor units everywhere (prices, fees,
  subtotals, totals, revenue figures, exports); currency-agnostic
  arithmetic, never mixed across contexts.
- **Order Snapshot**: the frozen creation-time record of values plus
  currency context; immune to later settings changes.
- **Prepared Currency Set**: the owner-facing selectable list (at
  minimum the eight required codes); extendable data, not a schema
  change.
- **Currency Context**: the code accompanying any presented figure
  (menu, cart, tracking, dashboard, analytics, export) so amounts are
  never ambiguous.

## Constraints & Out of Scope

- Do not rewrite, do not migrate to React, do not redesign visuals or
  homepage.
- Do NOT ship: exchange rates or conversion, price repricing on
  currency change, online payment gateways, full internationalization
  or multilingual support, per-type currency engines, unrelated
  features.
- Minor-unit convention stays hundredths as today for the prepared set;
  sub-cent precision handling is explicitly out of scope.
- Task 1/Task 2 foundations (type model, owner flows, guest checkout,
  pre-order reserve) are reused as-is.

## Migration & Compatibility Expectations

- No stored-value migration: existing numeric amounts MUST NOT be
  rewritten, converted, or repaired by this task.
- Any structural change MUST be additive with safe defaults and
  reversible without data loss; prior behavior restorable by
  disabling the new surface.
- Verification MUST cover: legacy ordering/tracking/analytics
  unchanged, business-admin currency selection from the prepared set, invalid
  code rejection, no-conversion proof across a currency change,
  creation-context preservation on old orders, and per-business
  currency correctness in analytics and exports.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time customer completes guest checkout on a
  business using each prepared currency path in under 3 minutes per
  order, with all amounts displayed in the business currency.
- **SC-002**: 100% of pre-Task-3 acceptance checks for menu, cart,
  checkout, tracking, dashboards, analytics, and exports pass unchanged
  on legacy businesses with zero data intervention.
- **SC-003**: A business admin changes business currency through business
  settings and 100% of stored numeric values remain identical before and after.
- **SC-004**: 100% of orders tracked after a currency change show their
  creation-time values and currency context.
- **SC-005**: 100% of unsupported or malformed currency submissions are
  rejected with the stored value untouched.
- **SC-006**: Zero presented figures lack currency context, and zero
  cross-currency unlabeled totals exist in dashboards, analytics, or
  exports.

## Assumptions

- Verified baseline: integer-cents storage, per-business ISO-3 field
  with constraint, presentation-only locale formatting, and no
  conversion logic anywhere; this task locks guarantees around that
  baseline rather than reinventing it.
- The exact storage mechanism for creation-time context (snapshot
  field vs derived record) is a plan-level decision; the spec mandates
  only the observable guarantee.
- Analytics stay per-tenant correct as today; only cross-currency
  presentation needs the context rule (FR-009).
- Tests run against a disposable database via an explicit test target,
  never production, per existing practice.
