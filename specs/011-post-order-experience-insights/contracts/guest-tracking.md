# Contract: Guest Tracking (Task 9)

**Base**: existing `GET /api/orders/track/:code`, `POST /api/orders/cancel`, `POST /api/restaurants/:slug/orders`. No shape breakage; additive display fields only.

## Polling contract (clarified polling-only)

- Client polls `GET /api/orders/track/:code` on a visibility-aware cadence (existing 15s baseline, pause when `document.hidden`, immediate refresh on visible + manual refresh control, stop on `completed|cancelled`).
- `code` normalized client-side (trim, UPPERCASE); server matches case-insensitively; invalid format → same uniform `404 {message: 'No order found for this tracking code'}` (no enumeration).
- Tracking projection fields: `code, status, order_type, restaurant_name, restaurant_slug, created_at, currency, subtotal_cents, delivery_fee_cents, total_cents, items[{menu_item_id, item_name, quantity, unit_price_cents, line_total_cents, options[{choice_name, quantity}], is_preorder, preorder_note}]`. No internal ids, no other-tenant data.

## Timeline projection (client)

- Pickup flow: `pending → confirmed → preparing → ready → completed`. Delivery flow: `pending → confirmed → preparing → ready → out_for_delivery → completed`. `cancelled` renders as terminal (stops polling, hides cancel).
- Any line with `is_preorder` shows the pre-order badge + frozen `preorder_note`.

## Confirmation contract (extends `renderSuccess`)

- Renders from server response + track projection: code, type badge, lines with options, subtotal/fee/total in frozen currency, pre-order notes, timing, next steps (keep code, track link `/track.html?code=...` and `/track?code=...` deep link both valid).
- Never renders client-estimated money.

## Reorder contract (live-definition rebuild)

- Outbound: `?reorder=<menu_item_id:qty:<choiceId x qty;...>,...>` — extends today's `id:qty` format additively (old links still parse; unknown segments ignored with notice).
- Inbound: resolve each id against live definitions; keep only `is_available` items and valid choices; current prices apply; dropped/changed entries listed plainly in AR+EN. Stale money never applied.

## Error states

Invalid/cancelled/unavailable code, unavailable restaurant, offline: plain-language message + next action (re-enter, contact restaurant via existing WhatsApp link, retry). No PII, no internals.
