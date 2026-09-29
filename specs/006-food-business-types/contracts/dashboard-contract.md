# Dashboard Contracts (additive-only delta)

Task 1 public contracts (`specs/005-food-business-foundation/contracts/`) stand unchanged.

## `GET /api/admin/restaurant` (admin dashboard self-view)

- Change: response `restaurant` object gains read-only `businessType` (constrained value, default `restaurant`), alongside existing id/slug/name/status/maxMenuItems/itemCount.
- Compat: additive field; old clients ignore it. Tenant-scoped as before.

## `GET /api/owner/restaurants` (owner console listing)

- No shape change (Task 1 already exposes `businessType` per row). Task 2 renders it as a table cell using existing escaping.

## `GET /api/owner/restaurants/:id` (owner detail)

- No shape change (Task 1 already exposes `businessType`).

## `PATCH /api/admin/settings` (tenant settings)

- No shape change: `businessType` is not an accepted field and is silently ignored, preserving owner-only mutation. Locked by test, not by new validation behavior.

## Storefront views (menu, directory, pages)

- No change: payload `businessType` remains additive ignored data; no badge or label is rendered on any customer-facing page.
