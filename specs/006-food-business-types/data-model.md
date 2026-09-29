# Data Model: Food Business Types (Task 2)

**Feature**: `specs/006-food-business-types/spec.md` | **Date**: 2026-09-29
No schema delta on the Task 1 baseline. Internal names unchanged.

## Entities (Task 1 schema, Task 2 domain guarantees)

### Food Business (existing `restaurants` row; Task 1 column reused)

- `business_type TEXT NOT NULL DEFAULT 'restaurant'` with closed CHECK (9 values covering the 6 required kinds: restaurant, cafe, bakery, dessert shop, home kitchen, cloud kitchen, plus cake_business, home_food_business, small_food_business).
- Identity/slug, status lifecycle, active flag, subscription window: unchanged.
- Read default: missing/legacy rows read as `restaurant`; unknown values rejected at write, never stored.

### Business Type (constrained value, not a table)

- Validation: closed set enforced in validator (400 naming the field) and DB CHECK. Extension path: later scoped task admits a value (validator + additive migration); no forks.
- Mutation: platform-owner routes only (create/update). Tenant admin settings path provably type-free; type immutable from customer side.
- Visibility: owner list/detail payloads plus admin `myRestaurant` payload (new in Task 2); rendered in owner table and admin overview; never badged on customer storefronts.

### Capability Profile (configuration, no new storage)

- Core four mapped to existing fields (unchanged from Task 1): products → categories/menu_items; pickup/delivery → `delivery_enabled`/`delivery_fee_cents`/`order_type`; hours → `restaurant_hours`/`ignore_opening_hours`; availability → `is_available`/status/active/subscription.
- Bookings and analytics stay type-agnostic (out of scope).

### Customer / Order / Fulfillment (unchanged)

- Guest model, integer-cents server-side pricing, snapshots, pickup/delivery lifecycle, tracking codes: exactly Task 1 behavior.

## Tenancy and security notes

- Type rides the tenant root; all scoping still by session-derived `restaurant_id`. Display additions expose only already-authorized rows.
