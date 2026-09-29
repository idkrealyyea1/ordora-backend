# Data Model: Food Business Foundation

**Feature**: `specs/005-food-business-foundation/spec.md` | **Date**: 2026-09-29
Additive-only delta on the existing schema. Internal names unchanged (Food Business is product wording).

## Entity deltas

### Food Business (existing `restaurants` row; +1 attribute)

- Existing: `id` UUID PK, `slug` unique + format CHECK, `name`, `status` ∈ {open, closed, temporarily_closed}, `is_active`, `max_menu_items` 1–10000, `subscription_ends_at` NULL/future = active, timestamps.
- **New**: `business_type TEXT NOT NULL DEFAULT 'restaurant'` with `CHECK (business_type IN ('restaurant','cafe','dessert_shop','bakery','cake_business','home_kitchen','home_food_business','cloud_kitchen','small_food_business'))`.
- Relationships: 1:1 `restaurant_settings`; 1:N `users`, `categories`, `menu_items`, `orders`, `restaurant_hours`, `bookings`, `restaurant_delivery_groups`. Unchanged.
- Validation: closed set enforced in validator (400 on unknown) and DB CHECK; missing → default `restaurant`; unknown business type at read time → safe restaurant defaults, never an error page or cross-tenant leak.
- State transitions: `status` lifecycle and `is_active`/subscription gating unchanged; type never gates ordering by itself — capabilities do.

### Store (existing `restaurant_settings` 1:1; no schema change)

- Existing: description/contact/address/timezone/branding colors/`currency` (default USD, ISO-3 CHECK)/`delivery_fee_cents`/`ignore_opening_hours`/`delivery_enabled`/`name_en`.
- Change: creation path accepts optional `currency` (same ISO-3 rule); edit path already exists. Formatting stays presentation-only (`Intl`, fallback `toFixed + code`).
- Validation: 3-letter ISO; invalid → 400; missing → USD default preserved.

### Product (existing `categories` + `menu_items`; no schema change)

- Existing: category name 1–60 unique per tenant; item name 1–100, `price_cents` ≥ 0 integer, `is_available`, `is_popular`, `position`, optional image.
- Pre-order reserve: NO new fields. Availability semantics today (`is_available` + store status/hours/subscription) enforced at checkout write time, unchanged. Future availability expression is contract-tolerance only (see `contracts/public-contract.md`).

### Customer (guest; no table; unchanged)

- Lives on the order: name, whatsapp, optional phone/address, notes. No accounts in this feature.

### Order (existing `orders` + `order_items`; no schema change)

- Existing: public `code` unique; `order_type` ∈ {pickup, delivery}; integer `subtotal_cents`/`delivery_fee_cents`/`total_cents`; `status` lifecycle pending → confirmed → preparing → ready → (out_for_delivery | completed) with cancelled branches; `out_for_delivery` delivery-only; lines snapshot `item_name`/`unit_price_cents`/`quantity`/`line_total_cents` with `menu_item_id ON DELETE SET NULL`.
- Unchanged: server-side pricing from DB, client money ignored, snapshot at purchase, `FOR UPDATE OF r` serialization, revenue statuses exclude pending/cancelled.

### Fulfillment (pickup/delivery; unchanged)

- Gated by `delivery_enabled` per store; delivery fee per store; delivery-only statuses keep their guard.

### Analytics (unchanged)

- Existing aggregates over orders by business/status (counts, revenue, averages, CSV). No per-type pipelines.

## Capability map (core four → existing fields)

| Capability | Existing fields | Per-type behavior |
|---|---|---|
| Menu/products | `categories`, `menu_items`, `max_menu_items` | Same CRUD for all types; no per-type tables |
| Pickup/delivery | `delivery_enabled`, `delivery_fee_cents`, `order_type` | Types that do not deliver set `delivery_enabled=false`; delivery orders refused clearly |
| Hours | `restaurant_hours`, `ignore_opening_hours`, timezone | Same enforcement (`isOpenNow` server-side) for all types |
| Availability | `is_available`, `status`, `is_active`, subscription | Same write-time re-validation for all types |

## Tenancy and security notes

- Identity root unchanged (`users.restaurant_id` → session). New attributes ride the tenant row; no query widens scope.
- All money/availability/subscription checks remain server-side at write time from DB state.
