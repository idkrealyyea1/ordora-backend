# Research: Product Options (Task 5)

**Feature**: `specs/009-product-options/spec.md` | **Date**: 2026-09-29
Verified against menu/order services, validators, and migrations on 2026-09-29.

## R1 — How definitions are stored

- **Decision**: Normalized `option_groups` + `option_choices` tables scoped by tenant and product, mirroring the `categories`/`menu_items` pattern.
- **Rationale**: Definitions are queried (per-item attach), constrained (pick bounds, modes, money), and managed (CRUD) — all cheap in tables, awkward in blobs. Matches the codebase's money-path convention (normalized) while JSONB stays confined to the leads domain where it already lives.
- **Alternatives considered**:
  - JSONB column on `menu_items` → rejected: unconstrainable pick rules, unqueryable tenant reports, diverges from money-path norms.
  - Separate per-type tables → rejected: fork machinery contradicting FR-005 and Constitution XIX.

## R2 — How replace vs adjust is modeled

- **Decision**: `pricing` mode on the group (`replace` single-pick enforced by CHECK; `adjust` otherwise) with one `price_cents` per choice interpreted by mode.
- **Rationale**: Directly encodes the clarification with one column and one constraint instead of two parallel price semantics.
- **Alternatives considered**: Separate variant/extra tables → rejected: doubles CRUD, validation, snapshot, and UI paths for one semantic bit.

## R3 — How snapshots survive definition edits

- **Decision**: Normalized `order_item_options` rows with frozen names/prices plus nullable definition references (same pattern as `menu_item_id ON DELETE SET NULL`).
- **Rationale**: Deletions keep history complete and readable; references preserve traceability while frozen copies preserve truth. Proven pattern, zero invention.
- **Alternatives considered**: Cascading snapshot deletes → rejected: destroys order history (violates FR-002/FR-009). Fully embedded JSON snapshot → rejected: inconsistent with order paths, harder per-line reporting.

## R4 — How much expressiveness groups get

- **Decision**: `is_required`, `min_picks`/`max_picks`, per-choice `max_quantity` (1–99), availability flags. No conditional logic, no cross-group rules, no price formulas.
- **Rationale**: Covers size/add-on/topping examples with integers; anything richer is the configurator the brief forbids.
- **Alternatives considered**: Rule engine with expressions → rejected: out-of-scope complexity with no customer mandate.

## R5 — Where validation and pricing live

- **Decision**: Entirely in the existing checkout transaction: scope-check definitions to tenant, enforce required/min/max/availability, compute from stored prices ignoring client money, write snapshots atomically.
- **Rationale**: Single trust boundary, race-safe under the existing tenant row lock, no new transaction machinery.
- **Alternatives considered**: Client-computed totals re-checked server-side → rejected: reintroduces the exact trust violation FR-008 bans.
