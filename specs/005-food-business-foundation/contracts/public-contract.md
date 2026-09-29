# Public Contracts (additive-only delta)

Base: `server/routes/public.routes.js` + `server/routes/site.routes.js`. All existing shapes unchanged; clients MUST ignore unknown fields.

## `GET /api/restaurants` (directory)

- Change: each entry gains read-only `business_type` (one of the 9 closed values, default `restaurant`).
- Compat: additive field; old clients ignore it.

## `GET /api/restaurants/:slug/menu` (storefront view)

- Already returns `settings.currency` (uppercase ISO) consumed by `fmtMoney`.
- Change: gains read-only `business_type` alongside existing `settings`, `categories`, `items`, `hours`.
- Pre-order reserve: item objects keep current shape (`id`, `name`, `price_cents`, `is_available`, …). A future availability expression MUST be additive; current clients MUST tolerate unknown item fields, and checkout MUST NOT trust them.

## `POST /api/restaurants/:slug/orders` (guest checkout)

- No shape change. Server recomputes totals/fees from DB cents, ignores client money/currency, re-validates `is_active`, `status`, hours, subscription, and `delivery_enabled` at write time. Same 201 + tracking-code envelope; same non-enumerating 404 for missing/inactive.

## `GET /api/orders/track/:code`, `POST /api/orders/cancel`, bookings, pricing, restaurant-requests, offer preview

- No shape change in this feature.

## `robots.txt` / `sitemap.xml` / `/r/:slug`

- Unchanged: marketing + `/restaurant/` allowed; `/api/`, admin/owner/delivery/leads, `/offer/` disallowed; sitemap = static pages + ≤500 active businesses. Private pages stay `noindex`.
