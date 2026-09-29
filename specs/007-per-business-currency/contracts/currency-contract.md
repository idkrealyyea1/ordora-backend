# Currency Contracts (additive-only delta)

Task 1 public contracts and Task 2 dashboard contracts stand except where noted.

## `POST /api/restaurants/:slug/orders` (guest checkout)

- No request shape change. Response order gains read-only `currency` (snapshot). Server-side totals and snapshot written atomically from the locked settings row.

## `GET /api/orders/track/:code` (tracking)

- Change: amounts labeled with the order's snapshot currency instead of the live setting. Values identical for never-changed businesses.

## Admin/owner order views and analytics

- Change: revenue figures gain per-currency grouping as additive fields; existing totals retained. History groups by snapshot, so past revenue never relabels.

## `PATCH /api/admin/settings` (business admin)

- No shape change: `currency` accepts any ISO-3 code (400 otherwise); UI offers the prepared eight. This is the sole change path.

## `POST /api/owner/restaurants` (creation)

- No shape change: optional `currency` initial default (ISO-3, defaults USD).

## `PATCH /api/owner/restaurants/:id` (owner update)

- Change: `currency` no longer proxied to settings (business-admin path owns mutation); a carried currency value is ignored per mass-assignment tolerance.
