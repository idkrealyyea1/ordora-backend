# Data Model: Product Options (Task 5)

**Feature**: `specs/009-product-options/spec.md` | **Date**: 2026-09-29
Three-table additive delta. Internal names unchanged.

## New entities

### Option Group (`option_groups`)

- `id` UUID PK; `restaurant_id` FK cascade; `menu_item_id` FK cascade; `name` (1–60, unique per item); `is_required BOOLEAN DEFAULT FALSE`; `min_picks INT DEFAULT 0`; `max_picks INT DEFAULT 1`; `pricing TEXT DEFAULT 'adjust'` ∈ {replace, adjust}; `position`; timestamps.
- CHECKs: `max_picks >= 1`; `min_picks BETWEEN 0 AND max_picks`; `required ⟺ min_picks ≥ 1` expressed as `CHECK ((NOT is_required AND min_picks = 0) OR (is_required AND min_picks >= 1))`; replace-mode groups single-pick (`CHECK (pricing <> 'replace' OR max_picks = 1)`).
- Indexes: `(restaurant_id)`, `(menu_item_id, position)`; unique `(menu_item_id, name)`.

### Choice (`option_choices`)

- `id` UUID PK; `group_id` FK cascade; `restaurant_id` FK cascade (denormalized for tenant-fast scoping, mirrors items pattern); `name` (1–60, unique per group); `price_cents INT >= 0` (full price in replace mode, adjustment otherwise); `max_quantity INT 1–99 DEFAULT 1`; `is_available BOOLEAN DEFAULT TRUE`; `position`; timestamps.

### Order Snapshot (`order_item_options`)

- `id` UUID PK; `order_item_id` FK cascade; `group_id`/`choice_id` nullable FKs `ON DELETE SET NULL`; frozen `group_name`, `choice_name`, `unit_price_cents >= 0`, `quantity > 0`, `line_total_cents >= 0`; `created_at`.
- Index on `(order_item_id)`.

## Existing entities (unchanged shapes, extended reads)

- **Product** (`menu_items`): untouched columns; reads attach `options[]`.
- **Order line** (`order_items`): untouched columns; unit/line math includes validated option contributions; reads attach `options[]` from snapshots.
- **Customer/Order/Fulfillment/Currency**: untouched; snapshots carry currency context as established.

## Validation and math (write-time, in-transaction)

- Scope: every referenced group/choice belongs to the checkout tenant and product, else rejected.
- Rules: required/min/max picks, availability, quantity bounds; client prices ignored.
- Math: unit = replace-pick price or base; plus Σ adjust `price_cents × choice_qty`; line = unit × item qty; all integer cents.

## Tenancy and security

- All definition reads/writes filter `restaurant_id` from session; checkout validates inside the locked tenant transaction; errors stay safe and field-named.
