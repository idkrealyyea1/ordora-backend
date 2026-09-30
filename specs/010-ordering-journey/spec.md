# Feature Specification: Ordering Journey (Tasks 6–8)

**Feature Branch**: `010-ordering-journey`

**Created**: 2026-09-29

**Status**: Draft

**Input**: User description: "One coherent customer-ordering workflow: pre-order system (Task 6), checkout and customer journey (Task 7), order lifecycle and tracking (Task 8). Simple, reliable, production-ready journey from storefront to completion for all Food Business types. Guest checkout, no accounts, no payments. Server-truth pricing, transactional creation, preserved statuses with enforced transitions, codeless tracking, SSE kept. Out of scope: reservations, calendars, driver GPS/maps/settlement, delivery platform, payments."

**Predecessors**: Tasks 1–5 implemented in working tree (business-type model, domain guarantees, per-business currency with order snapshots, storefront refinement, product options with server-priced snapshots). Verified source truth 2026-09-29: 7 order statuses with an enforced transition map and terminal completed/cancelled; transactional checkout with submission-key idempotency under tenant row lock; guest tracking by order code; in-process SSE hub for dashboard notifications; no pre-order concept anywhere (products are available or not).

## Clarifications

### Session 2026-09-29

- Q: Should pre-order timing be a free message, a message plus a real date, or preset windows? → A: Message only (owner-written plain timing message; no date field, no presets; date/time structure stays future work).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Customer orders a pre-order product knowingly (Priority: P1)

A customer buying a cake marked for future pickup sees clearly that it
is not immediately available, understands when it will be ready, and
checks out as a guest with the pre-order facts frozen into the order.

**Why this priority**: Pre-order is the only genuinely new capability;
everything else in this feature hardens what exists.

**Independent Test**: Can be fully tested by enabling pre-order on one
product, ordering it as a guest, and confirming the messaging, timing,
snapshot, and tracking all reflect pre-order truth.

**Acceptance Scenarios**:

1. **Given** a pre-order product, **When** viewed, **Then** it is
   identified as pre-order with a plain explanation of
   non-immediate availability and preparation/availability timing.
2. **Given** a pre-order checkout, **When** confirmed, **Then** the
   order stores the pre-order facts immutably and tracking represents
   the order as a pre-order through its lifecycle.

---

### User Story 2 - Guest completes the minimal journey (Priority: P1)

A customer goes from link to tracked order with the fewest steps:
browse, pick (with options and pre-orders where applicable), cart,
pickup/delivery, minimal details, review, confirm, reference, track.

**Why this priority**: The coherent journey is the feature; friction
or surprise anywhere fails it.

**Independent Test**: Can be fully tested end to end on a phone: link
to tracked order with correct totals and no account, no extra steps.

**Acceptance Scenarios**:

1. **Given** a mixed cart (simple, optioned, and pre-order items),
   **When** the customer reviews, **Then** every line, option,
   pre-order note, subtotal, fee, and total in business currency is
   correct and final before confirmation.
2. **Given** confirmation, **When** submitted once (or retried on bad
   network), **Then** exactly one order exists, atomic with all lines
   and snapshots, with a usable reference for tracking.

---

### User Story 3 - Owner and customer both see true order state (Priority: P2)

The owner advances orders through valid states with live dashboard
updates; the customer tracks by code through a simple timeline that
matches, including pre-orders and pickup/delivery differences.

**Why this priority**: Shared truth between both sides is what makes
the lifecycle production-ready.

**Independent Test**: Can be fully tested by walking an order through
every valid transition (plus attempted invalid ones) and comparing
dashboard, SSE events, and the customer timeline at each step.

**Acceptance Scenarios**:

1. **Given** any order, **When** a valid transition is applied, **Then**
   dashboards, SSE, and the customer timeline all reflect it; invalid
   transitions are refused with completed/cancelled orders immutable.
2. **Given** a tracking code, **When** opened without an account,
   **Then** a simple timeline shows true state for pickup, delivery,
   and pre-order variants.

---

### Edge Cases

- Pre-order product ordered alongside immediate items: the order
  carries both truths; readiness messaging never implies immediate
  fulfillment of the pre-order part.
- Pre-order disabled or timing changed mid-cart: checkout validates
  current rules at write time and refuses stale pre-order claims.
- Double submit, retry, or replayed confirmation: exactly one order
  via the existing idempotency mechanism; no partial orders on any
  validation or database failure.
- Invalid transition attempts (skip states, revive terminal orders,
  wrong-type states like delivery-only for pickup): refused
  server-side; repeated identical updates are safe no-ops.
- Closed business or unavailable item at confirm time: refused before
  any order row exists.
