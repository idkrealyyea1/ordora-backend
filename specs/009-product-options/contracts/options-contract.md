# Options Contracts (additive-only delta)

Tasks 1–4 contracts stand except where noted.

## Public menu view (per item)

- Change: items gain read-only `options[]` with groups (name, required flag, pick bounds, pricing mode) and available choices (name, price, max quantity). Option-free items carry `options: []`.

## `POST /api/restaurants/:slug/orders` (guest checkout)

- Change: cart lines gain optional `selections[]` of `{groupId, choices:[{choiceId, quantity}]}`. Lines without selections behave exactly as before. Response order lines gain read-only `options[]` with names and prices; totals remain server-computed.

## Tracking, dashboards, exports (per order line)

- Change: lines expose snapshot `options[]` (group/choice names, unit prices, quantities, line contributions). Historical option-free lines unchanged.

## Admin management (tenant-scoped)

- New: group/choice CRUD under the existing admin gates with the same envelope and error conventions as categories/items. No new auth model.

## Storefront (per product with options)

- Change: picker controls with price context; invalid states block adding client-side with server re-validation; selections display in cart rows and confirmation. No new pages.
