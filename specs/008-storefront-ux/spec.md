# Feature Specification: Storefront UX (Task 4)

**Feature Branch**: `008-storefront-ux`

**Created**: 2026-09-29

**Status**: Draft

**Input**: User description: "Task 4: clearer, simpler, mobile-first storefront for all Food Business types preserving Restivo visual identity and ordering functionality. Immediate business identity (name, logo/cover, open/closed, description, location/contact); better discovery, category navigation, product presentation; keep search, simple cart, clear pickup/delivery, existing ordering, Task 3 currency; Arabic RTL + English without full i18n; accessibility basics; no variants (Task 5), no pre-orders, no accounts, no loyalty/reviews/favorites, no gratuitous animation; fast on weak devices; no React; no URL breakage."

**Predecessors**: Tasks 1–3 implemented in working tree (business-type model, domain guarantees, per-business currency with order snapshots). Verified storefront truth 2026-09-29: single vanilla page (`restaurant.html` shell + `restaurant.js` renderer + `storefront.css`) with header/hero, category navigation, live search, product grids and cards, persistent cart bar, cart/checkout overlay with pickup/delivery toggle, WhatsApp order path, booking entry, share, skeleton loader with offline/retry states, Arabic-default RTL with English toggle, localStorage cart. This task refines that surface; it rebuilds nothing.

## Clarifications

### Session 2026-09-29

- Q: Should live search stay on every storefront, or only where the menu needs it? → A: Everywhere (search stays on every storefront exactly as today; no per-menu or per-business gating).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Customer understands the business in seconds (Priority: P1)

A first-time visitor on a phone immediately sees what the business is
and whether they can order: name, logo/cover where available,
open/closed status, short description, and location/contact information.

**Why this priority**: Orientation precedes everything; a confused
visitor never reaches the menu.

**Independent Test**: Can be fully tested by loading any business
storefront on a small screen and confirming identity, status, and
contact are visible without scrolling past the first screen or opening
any menu.

**Acceptance Scenarios**:

1. **Given** any supported business type, **When** its storefront loads,
   **Then** name, logo/cover (where set), open/closed status,
   description (where set), and location/contact (where set) are
   presented together at the top.
2. **Given** a closed business, **When** its storefront loads, **Then**
   the closed state is unmistakable before any ordering control.

---

### User Story 2 - Customer finds and picks products with minimal friction (Priority: P2)

The customer browses categories, searches, and reads product cards that
make availability and price (in the business currency) obvious, then
adds items with clear feedback.

**Why this priority**: Discovery-to-cart is the core conversion path
for every business type.

**Independent Test**: Can be fully tested by finding a product via
scroll, category, and search each, adding it, and confirming price,
availability state, and cart feedback at every step.

**Acceptance Scenarios**:

1. **Given** a menu with categories, **When** the customer navigates,
   **Then** category switching is obvious, fast, and keeps position
   without losing the cart.
2. **Given** a search term, **When** entered, **Then** matching products
   filter live with a clear empty state when nothing matches.
3. **Given** any product, **When** displayed, **Then** name, price in
   business currency, image where available, and availability state are
   unambiguous, and unavailable items cannot be added silently.

---

### User Story 3 - Customer checks out with total confidence (Priority: P3)

The cart stays simple and obvious, pickup/delivery selection is clear,
and the customer always knows the total cost before confirming as a
guest.

**Why this priority**: Total-cost clarity is the stated UX principle;
surprises at confirmation destroy trust.

**Independent Test**: Can be fully tested by building a mixed cart,
toggling pickup/delivery, and confirming subtotal, fee, total, and
confirmation requirements stay correct and visible throughout.

**Acceptance Scenarios**:

1. **Given** a non-empty cart, **When** viewed, **Then** items,
   quantities, subtotal, delivery fee (if delivery), and total in
   business currency are all visible with simple quantity controls.
2. **Given** pickup/delivery options, **When** toggled, **Then** totals
   update immediately and delivery-only requirements (address) appear
   only for delivery.
3. **Given** checkout confirmation, **When** submitted as a guest,
   **Then** the existing order flow completes unchanged with a tracking
   code.

---

### Edge Cases

- Business without logo, cover, description, or contact set: layout
  stays clean with graceful omission, never broken placeholders.
- Empty menu or empty category: clear messaging instead of blank
  space; search with no matches states it plainly.
- Unavailable product: visibly marked and non-orderable; never
  addable by keyboard, touch repetition, or rapid taps.
