# Contract: Plans (platform-admin reads, minimal management)

**Auth**: platform role only (`owner`; staff only where the existing panel already permits). Tenant targeting is explicit and validated; owners of restaurants get `403`. Guards: existing global limiter + `originGuard`; `{ error: { code, message } }` envelope. These endpoints expose commercial metadata, never credential or customer data.

## GET /api/owner/plans — list plans

Success `200`:

```json
{
  "plans": [
    { "key": "standard", "name": "Standard", "description": "…", "isActive": true,
      "priceCents": 1999, "currency": "USD", "period": "month",
      "trialEligible": true, "capabilities": { "preorders": true, "advanced_analytics": false },
      "limits": { "max_menu_items": 30 } }
  ]
}
```

- `capabilities`/`limits` are the plan's mapping rows (matrix vocabulary only; unknown keys impossible by write-time validation).
- Inactive plans are included with `isActive: false` (history transparency; new assignments prefer active).

## GET /api/owner/plans/:key — single plan with mappings

Success `200`: one plan object shaped as above. Errors: `404 NOT_FOUND` for unknown keys.

## POST /api/owner/plans — create plan (rare; future tiers)

Body: `{ key, name, description?, priceCents, currency, period, trialEligible?, entitlements? }` — same money/period/currency rules as the existing platform-pricing validator (cents ≥ 0, ISO-3, month|year).

Success `201`: the created plan object. Errors: `400` validation (including unknown capability keys or negative limits), `409 DUPLICATE` for an existing key.

## PATCH /api/owner/plans/:key — edit plan (price/description/active flag)

Body: any subset of `{ name, description, priceCents, currency, period, isActive, entitlements }`. Key is immutable.

Success `200`: the updated plan. Price changes apply to future assignments and renewals only — never retroactively to running periods. Errors: `400` validation · `404` unknown key.

## Reuse note

Public price display (`GET /api/pricing`, pricing page, owner pricing card) is unchanged and keeps reading `platform_settings`; the seeded plan mirrors those values at migration time rather than replacing the source.
