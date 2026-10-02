# Contract: Owner Orders Board (Task 10)

**Base**: existing `GET /api/admin/orders[?status=&page=&limit=]`, `GET /api/admin/orders/:id`, `PATCH /api/admin/orders/:id/status {status}`, dashboard pending list, SSE `order:new` / `order:status` refresh. No shape breakage.

## List contract

- Ordering: `pending` first (newest first within status), then other action-needed states, then today's completed/cancelled; history paginated as today (`page/limit`, default `limit=20`).
- Each row: code, status badge, kind badges (`pickup|delivery`, `pre-order` when any line `is_preorder`), customer name, total + currency, created time. Delivery rows always carry address in detail; pickup rows never show address UI.
- New arrivals via `order:new`: visual-only prominence (row highlight, pending badge count, new-first insert). No sound.

## Detail contract

- Full operational fields: customer name, phone/WhatsApp (+click-to-chat link), type, address (delivery only), items with variants/modifiers/quantities/notes, subtotal, delivery fee, total + currency, pre-order flag + frozen timing note, created/updated timestamps.
- History renders identical frozen snapshots regardless of later menu edits.

## Status-change contract

- Offered actions = valid next transitions from the existing map only (delivery gate on `out_for_delivery` preserved).
- Request: `PATCH /orders/:id/status {status}`; same-status → safe no-op success; invalid jump → `409` with plain message; concurrent/double submits → single transition.
- All reads/writes tenant-scoped (`req.user.restaurant_id`; platform-owner path explicit as today).
