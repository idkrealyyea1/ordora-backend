# Journey Contracts (additive-only delta)

Tasks 1–5 contracts stand except where noted.

## Public menu view (per item)

- Change: items gain read-only `is_preorder` and `preorder_note`. Normal items carry `false`/`''`.

## `POST /api/restaurants/:slug/orders` (guest checkout)

- No request shape change. Response order lines gain read-only pre-order flags where applicable; stale pre-order claims refused with safe errors; idempotency spans all line kinds.

## Tracking and dashboards (per order line)

- Change: lines expose snapshot `is_preorder`/`preorder_note`; timeline annotates pre-order orders without new steps or states.

## Admin management (tenant-scoped)

- Change: item create/update accept optional pre-order flag + message under existing gates and envelope conventions.

## Statuses, SSE, and currency

- No change: 7 enforced statuses, best-effort events with refetch truth, snapshot currency context all stand.
