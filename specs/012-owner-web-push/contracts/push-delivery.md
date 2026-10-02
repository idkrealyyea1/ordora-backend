# Contract: Push Delivery (order.created fan-out)

**Rule**: order writes never wait for push. `emit()` stays non-throwing; push outcomes are per-subscription rows; SSE behavior byte-identical.

## Fan-out (inside `notifications.service.js` `push` sender)

- Trigger: `order.created` events only (status changes never enter the push sender).
- Recipients: `SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE restaurant_id = $1 AND is_active` — indexed per-business lookup, nothing else.
- One HTTPS send per subscription with bounded concurrency; payload `{ title, body(code + business), tag: eventKey, url, business }`, TTL capped (e.g. 24h so stale alerts don't haunt replaced phones).
- Outcome mapping: sent → `delivered`; gone/invalid endpoint (authoritative rejection) → deactivate subscription + `failed`; transient error → `failed` with no retry (recovery on next event); channel disabled → `skipped`.
- Dedup: existing per-channel claim (`eventKey:push`) — replays collapse before any send.

## SSE coexistence (unchanged, verified by test)

- `order:new` broadcast, visual highlight, pending badge, ordering, and reconnect reconcile behave identically with push enabled, disabled, or broken.
- No event is ever routed to push *instead of* SSE; the two channels consume the same domain event independently.

## Failure containment

- Push sender throws nothing outward; every failure path ends in a recorded row state.
- Deactivation is limited to the failing subscription row; other devices, SSE, checkout, and status updates proceed normally.
