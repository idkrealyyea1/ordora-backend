# Contract: Profiles & Capabilities (read-only)

**Auth**: public profile list for the chooser screen needs no session; effective-capability reads require the owner session (tenant derived server-side). These endpoints expose **visibility data only** — every gated write keeps its own server-side `requireCapability` check, so this output is never trusted by callers.

## GET /api/business-types — chooser content

Public `200`:

```json
{
  "types": [
    { "key": "restaurant", "nameKey": "bt_restaurant", "descKey": "bt_restaurant_d", "icon": "🍽" },
    { "key": "cafe", "nameKey": "bt_cafe", "descKey": "bt_cafe_d", "icon": "☕" },
    { "key": "bakery", "nameKey": "bt_bakery", "descKey": "bt_bakery_d", "icon": "🥖" },
    { "key": "dessert_shop", "nameKey": "bt_dessert", "descKey": "bt_dessert_d", "icon": "🍰" },
    { "key": "home_kitchen", "nameKey": "bt_home", "descKey": "bt_home_d", "icon": "🏠" },
    { "key": "cloud_kitchen", "nameKey": "bt_cloud", "descKey": "bt_cloud_d", "icon": "🛵" },
    { "key": "other", "nameKey": "bt_other", "descKey": "bt_other_d", "icon": "🍴" }
  ]
}
```

(`nameKey`/`descKey` resolve through the existing `i18n.js` DICT in `ar` + `en`; no commercial, tenant, or entitlement data here.)

## GET /api/onboarding/profile — this business's wizard profile

Session-required `200`:

```json
{
  "businessType": "bakery",
  "flow": ["setup", "product", "fulfillment", "hours", "review"],
  "terminology": { "productLabelKey": "t_product_bakery" },
  "defaults": { "fulfillment": "pickup", "categoriesPolicy": "suggest-none", "hoursHintKey": "h_bakery" },
  "relevantCaps": ["preorders", "pickup", "product_images"],
  "optionalCaps": ["delivery", "modifiers"],
  "dashboardEmphasis": ["orders", "menu", "settings"],
  "checklist": [{ "key": "add_first_product", "done": false }],
  "helpKeys": ["help_preorder_timing"]
}
```

## GET /api/onboarding/capabilities — effective capabilities + limits

Session-required `200` (evaluated live per request from type + entitlement + configuration; nothing here is stored):

```json
{
  "businessType": "home_kitchen",
  "entitlement": { "plan": "trial-placeholder", "trialEndsAt": "2026-10-09T00:00:00.000Z" },
  "capabilities": { "storefront": true, "products": true, "preorders": true, "delivery": false, "advanced_analytics": false },
  "limits": { "maxMenuItems": 30, "menuItemsUsed": 3, "canAddProduct": true }
}
```

- `entitlement.plan` is always the literal `"trial-placeholder"` in this feature; no commercial tier names exist yet.
- `delivery: false` above is illustrative (configuration-disabled via `delivery_enabled`); type support alone never implies availability.
- No entitlement internals beyond what the dashboard needs to render emphasis/disabled states.

Errors (both session endpoints): `401` unauthenticated · `404 NO_BUSINESS`.
