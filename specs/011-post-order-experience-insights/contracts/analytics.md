# Contract: Analytics Insights (Task 12)

**Base**: existing `GET /api/admin/dashboard`, `GET /api/admin/analytics?days=`, `GET /api/admin/reports/orders.csv`, `GET /api/owner/overview`. Additive params/fields only.

## Request contract

- Presets: `?preset=today|7d|30d` (default `7d` if omitted, preserving current default behavior).
- Custom: `?from=YYYY-MM-DD&to=YYYY-MM-DD` (inclusive, business-timezone day boundaries). Server-validated: valid dates, `from ≤ to`, span ≤ 90 days, else `400` with plain message. `from/to` and `days` are mutually exclusive (`400` if combined).
- All queries scoped by authenticated `restaurant_id`; owner overview unchanged (platform-level, per-currency as today).

## Response contract (extends current shape)

```json
{
  "period": {"from": "2026-09-01", "to": "2026-09-30", "timezone": "Asia/Amman"},
  "totals": {"orders": 0, "completed": 0, "cancelled": 0, "revenueByCurrency": {"USD": 0}},
  "averageOrderValueByCurrency": {"USD": 0},
  "pickupVsDelivery": {"pickup": 0, "delivery": 0},
  "statusSplit": {"pending": 0, "confirmed": 0, "preparing": 0, "ready": 0, "out_for_delivery": 0, "completed": 0, "cancelled": 0},
  "preorderSplit": {"normal": 0, "preorder": 0},
  "series": [{"day": "2026-09-01", "orders": 0, "revenueByCurrency": {}}],
  "topItems": [{"menu_item_id": "uuid", "name": "...", "quantity": 0, "revenueCents": 0}],
  "byDayOfWeek": [0, 0, 0, 0, 0, 0, 0],
  "byHour": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
}
```

## Aggregation rules (binding)

- Exact set-based SQL; one row per order for order metrics; option lines roll revenue into their parent `order_items` row and are never counted as products.
- Money grouped by frozen `orders.currency`; no conversion; no unlabeled mixed-currency totals; AOV computed per currency only.
- `series` zero-filled for every day in range; empty periods return zeros (never null, never estimates).
- CSV export unchanged in shape (frozen currency + options summary columns as today); period filter reusable if trivially applicable, otherwise unchanged.

## UX contract

- Numbers first, few simple visuals, no BI jargon; AR+EN strings for every new label; analytics failure renders a plain empty/error card and never breaks ordering, tracking, or the rest of the dashboard.
