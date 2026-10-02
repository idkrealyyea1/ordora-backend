'use strict';

/**
 * Central capability matrix + live evaluation (spec 013 FR-017/018/019/021,
 * extended by Task 14: plans feed the entitlement input).
 *
 * A feature is available only when:
 *   business type supports it AND the plan allows it AND the subscription
 *   state grants access AND the business configuration enables it.
 *
 * Nothing capability-derived is ever copied onto stored rows; every read
 * evaluates live, so plan/config/state changes take effect immediately.
 * Callers keep asking "can this business perform X?" — never plan names.
 */

const { query } = require('../db/pool');

const ALL_TYPES = [
  'restaurant', 'cafe', 'dessert_shop', 'bakery', 'cake_business',
  'home_kitchen', 'home_food_business', 'cloud_kitchen', 'small_food_business',
];

const CAPABILITIES = [
  { key: 'storefront', supportedTypes: ALL_TYPES, recommendedFor: ALL_TYPES, configKey: null, defaultOn: true, limitKind: null },
  { key: 'products', supportedTypes: ALL_TYPES, recommendedFor: ALL_TYPES, configKey: null, defaultOn: true, limitKind: 'count' },
  { key: 'categories', supportedTypes: ALL_TYPES, recommendedFor: ALL_TYPES, configKey: null, defaultOn: true, limitKind: null },
  { key: 'orders', supportedTypes: ALL_TYPES, recommendedFor: ALL_TYPES, configKey: null, defaultOn: true, limitKind: null },
  { key: 'pickup', supportedTypes: ALL_TYPES, recommendedFor: ALL_TYPES, configKey: null, defaultOn: true, limitKind: null },
  { key: 'delivery', supportedTypes: ALL_TYPES, recommendedFor: ['restaurant', 'cloud_kitchen'], configKey: 'delivery_enabled', defaultOn: true, limitKind: null },
  { key: 'delivery_groups', supportedTypes: ALL_TYPES, recommendedFor: ['cloud_kitchen', 'restaurant'], configKey: 'delivery_enabled', defaultOn: true, limitKind: null },
  { key: 'sharing', supportedTypes: ALL_TYPES, recommendedFor: ALL_TYPES, configKey: null, defaultOn: true, limitKind: null },
  { key: 'qr', supportedTypes: ALL_TYPES, recommendedFor: ALL_TYPES, configKey: null, defaultOn: true, limitKind: null },
  { key: 'basic_analytics', supportedTypes: ALL_TYPES, recommendedFor: ALL_TYPES, configKey: null, defaultOn: true, limitKind: null },
  { key: 'product_images', supportedTypes: ALL_TYPES, recommendedFor: ['bakery', 'dessert_shop', 'cake_business', 'cafe'], configKey: null, defaultOn: true, limitKind: null },
  { key: 'preorders', supportedTypes: ALL_TYPES, recommendedFor: ['bakery', 'dessert_shop', 'cake_business'], configKey: null, defaultOn: true, limitKind: null },
  { key: 'custom_notes', supportedTypes: ALL_TYPES, recommendedFor: ['dessert_shop', 'cake_business'], configKey: null, defaultOn: true, limitKind: null },
  // First plan-differentiated hook (Task 14): plans decide who gets this.
  { key: 'advanced_analytics', supportedTypes: ALL_TYPES, recommendedFor: [], configKey: null, defaultOn: false, limitKind: null },
];

function matrixEntry(key) {
  return CAPABILITIES.find((c) => c.key === key) || null;
}

function entitlementAllows(subscriptionEndsAt) {
  if (!subscriptionEndsAt) return true;
  return new Date(subscriptionEndsAt).getTime() > Date.now();
}

/**
 * Pure live evaluation. `business` = `{ businessType, subscriptionEndsAt,
 * settings, accessOn, planEnts }`:
 * - `accessOn === false` denies everything (expired/suspended/cancelled).
 * - `planEnts = { booleans: {key: bool} }` overrides matrix defaults per
 *   key; keys the plan does not mention keep their default.
 */
function can(business, key) {
  const entry = matrixEntry(key);
  if (!entry) return false;
  if (!entry.supportedTypes.includes(business.businessType)) return false;
  if (business.accessOn === false) return false;
  if (!entitlementAllows(business.subscriptionEndsAt)) return false;
  const planEnts = business.planEnts && business.planEnts.booleans;
  if (planEnts && Object.prototype.hasOwnProperty.call(planEnts, key)) {
    if (!planEnts[key]) return false;
  } else if (!entry.defaultOn) {
    return false;
  }
  if (entry.configKey === 'delivery_enabled') {
    if (business.settings && business.settings.delivery_enabled === false) return false;
  }
  return true;
}

/** Full effective set + numeric limits for one restaurant (live reads only). */
async function effectiveFor(restaurantId) {
  const { rows } = await query(
    `SELECT r.business_type, r.subscription_ends_at, r.max_menu_items,
            st.delivery_enabled, s.status AS sub_status,
            s.current_period_end, s.grace_until, s.cancel_effective_at,
            s.plan_id, p.key AS plan_key,
            (SELECT COUNT(*)::int FROM menu_items m WHERE m.restaurant_id = r.id) AS items_used
     FROM restaurants r
     LEFT JOIN restaurant_settings st ON st.restaurant_id = r.id
     LEFT JOIN subscriptions s ON s.restaurant_id = r.id
     LEFT JOIN plans p ON p.id = s.plan_id
     WHERE r.id = $1`,
    [restaurantId]
  );
  const row = rows[0];
  if (!row) return null;
  if (!row.plan_id) return null; // fail closed with a clear 404 (no silent full-access)

  // Lazy require: plans.service loads this module at boot (vocabulary check).
  const plans = require('./plans.service');
  const entRows = await plans.getEntitlementRows(row.plan_id);
  const booleans = {};
  const limits = {};
  for (const e of entRows) {
    if (e.limit_value !== null && e.limit_value !== undefined) limits[e.capability_key] = e.limit_value;
    else booleans[e.capability_key] = e.allowed;
  }

  const { derive } = require('./subscriptions.service');
  const eff = derive(
    {
      status: row.sub_status || 'active',
      current_period_end: row.current_period_end,
      grace_until: row.grace_until,
      cancel_effective_at: row.cancel_effective_at,
    },
    row.subscription_ends_at
  );
  const accessOn = ['trial', 'active', 'grace'].includes(eff.state);
  const business = {
    businessType: row.business_type || 'restaurant',
    subscriptionEndsAt: eff.accessEndsAt,
    settings: { delivery_enabled: row.delivery_enabled },
    accessOn,
    planEnts: { booleans },
  };
  const capabilities = {};
  for (const entry of CAPABILITIES) capabilities[entry.key] = can(business, entry.key);
  const maxMenuItems = limits.max_menu_items !== undefined ? limits.max_menu_items : row.max_menu_items;
  return {
    businessType: business.businessType,
    entitlement: { plan: row.plan_key, trialEndsAt: row.subscription_ends_at },
    capabilities,
    limits: {
      maxMenuItems,
      menuItemsUsed: row.items_used,
      canAddProduct: capabilities.products && row.items_used < maxMenuItems,
    },
  };
}

module.exports = { CAPABILITIES, ALL_TYPES, can, effectiveFor, entitlementAllows };
