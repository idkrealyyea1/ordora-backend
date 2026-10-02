# Data Model: Post-Order Experience Insights

**Feature**: `specs/011-post-order-experience-insights/spec.md` | **Date**: 2026-09-30

Existing tables/columns from Tasks 1–8 are reused unchanged. Only two new tables (both additive, nullable-safe, default-off) are introduced. All money stays integer cents; all snapshots stay frozen.

## Reused entities (no schema change)

- **orders** (`id`, `restaurant_id`, `code UNIQUE`, customer fields, `order_type pickup|delivery`, `status` 7-state, `subtotal/delivery/total_cents`, `currency` frozen per Task 3, `submission_key UNIQUE(restaurant_id,submission_key)`, `created_at`, `archived_at`): source for confirmation, tracking projection, owner detail, notification events, analytics.
- **order_items** (`order_id FK CASCADE`, `menu_item_id FK SET NULL`, `item_name`, `unit_price_cents`, `quantity`, `line_total_cents`, `is_preorder`, `preorder_note`, `created_at`): parent lines for product analytics; preorder flag/message carrier.
- **order_item_options** (group/choice snapshot names + `unit_price_cents`, `quantity`, `line_total_cents`): roll revenue into parent line; never counted as products.
- **menu_items / option_groups / option_choices** (live definitions): reorder rebuild source; availability/pricing truth.
- **restaurants / restaurant_settings / restaurant_hours**: identity, currency default, delivery fee, open-now gating (read-only in this phase).

### Lifecycle (reused, unchanged)

`pending → confirmed|preparing|cancelled`, `confirmed → preparing|cancelled`, `preparing → ready|cancelled`, `ready → out_for_delivery|completed|cancelled` (delivery-only gate on `out_for_delivery`), `out_for_delivery → completed|cancelled`. Same-status writes are no-ops; terminal states immutable. Customer cancel only `pending|confirmed` within grace, atomic.

## New entities

### notification_events (dedup + catch-up log)

One row per domain event per channel attempt. Written AFTER the order transaction commits, non-blocking; failures here never roll back orders.

- `id UUID PK`, `restaurant_id UUID FK CASCADE NOT NULL` (tenant scope + index), `event_key TEXT NOT NULL UNIQUE` (e.g. `order.created:<order_id>` / `order.status:<order_id>:<status>:<updated_at>` — single visible notification per key per channel), `event_type TEXT NOT NULL` (`order.created|order.status_changed`), `order_id UUID NULL FK SET NULL`, `order_code TEXT NULL`, `status TEXT NULL`, `channel TEXT NOT NULL` (`dashboard_sse|push_future|...`), `state TEXT NOT NULL DEFAULT 'pending'` (`pending|delivered|failed|skipped`), `attempts INT NOT NULL DEFAULT 0`, `created_at TIMESTAMPTZ DEFAULT now()`, `updated_at TIMESTAMPTZ`.
- Indexes: `(restaurant_id, created_at)`, `(event_key)`, `(state, created_at)` for retention cleanup.
- Retention: periodic delete of rows older than N days (small constant, e.g. 30) — cleanup query only, no order data touched.
- Validation: `event_type`/`channel` allowlisted in service; `restaurant_id` mandatory; payload columns minimal (no customer PII beyond what the channel already receives).

### push_subscriptions (Web Push-ready shape, default-off)

Stored but NOT activated in this phase (no live push; config documented in quickstart).

- `id UUID PK`, `restaurant_id UUID FK CASCADE NULL` (NULL = future guest subscriptions if ever enabled; owner/staff rows carry business id), `endpoint TEXT NOT NULL UNIQUE`, `p256dh TEXT NOT NULL`, `auth TEXT NOT NULL`, `is_active BOOL DEFAULT TRUE`, `created_at/updated_at TIMESTAMPTZ`.
- Feature flag: push sending code paths default off until VAPID keys configured; subscription capture UI hidden until enabled.

## Derived projections (no new tables)

- **Guest tracking projection**: `{code, status, order_type, is_preorder-any, restaurant_name/slug, created_at, currency, items[{menu_item_id, item_name, quantity, unit/line cents, options[], is_preorder, preorder_note}], subtotal/delivery/total_cents}` — customer-safe subset of `getByCode`, uniform 404 otherwise.
- **Owner operational order**: full row + items/options snapshots + timestamps + allowed next transitions (computed from transition map, not stored).
- **Analytics reading**: `{period{from,to,tz}, totals{orders, completed, cancelled, revenueCents per currency}, averageOrderValueCents per currency, pickupVsDelivery{...}, statusSplit{...}, preorderSplit{normal,preorder}, series[{day,orders,revenueCents,currency}], topItems[{menu_item_id,name,qty,revenueCents}], byDayOfWeek, byHour}` — exact aggregation, zero-filled days, empty → zeros + plain message.

## Relationships

`restaurants 1—* orders 1—* order_items 1—* order_item_options`; `menu_items 1—* option_groups 1—* option_choices` (live, parallel to snapshots); `orders 1—* notification_events` (logical; `SET NULL` on delete); `restaurants 1—* push_subscriptions`.

## Migration notes

Single migration `025_notifications.sql`: `CREATE TABLE IF NOT EXISTS` both tables + indexes + retention-function comment; safe defaults; re-runnable no-op; rollback = `DROP TABLE IF EXISTS` (no order data affected). No alteration of any existing table meaning.