- Closed or outside-hours business: ordering controls disabled or
  clearly gated before cart investment.
- Offline or slow connection: skeleton then retry/offline states guide
  recovery without data loss of the local cart.
- Small screens and large text settings: layout remains usable with
  touch-sized controls and reachable cart.
- Right-to-left and English layouts: identity, navigation, cart, and
  totals read correctly in both directions.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every storefront MUST present business identity together
  at the top: name, logo/cover where available, open/closed status,
  description where available, location/contact where available.
- **FR-002**: Category navigation MUST work for all business types with
  obvious active state, position retention, and no cart loss.
- **FR-003**: Product cards MUST show name, price in the business
  currency, image where available, and availability state; unavailable
  products MUST be marked and MUST NOT be orderable through any input
  path.
- **FR-004**: Live search MUST filter products by name and description
  on every storefront with a clear empty state; no per-menu or
  per-business gating of search.
- **FR-005**: The cart MUST stay guest-default with visible items,
  quantities, subtotal, applicable fee, and total in business currency,
  plus simple quantity controls.
- **FR-006**: Pickup/delivery selection MUST be explicit with immediate
  total updates; delivery-gated fields MUST appear only for delivery.
- **FR-007**: Existing order functionality MUST be preserved end to
  end: submit, tracking code, tracking page, and server-side pricing.
- **FR-008**: Existing storefront URLs MUST keep working unchanged.
- **FR-009**: Arabic RTL and English behavior MUST both read correctly
  with no full internationalization system added.
- **FR-010**: Accessibility basics MUST hold: keyboard-operable
  controls with visible focus, touch-sized targets, live regions for
  cart/total updates, and no keyboard traps.
- **FR-011**: The storefront MUST stay fast on weak devices: no new
  heavy assets, no gratuitous animation, existing skeleton/offline
  resilience preserved.
- **FR-012**: Restivo visual identity MUST be preserved throughout;
  changes refine within the existing system only.

### Key Entities *(include if feature involves data)*

- **Storefront**: the single customer page per business (identity
  header, navigation, grids, cart, checkout overlay) rendered from the
  existing public view payload; no new data required.
- **Identity Block**: name, logo/cover, status, description, contact —
  all already in the public payload; presence-gated rendering only.
- **Product Card**: name, price with business currency context, image,
  availability — read-only presentation of existing fields.
- **Cart**: guest-local selection with server-priced confirmation;
  presentation refined, flow unchanged.

## Constraints & Out of Scope

- Do not rebuild the page, do not migrate to React, do not break URLs,
  do not add dependencies.
- Do NOT ship: product variants/modifiers (Task 5), pre-orders,
  customer accounts, loyalty/reviews/favorites, gratuitous animation,
  full internationalization, unrelated features.
- Reuse the existing renderer, styles, skeleton, i18n enhancement,
  and formatting helpers; extend, do not replace.

## Migration & Compatibility Expectations

- No data migration: presentation-only task.
- Existing URLs, public payloads, checkout contracts, carts stored
  locally, and booking entry behavior MUST work unchanged.
- Verification MUST cover: all supported business types, both
  languages, small screens, keyboard-only and touch use, offline/slow
  recovery, closed/empty/unavailable states, and currency-correct
  totals throughout.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time customer finds a product and completes guest
  checkout in under 3 minutes on a mid-range phone.
- **SC-002**: 100% of pre-Task-4 storefront checks (identity, browse,
  search, cart, pickup/delivery, submit, tracking) pass unchanged in
  behavior with improved presentation.
- **SC-003**: Identity, status, and contact are visible on first screen
  for 100% of tested businesses, including ones with missing optional
  assets.
- **SC-004**: 0 unavailable products are orderable via any input path
  (mouse, touch, keyboard, rapid repeat).
- **SC-005**: 100% of shown totals match server-confirmed totals in the
  business currency across cart, toggle, and confirmation steps.
- **SC-006**: All interactive controls are keyboard-reachable with
  visible focus and operable at 200% text scaling without loss.

## Assumptions

- Verified baseline: header/hero, categories, search, cards, cart bar,
  checkout overlay, pickup/delivery toggle, WhatsApp path, booking
  entry, share, skeleton/offline, RTL+English, localStorage cart all
  exist and are reused.
- Public payload already carries every identity, product, currency,
  and availability field this task presents; no API change assumed.
- Tests run against a disposable database via an explicit test target,
  never production, per existing practice.
