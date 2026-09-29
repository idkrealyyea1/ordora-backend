# Data Model: Per-Business Currency (Task 3)

**Feature**: `specs/007-per-business-currency/spec.md` | **Date**: 2026-09-29
Single-column delta on the Tasks 1–2 baseline. Internal names unchanged.

## Entities

### Business Currency (existing `restaurant_settings.currency`; no schema change)

- `TEXT NOT NULL DEFAULT 'USD'` with ISO-3 CHECK; single active value per business; mutated by business admin via settings; initial default set at creation.
- UI presents the prepared eight (ILS, USD, EUR, GBP, JOD, SAR, AED, EGP); storage accepts any ISO-3 so future codes need no model change.

### Money Amount (unchanged integer cents)

- `menu_items.price_cents`, `orders.*_cents`, `order_items.*_cents`, `delivery_fee_cents`, revenue aggregates, CSV cent figures. Arithmetic currency-agnostic; never converted, never reformatted in storage.

### Order Snapshot (existing lines + new `orders.currency`)

- New: `orders.currency TEXT` — snapshot of the business currency at checkout, backfilled for history from each order's business settings, then ISO-constrained with `'USD'` default.
- Existing line snapshots (`item_name`, `unit_price_cents`, quantities, line totals) unchanged.
- Reads: tracking, order views, and revenue aggregates prefer the snapshot; the live-settings join remains only as rollback fallback.

### Prepared Currency Set (UI data, not schema)

- Eight-code list rendered in admin settings and owner create inputs; extension = list addition.

### Currency Context (presentation rule, not storage)

- Every presented figure carries its code (menu, cart, tracking, dashboards, analytics, exports); cross-tenant aggregates group per currency.

## Validation and transitions

- Write-time: ISO-3 rule on settings and snapshot paths; unknown codes 400; missing → safe default.
- No state machine changes; order lifecycle untouched.

## Tenancy and security

- Snapshot sourced from the tenant's own locked checkout row; mutation paths stay session-gated and validated; display additions expose only authorized rows.
