# Contract: Notifications Foundation (Task 11)

**Rule**: order writes never wait for channels. `emit()` runs after commit, non-blocking; channel failure is contained (`failed/skipped` row + diagnosable log without PII).

## Emitter interface (new `notifications.service.js`)

- `emit({restaurantId, type: 'order.created|order.status_changed', orderId, orderCode, status?, occurredAt?}) → eventKey` — persists one `notification_events` row per subscribed channel (idempotent on `eventKey`), then fans out asynchronously.
- Call sites (wrapping, not rewriting): after `createCheckout` commit → `order.created`; after `changeStatus`/`cancelByCustomer` commit → `order.status_changed`. No order-transaction code moves.
- `eventKey` format: `order.created:<orderId>` / `order.status:<orderId>:<status>:<updatedAtMs>`. Redelivery of the same key collapses to one visible notification per channel.

## Channel interface

- `registerChannel(name, {send(event) → 'delivered|failed|skipped'})`. Channels in phase: `dashboard_sse` (active). Placeholders: `push_future` (default-off, foundation only), `email_future|sms_future` (not built).
- Every `send` receives only its business's events (`restaurantId` checked at emit and at dispatch). No cross-tenant delivery, ever.

## Dashboard SSE channel (preserved)

- Events: `order:new` (payload `{code, orderType, totalCents, currency, isPreorder}` — minimal, detail fetched via authed reads), `order:status` (payload `{code, status}`), delivered through existing `GET /api/admin/events` (`retry: 5000`, `:ping` 25s). Client reconnects automatically; missed events covered by list refresh on reconnect + persisted rows for audit.
- Transport (`server/middleware/sse.js`) unchanged or thin-wrapped.

## Failure/dedup policy

- Duplicate emit (retried request, replayed hook) → same `eventKey` → single row per channel, single visible notification.
- Disconnected dashboard → row stays `pending`, marked on reconnect catch-up; never blocks checkout/status.
- Push channel while disabled → `skipped`, no error surface to owners or guests.

## Web Push readiness (foundation only)

- `push_subscriptions` table + VAPID config points + default-off flag + permission-UX hook points exist; setup documented in `quickstart.md`. No live send path enabled; no credentials invented.
