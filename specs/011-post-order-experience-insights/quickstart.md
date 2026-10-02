# Quickstart: Post-Order Experience Insights

**Feature**: `specs/011-post-order-experience-insights/spec.md` | Contracts: `contracts/` | Data model: `data-model.md`

Proves Tasks 9–12 end to end on a disposable database. Never run against production.

## Prerequisites

```bash
npm ci
cp .env.example .env   # set SESSION_SECRET (>=32 chars); no prod credentials
createdb restaurants_test
export TEST_DATABASE_URL=postgresql://localhost:5432/restaurants_test
node database/migrate.js   # re-runnable; 025 applies as no-op on repeat
npm run check              # 0 failures required before any validation
```

## Task 9 — Guest confirmation, tracking, reorder

1. Seed one business with a normal item, a pre-order item with options, and delivery enabled; open its storefront on a phone viewport (AR, then EN).
2. Check out a mixed delivery cart as guest → expect confirmation with code, type badge, lines + options, subtotal/fee/total in business currency, pre-order note, timing, and next steps (keep code + track link).
3. Follow the track link (`/track.html?code=...` and `/track?code=...`) → expect kind-correct timeline (6-step delivery), frozen totals, cancel + reorder actions, no login.
4. Advance status as owner (`pending → confirmed → preparing`) → expect guest view correct within the polling interval; toggle offline/online + tab visibility → expect graceful reconnect, no order corruption.
5. Reorder with one item since deleted and one option since repriced → expect live-definition rebuild with plain notice of dropped/changed entries; totals match fresh server values.
6. Try bad codes (`abc`, wrong-case, 13 chars), cancelled-order tracking, and unknown code → expect helpful messages, uniform 404, no PII.

## Task 10 — Owner operations board

1. With dashboard open, place two orders (delivery + pre-order) → expect visual-only prominence (highlight, pending count, new-first) within seconds, full detail (contact, address on delivery only, items/options/notes, fees, currency, pre-order timing).
2. `PATCH /orders/:id/status` through each valid transition; attempt an invalid jump and a double-submit → expect `409` on invalid, single correct state on duplicates, history showing frozen snapshots after menu edits.
3. As a second business's admin, attempt to read/advance the first business's order (incl. `?restaurantId=` swap) → expect denial; platform-owner explicit path still works.

## Task 11 — Notifications foundation

1. Close the dashboard, place an order, change status twice (replay one event) → expect order + transitions persisted; on reconnect the board catches up with exactly one visible notification per event; `notification_events` rows show `delivered` with matching `event_key`s.
2. Disable/break all channels (stop SSE consumer) → checkout + status updates still succeed; rows marked `failed/skipped` with diagnosable logs, no customer data leaked.
3. Confirm Web Push foundation: `push_subscriptions` table exists, sending flag default-off, setup docs below followed — no live push claimed.
4. Cross-tenant check: events for business A never reach business B's stream.

### Web Push production setup (required later, not in this phase)

1. Generate VAPID keys offline; set `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` + contact `VAPID_SUBJECT` in production env (never commit keys).
2. Set `PUSH_ENABLED=1` (sending stays off unless `PUSH_ENABLED=1` AND `VAPID_PUBLIC_KEY` are both set — see `PUSH_ENABLED` in `server/services/notifications.service.js`).
3. Flip the push flag on; capture a subscription in a supporting browser; verify one `order.created` produces one push to the owning business only.
4. iOS/Android permission UX must be verified on-device before claiming readiness.

### Notification retention ops note

- `notification_events` rows older than `RETENTION_DAYS` (30) are removed by `cleanupOld()` in `server/services/notifications.service.js`. Run it from a periodic job or ops console; it touches no order data. Verify: `SELECT COUNT(*) FROM notification_events WHERE state = 'failed'` should stay small; failures never block orders.

## Task 12 — Analytics insights

1. With orders spanning pickup/delivery, completed/cancelled, normal/pre-order, and (if available) a currency change: open analytics for today, 7d, 30d, and a custom `from/to` range → expect exact counts, per-currency revenue (no conversion, no mixed totals), per-currency AOV, pickup/delivery + status + preorder splits, zero-filled series, option-safe top items.
2. Hand-check one period with direct SQL (`GROUP BY day/status/order_type/currency`, parent-line product counts) → expect exact match.
3. Invalid ranges (`from > to`, span > 90d, bad dates, `days` + `from/to` combined) → expect `400` with plain message; new business with no orders → plain zero state.
4. Kill the analytics query path (or empty result) → ordering, tracking, and the rest of the dashboard keep working.

## Regression gates

```bash
TEST_DATABASE_URL=$TEST_DATABASE_URL node --test tests/
```

Existing suites (orders, lifecycle-matrix, journey-*, options-*, currency-*, storefront-*, tenant-isolation, subscription-gate) must stay green; new suites (`journey-confirmation`, `operations-board`, `notifications-foundation`, `analytics-insights`) cover the contracts above. Never weaken tests to pass.
