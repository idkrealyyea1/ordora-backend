# Feature Specification: Product Options (Task 5)

**Feature Branch**: `009-product-options`

**Created**: 2026-09-29

**Status**: Draft

**Input**: User description: "Task 5: flexible product options, variants, and modifiers (sizes, choices, add-ons, extras) keeping ordering simple and preserving existing products/orders. Variants with own prices, optional/required groups, choices with price adjustments, quantity extras without complexity, visible selections in cart/orders, server validation and pricing from trusted data, immutable snapshots, isolation, guest checkout, simple CX, no configurator overbuild. Out of scope: subscriptions, pre-orders, inventory, coupons, rewrite/React."

**Predecessors**: Tasks 1–4 implemented in working tree (business-type model, domain guarantees, per-business currency with snapshots, storefront refinement). Verified source truth 2026-09-29: `menu_items` is flat (name, description, integer price, availability, popular, position) with no option concept; checkout accepts only item plus quantity; `order_items` snapshots name, unit price, quantity, and line total with the menu reference nullable on delete; all money server-computed; guest checkout preserved throughout.

## Clarifications

### Session 2026-09-29

- Q: When a customer picks a size variant like Large, should its price replace the base price or add to it? → A: Replace base price (the chosen variant price becomes the item price; add-on choices adjust on top of it).
- Q: Should option groups support both single-pick and multi-pick rules, or one fixed rule? → A: Min-max per group (owner sets how many choices each group needs, from exactly one to several).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Products without options work exactly as before (Priority: P1)

Existing products, carts, orders, and order history behave identically
whether or not other products gain options.

**Why this priority**: Preservation governs; option machinery must never
disturb the simple path.

**Independent Test**: Can be fully tested by replaying all existing
product, cart, checkout, tracking, and history checks on option-free
products with zero difference.

**Acceptance Scenarios**:

1. **Given** a product with no options, **When** it is viewed, added,
   ordered, and tracked, **Then** every step matches pre-Task-5
   behavior including prices and snapshots.
2. **Given** existing stored orders, **When** they are read after Task
   5, **Then** they are complete and unchanged.

---

### User Story 2 - Customer picks a variant or options simply (Priority: P2)

A customer buying pizza picks Small/Medium/Large, a coffee drinker picks
a size, a burger buyer adds cheese, a cake buyer picks size/flavor
choices — each step obvious, priced in business currency, and never
overwhelming.

**Why this priority**: This is the task goal: sized and customized
selling without configurator complexity.

**Independent Test**: Can be fully tested by configuring one product of
each example kind (size variant, add-on extras, multi-choice group)
and completing guest checkout on each.

**Acceptance Scenarios**:

1. **Given** a product with a required choice (e.g. size), **When** the
   customer orders without choosing, **Then** ordering that item is
   blocked with a clear message until a valid choice is made.
2. **Given** valid selections, **When** the item is added and checked
   out, **Then** cart, confirmation, tracking, and order details show
   the chosen names with correct per-choice pricing.

---

### User Story 3 - Business defines options without app duplication (Priority: P3)

The business owner creates option groups (optional or required),
choices with price adjustments, and quantity extras on the shared
dashboard, scoped to their business only.

**Why this priority**: Owner self-sufficiency on the same platform —
no per-business custom builds.

**Independent Test**: Can be fully tested by defining groups/choices on
one business and confirming another business sees and can use none of
them.

**Acceptance Scenarios**:

1. **Given** an owner, **When** they define a required group with
   priced choices, **Then** customers must pick exactly per the group
   rules before the item can be ordered.
2. **Given** two businesses, **When** one defines options, **Then** the
   other is unaffected in every flow.

---

### Edge Cases

- Option group or choice deleted or changed after orders exist: stored
  order snapshots stay complete and readable; only future orders use
  the new definitions.
- Tampered submissions (unknown option, wrong-business option,
  client-priced choices): rejected or recomputed from trusted data;
  client money never trusted.
- Required group left unchosen, too many extras, invalid quantities:
  refused clearly before any order is created.
- Product with options later stripped to option-free: behaves exactly
  like a legacy simple product.
- Concurrent definition edits during customer checkout: checkout
  validates against a consistent snapshot of definitions at write
  time.
- Unavailable choice or product: not orderable through any path.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Products without options MUST work exactly as before in
  every flow: view, cart, checkout, tracking, history, dashboards.
