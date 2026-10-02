# Research: Post-Order Experience Insights

**Feature**: `specs/011-post-order-experience-insights/spec.md` | **Date**: 2026-09-30

All unknowns below were resolved either by inspecting the working tree (code/migrations/tests win) or by the 2026-09-30 clarification session. No NEEDS CLARIFICATION remains.

## R1: Guest realtime transport — polling-only, no guest SSE channel

- **Decision**: Guests stay on improved polling (visibility-aware cadence, manual refresh, offline states). No anonymous SSE/push channel is built. Owner dashboard keeps authenticated SSE.
- **Rationale**: The only SSE entrypoint (`GET /api/admin/events`) requires an authenticated restaurant session; a code-scoped guest stream would be a new anonymous authorization surface plus per-order fan-out on a single-node in-process hub. Polling the existing `GET /api/orders/track/:code` (uniform 404, no PII) reuses proven security and scales with existing rate limits.
- **Alternatives considered**: Code-scoped guest SSE → rejected (new attack surface, hub has no per-order auth); WebSocket → rejected (new infra, violates simplicity XI/XII); manual-refresh-only → rejected (worse UX than visibility-aware polling).

## R2: New-order prominence — visual-only, no sound

- **Decision**: Highlight + pending badge count + new-first ordering in the existing orders board; no audio alert, no push-style overlay.
- **Rationale**: Impossible to miss at a glance, needs no permissions/assets/mute controls, works on silent phones in noisy kitchens, trivially RTL-safe.
- **Alternatives considered**: Optional sound with mute → rejected (asset + autoplay-policy + annoyance risk for marginal gain); browser Notification API without push → rejected (permission friction; deferred to Web Push future).

## R3: Notification reliability — persisted per-event records with retention

- **Decision**: `emit(domainEvent)` writes a minimal `notification_events` row (idempotency key, delivery state per channel) outside the order transaction (after commit, non-blocking); channels dedup on the key; retention cleanup deletes old rows.
- **Rationale**: Survives restarts (a missed dinner-rush alert is the costliest failure), makes "exactly one visible notification per event per channel" testable, and gives reconnect catch-up without a broker. Order writes never wait for channels.
- **Alternatives considered**: In-memory dedup only → rejected (restart loses state; prior persistent attempt was reverted for different reasons — scope, not the table itself); full outbox-with-relay → rejected (relay worker is new infra; overkill at this scale).

## R4: Web Push — foundation + docs, no live push

- **Decision**: Build subscription storage shape, VAPID config points, default-off flag, and permission-UX hook points; document missing production pieces; claim nothing.
- **Rationale**: Brief explicitly permits documenting rather than inventing credentials; dashboard SSE already covers the urgent alert; avoids fake readiness and unneeded dependency review.
- **Alternatives considered**: Full Web Push now → rejected (needs production VAPID keys + iOS/Android verification unavailable here); dropping push-readiness → rejected (would force later rewrite of order logic; abstraction is cheap now).

## R5: Analytics periods — presets plus bounded custom range

- **Decision**: Today / last 7 / last 30 presets plus a custom `from/to` picker; server-validated (`from ≤ to`, max span reuses 90-day convention, valid calendar dates, tz-aware day boundaries); same exact-aggregation queries; zero-filled series.
- **Rationale**: User chose custom in clarification; bounding keeps queries and UX within the existing `days=1–90` cost envelope and preserves the nontechnical simplicity brief.
- **Alternatives considered**: Presets-only → rejected by user choice; unbounded custom → rejected (query-cost and UX complexity risk).

## R6: Confirmation/reorder data source — server-confirmed + live definitions

- **Decision**: Confirmation renders from the `POST .../orders` response merged with the frozen track projection; reorder resolves `menu_item_id:quantity` PLUS selected option `choiceId:quantity` pairs against live definitions, dropping (and listing) unavailable/changed entries.
- **Rationale**: Verified in tree: `renderSuccess(data.order)` today shows code+total only and reorder URL carries only `id:qty` (`track.js:99-100`, `restaurant.js:708-717` ignores malformed). Server money rule means live-definition rebuild is the only safe reorder.
- **Alternatives considered**: Blind replay of frozen lines → rejected (violates server-price rule, resurrects deleted options).

## R7: Analytics correctness — per-currency grouping, parent-line product counts

- **Decision**: Revenue/AOV grouped by frozen `orders.currency` (no conversion, no mixed totals); product metrics count parent `order_items` rows with option revenue rolled into the parent line; status/type/preorder splits are separate `GROUP BY` dimensions.
- **Rationale**: Directly extends Task 3 (`022_orders_currency`) and Task 5 snapshot model; matches existing `revenueByCurrency`/`exportRows` patterns in `orders.service.js`.
- **Alternatives considered**: Converted single-currency totals → rejected (FX out of scope, dishonest); counting option rows as products → rejected (double counts, corrupts top-sellers).
