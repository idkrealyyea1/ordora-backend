# Contract: Idempotent Checkout

**Route**: `POST /api/restaurants/:slug/orders` (existing; guest, rate-limited by `orderLimiter`)

> Reality note (Task 17 audit): this mechanism already exists end-to-end and
> is verified, not built, by this phase — `submission_key UUID` (migration
> `019_booking_overlap.sql`, per-business `UNIQUE (restaurant_id,
> submission_key)`), `validateCheckout` UUID check, in-transaction
> replay-or-insert in `createCheckout`, per-attempt key with retry reuse in
> `client/js/restaurant.js`.

## Request

| Channel | Name | Required | Format | Notes |
|---------|------|----------|--------|-------|
| Body | `submissionKey` | No (strongly recommended) | UUID v4 | Identifies one checkout intent across retries; `NULL`/absent preserves legacy one-row-per-request behavior; malformed → 400, no order |
| Body | existing checkout payload | Yes | unchanged | Name, contact, order type, items; any client-sent money/ownership values ignored as today |

Client behavior (`client/js/restaurant.js`): one UUID per checkout attempt (`crypto.randomUUID()`), reused across retries of that attempt, cleared on success so a new order mints a fresh key.

## Responses

- `201` first submission → created order (`{order:{code,status,totalCents}}` as today).
- `201` replay of a seen `(restaurant, key)` → the original order, same `code` and snapshot totals, no second row created.
- `400` malformed key or checkout validation failure → no order created.
- `403` closed/expired-subscription/business-unavailable → as today.
- `429` rate-limited → existing envelope.

## Guarantees

- Uniqueness scope is per business (`UNIQUE (restaurant_id, submission_key)`): the same key at a different `:slug` creates a distinct order.
- Key-less requests behave exactly as today (one row per request; `NULL` keys never collide).
- Cross-tenant probe: replaying business B's key against business A's slug never resolves to B's order (denied / not-found, no data leaked).