- Lost SSE connection: dashboard recovers true state on reconnect;
  SSE remains best-effort notification, never the source of truth.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Owners MUST be able to enable/disable pre-order per
  product with an owner-written plain timing message; no date field
  and no preset windows ship in this feature.
- **FR-002**: Pre-order products MUST be clearly identified with a
  plain non-immediate-availability explanation visible before any
  ordering control.
- **FR-003**: Pre-order facts MUST snapshot immutably into the order
  and MUST be validated server-side at checkout write time.
- **FR-004**: Normal products MUST behave exactly as before whether
  or not pre-order exists elsewhere.
- **FR-005**: Guest checkout MUST stay default with minimal required
  details (name, phone/WhatsApp, delivery address only for
  delivery, optional notes) and no extra steps or registration.
- **FR-006**: Review MUST show every line with options and pre-order
  notes plus subtotal, delivery fee, and total in business currency
  before confirmation.
- **FR-007**: All prices MUST be recalculated server-side from
  trusted data at checkout; client prices MUST be ignored; creation
  MUST be transactional with no partial orders on failure.
- **FR-008**: Duplicate creation MUST be prevented via the existing
  idempotency mechanism, preserved and extended to pre-order and
  option lines.
- **FR-009**: The seven existing statuses MUST be preserved with
  server-enforced valid transitions; completed/cancelled orders
  MUST be immutable; repeated identical updates MUST be safe.
- **FR-010**: Owners MUST see true order state on dashboards with
  existing realtime notifications preserved.
- **FR-011**: Customers MUST track by code without accounts through
  a simple timeline reflecting pickup, delivery, and pre-order
  truth.
- **FR-012**: Tenant isolation, authentication, and security
  controls MUST hold across the whole journey.
- **FR-013**: Existing restaurants, orders, prices, totals, customer
  data, URLs, and currency history MUST be preserved unchanged.

### Key Entities *(include if feature involves data)*

- **Pre-Order Mark**: per-product flag plus timing information and
  customer-facing explanation; snapshot into the order at purchase.
- **Cart**: guest-local lines (simple, optioned, pre-order) with
  server-confirmed totals; presentation only, never trusted.
- **Order**: transactional creation with lines, option snapshots,
  pre-order snapshots, totals, currency context, idempotency key,
  and status lifecycle.
- **Status Timeline**: customer-facing true-state projection of the
  enforced status model, variant-aware for pickup, delivery, and
  pre-order.
- **Realtime Event**: best-effort dashboard notification of order
  creation and status change; never authoritative.

## Constraints & Out of Scope

- Do not rewrite, do not migrate to React, do not add dependencies.
- Do NOT ship: table reservations, appointment booking, calendars,
  reservation management, driver GPS, live maps, settlement,
  delivery-management platform, online payments, accounts.
- Reuse checkout transaction, idempotency, status model, tracking,
  SSE hub, snapshot, currency, and isolation patterns; extend, do
  not replace.

## Migration & Compatibility Expectations

- Pre-order enablement MUST be additive and optional with safe
  defaults (off); existing products order identically with no data
  migration of stored values.
- Any structural change MUST be additive, idempotent, and
  reversible without data loss.
- Verification MUST cover: pre-order on/off messaging and snapshots,
  full guest journey per type, tampered/duplicate/partial-failure
  cases, every valid and invalid transition, timeline truth for all
  variants, SSE recovery, and legacy regression.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time customer completes the full journey
  (link to tracked order, mixed cart) in under 5 minutes on a
  mid-range phone with zero accounts.
- **SC-002**: 100% of pre-Task-6 journey checks pass unchanged for
  normal products and historical orders.
- **SC-003**: 100% of pre-order orders show correct identification,
  timing, snapshots, and timeline representation.
- **SC-004**: Zero duplicate orders across double-submit, retry, and
  replay attempts; zero partial orders across failure injection.
- **SC-005**: 100% of invalid transitions refused with terminal
  orders immutable; 100% of valid transitions reflected on
  dashboard, SSE, and timeline together.
- **SC-006**: Codeless tracking succeeds for 100% of valid codes
  with true state for pickup, delivery, and pre-order variants.

## Assumptions

- Verified baseline: 7 enforced statuses, transactional checkout
  with idempotency key, codeless tracking, in-process SSE, option
  and currency snapshots, guest checkout — all reused.
- Pre-order timing starts as simple availability messaging with a
  date/time-ready shape; calendar/reservation systems stay out.
- Timeline is a read-only projection; the enforced status model
  remains the single source of truth.
- Tests run against a disposable database via an explicit test target,
  never production, per existing practice.
