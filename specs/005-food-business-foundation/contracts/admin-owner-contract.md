# Admin / Owner Contracts (additive-only delta)

Base: `server/routes/admin.routes.js` (tenant-scoped) + `server/routes/owner.routes.js` (platform-gated). Auth, gating, and envelopes unchanged.

## `POST /api/owner/restaurants` (existing owner flow)

- Change: accepts optional `business_type` (closed 9, default `restaurant`) and optional `currency` (ISO-3, default USD).
- Validation: unknown type or malformed currency → 400 naming the field; missing → safe defaults. All other fields and behavior identical.

## `PATCH /api/owner/restaurants/:id`

- Change: accepts optional `business_type` and `currency` under the same rules. No other change.

## `PATCH /api/admin/settings` (tenant settings)

- No shape change: `currency` editing already supported and already wired to the admin form (`st-cur`). This plan only adds the owner creation-time path; edit semantics, validation, and per-tenant scoping are untouched.

## Tenant override (`?restaurantId=`)

- Unchanged: still requires `requireOwnerOrStaff` and is server-checked; type/currency attributes never widen it.