- **FR-002**: Existing stored orders MUST remain complete and
  unchanged; option snapshots apply to new orders only.
- **FR-003**: Products MUST support variants with their own prices
  (e.g. size tiers) selectable by the customer; the chosen variant
  price replaces the base price, with add-on choices adjusting on top.
- **FR-004**: Products MUST support option groups marked optional or
  required, each with a minimum and maximum pick count (from exactly
  one to several), with required groups blocking checkout of the item
  until satisfied.
- **FR-005**: Groups MUST support selectable choices with individual
  price adjustments (including zero) in minor units.
- **FR-006**: Extras MUST support quantity selection within bounded,
  simple rules without configurator complexity.
- **FR-007**: Selected options MUST display clearly in cart, order
  confirmation, tracking, dashboards, and exports with names and
  prices in business currency.
- **FR-008**: The server MUST validate every selected option against
  trusted business-scoped definitions and MUST compute the final
  price exclusively from stored values; client-submitted option
  prices MUST be ignored entirely.
- **FR-009**: Orders MUST store an immutable snapshot of selected
  options with their names and prices at purchase time, surviving
  later definition edits or deletions.
- **FR-010**: Option definitions and snapshots MUST be tenant-scoped;
  cross-business access stays denied in all paths.
- **FR-011**: Guest checkout MUST remain the default; option flows
  MUST NOT require accounts.
- **FR-012**: The data model MUST accommodate future capabilities
  without restructuring products and orders again (additive extension
  pattern, no speculative tables).
- **FR-013**: Security and validation controls MUST hold: validated
  input at trust boundaries, server-side authorization, safe errors.

### Key Entities *(include if feature involves data)*

- **Product**: existing sellable item, unchanged when option-free;
  gains optional links to option groups.
- **Option Group**: named set on a product (e.g. Size, Extras),
  optional or required, with selection rules; tenant-scoped.
- **Choice**: selectable value in a group with name and minor-unit
  price adjustment; tenant-scoped.
- **Selection**: the customer's per-item picks (group plus choices
  plus quantities) submitted at checkout, validated server-side.
- **Order Snapshot**: frozen per-line record of product, selections
  with names/prices, quantities, and line total; immutable after
  creation.

## Constraints & Out of Scope

- Do not rewrite, do not migrate to React, do not add dependencies.
- Do NOT ship: subscriptions, pre-orders, inventory/stock,
  coupons/promotions, generic e-commerce configurator, accounts,
  unrelated features.
- Keep the customer flow to: pick valid choices, see the price,
  confirm — no rule builders exposed to customers.
- Reuse existing validation, pricing, snapshot, isolation, and
  formatting patterns; extend, do not replace.

## Migration & Compatibility Expectations

- Existing products and orders MUST work with no data migration of
  stored values; option structures are additive and optional.
- Any structural change MUST be additive with safe defaults and
  reversible without data loss.
- Verification MUST cover: option-free regression, each example kind
  (size variant, add-ons, multi-choice group), tampered submissions,
  required-group enforcement, snapshot immutability across definition
  edits, cross-tenant denial, and currency-correct option pricing.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time customer configures a sized product and
  completes guest checkout in under 3 minutes.
- **SC-002**: 100% of pre-Task-5 product/order checks pass unchanged
  for option-free products and historical orders.
- **SC-003**: Each example kind (size variant, add-on extras,
  multi-choice group) completes a guest order with correct totals.
- **SC-004**: 100% of tampered option submissions are rejected or
  neutralized with server-computed totals intact.
- **SC-005**: 100% of tracked option orders show complete selections
  with names and prices after the definitions change.
- **SC-006**: Zero option flows require an account or leave the
  shared guest checkout path.

## Assumptions

- Verified baseline: flat products, item-plus-quantity checkout,
  flat snapshots with nullable menu reference, server-side money,
  guest checkout — all reused.
- Exact storage shape (linked option tables vs embedded snapshot
  detail) is a plan-level decision; the spec mandates only
  tenant-scoping, validation, pricing-from-trust, and snapshot
  guarantees.
- Selection-rule expressiveness stays minimal (required/optional,
  bounded quantities); combinatorial constraint engines are out of
  scope.
- Tests run against a disposable database via an explicit test target,
  never production, per existing practice.
