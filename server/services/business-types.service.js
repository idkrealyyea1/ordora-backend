'use strict';

/**
 * Central business-type profiles (spec 013 FR-008/015/016). One object per
 * stored business_type value; the ONLY place type-specific UX differences
 * are defined. Callers consume profiles — no `if businessType ===` branches.
 *
 * Capability keys named here are the vocabulary owned by
 * capabilities.service.js (matrix authority); profiles only reference them.
 */

const PROFILES = {
  restaurant: {
    flow: ['setup', 'product', 'fulfillment', 'hours', 'review'],
    terminology: { productLabelKey: 'bt_product_dish' },
    defaults: { fulfillment: 'both', categoriesPolicy: 'suggest-none', hoursHintKey: 'bt_hours_standard' },
    relevantCaps: ['storefront', 'products', 'orders', 'pickup', 'delivery', 'sharing', 'qr', 'basic_analytics'],
    optionalCaps: ['product_images', 'preorders', 'custom_notes', 'advanced_analytics'],
    dashboardEmphasis: ['orders', 'menu', 'analytics', 'settings'],
    checklist: ['add_first_items', 'set_hours', 'share_store'],
    helpKeys: ['bt_help_menu_first'],
  },
  cafe: {
    flow: ['setup', 'product', 'fulfillment', 'hours', 'review'],
    terminology: { productLabelKey: 'bt_product_drink' },
    defaults: { fulfillment: 'pickup', categoriesPolicy: 'suggest-drinks', hoursHintKey: 'bt_hours_standard' },
    relevantCaps: ['storefront', 'products', 'orders', 'pickup', 'sharing', 'qr', 'basic_analytics', 'product_images'],
    optionalCaps: ['delivery', 'preorders'],
    dashboardEmphasis: ['orders', 'menu', 'settings'],
    checklist: ['add_first_drinks', 'set_hours', 'share_store'],
    helpKeys: ['bt_help_quick_ordering'],
  },
  bakery: {
    flow: ['setup', 'product', 'fulfillment', 'hours', 'review'],
    terminology: { productLabelKey: 'bt_product_baked' },
    defaults: { fulfillment: 'pickup', categoriesPolicy: 'suggest-none', hoursHintKey: 'bt_hours_preorder' },
    relevantCaps: ['storefront', 'products', 'orders', 'pickup', 'preorders', 'sharing', 'qr', 'basic_analytics', 'product_images'],
    optionalCaps: ['delivery', 'custom_notes'],
    dashboardEmphasis: ['orders', 'menu', 'settings'],
    checklist: ['add_first_products', 'enable_preorders', 'set_hours', 'share_store'],
    helpKeys: ['bt_help_preorder_timing'],
  },
  dessert_shop: {
    flow: ['setup', 'product', 'fulfillment', 'hours', 'review'],
    terminology: { productLabelKey: 'bt_product_dessert' },
    defaults: { fulfillment: 'pickup', categoriesPolicy: 'suggest-none', hoursHintKey: 'bt_hours_preorder' },
    relevantCaps: ['storefront', 'products', 'orders', 'pickup', 'preorders', 'custom_notes', 'sharing', 'qr', 'product_images'],
    optionalCaps: ['delivery', 'basic_analytics'],
    dashboardEmphasis: ['orders', 'menu', 'settings'],
    checklist: ['add_first_products', 'enable_preorders', 'set_hours', 'share_store'],
    helpKeys: ['bt_help_preorder_timing', 'bt_help_custom_notes'],
  },
  cake_business: {
    flow: ['setup', 'product', 'fulfillment', 'hours', 'review'],
    terminology: { productLabelKey: 'bt_product_dessert' },
    defaults: { fulfillment: 'pickup', categoriesPolicy: 'suggest-none', hoursHintKey: 'bt_hours_preorder' },
    relevantCaps: ['storefront', 'products', 'orders', 'pickup', 'preorders', 'custom_notes', 'sharing', 'qr', 'product_images'],
    optionalCaps: ['delivery', 'basic_analytics'],
    dashboardEmphasis: ['orders', 'menu', 'settings'],
    checklist: ['add_first_products', 'enable_preorders', 'set_hours', 'share_store'],
    helpKeys: ['bt_help_preorder_timing', 'bt_help_custom_notes'],
  },
  home_kitchen: {
    flow: ['product', 'fulfillment', 'hours', 'review'],
    terminology: { productLabelKey: 'bt_product_home' },
    defaults: { fulfillment: 'both', categoriesPolicy: 'suggest-none', hoursHintKey: 'bt_hours_simple' },
    relevantCaps: ['storefront', 'products', 'orders', 'pickup', 'sharing', 'qr'],
    optionalCaps: ['delivery', 'preorders', 'product_images', 'basic_analytics'],
    dashboardEmphasis: ['orders', 'menu'],
    checklist: ['add_first_products', 'share_store'],
    helpKeys: ['bt_help_keep_simple'],
  },
  home_food_business: {
    flow: ['product', 'fulfillment', 'hours', 'review'],
    terminology: { productLabelKey: 'bt_product_home' },
    defaults: { fulfillment: 'both', categoriesPolicy: 'suggest-none', hoursHintKey: 'bt_hours_simple' },
    relevantCaps: ['storefront', 'products', 'orders', 'pickup', 'sharing', 'qr'],
    optionalCaps: ['delivery', 'preorders', 'product_images', 'basic_analytics'],
    dashboardEmphasis: ['orders', 'menu'],
    checklist: ['add_first_products', 'share_store'],
    helpKeys: ['bt_help_keep_simple'],
  },
  cloud_kitchen: {
    flow: ['setup', 'product', 'fulfillment', 'hours', 'review'],
    terminology: { productLabelKey: 'bt_product_dish' },
    defaults: { fulfillment: 'delivery', categoriesPolicy: 'suggest-none', hoursHintKey: 'bt_hours_standard' },
    relevantCaps: ['storefront', 'products', 'orders', 'delivery', 'delivery_groups', 'basic_analytics', 'sharing'],
    optionalCaps: ['pickup', 'product_images', 'preorders', 'advanced_analytics'],
    dashboardEmphasis: ['orders', 'analytics', 'settings', 'menu'],
    checklist: ['add_first_items', 'set_delivery', 'set_hours', 'share_store'],
    helpKeys: ['bt_help_delivery_ops'],
  },
  small_food_business: {
    flow: ['product', 'fulfillment', 'hours', 'review'],
    terminology: { productLabelKey: 'bt_product_generic' },
    defaults: { fulfillment: 'both', categoriesPolicy: 'suggest-none', hoursHintKey: 'bt_hours_simple' },
    relevantCaps: ['storefront', 'products', 'orders', 'pickup', 'sharing', 'qr', 'basic_analytics'],
    optionalCaps: ['delivery', 'preorders', 'product_images', 'custom_notes'],
    dashboardEmphasis: ['orders', 'menu', 'settings'],
    checklist: ['add_first_products', 'set_hours', 'share_store'],
    helpKeys: ['bt_help_keep_simple'],
  },
};

/* Public chooser: six named kinds plus the `other` fallback (clarified 2026-10-02). */
const CHOOSER = [
  { key: 'restaurant', nameKey: 'bt_restaurant', descKey: 'bt_restaurant_d', icon: '🍽' },
  { key: 'cafe', nameKey: 'bt_cafe', descKey: 'bt_cafe_d', icon: '☕' },
  { key: 'bakery', nameKey: 'bt_bakery', descKey: 'bt_bakery_d', icon: '🥖' },
  { key: 'dessert_shop', nameKey: 'bt_dessert_dessert', descKey: 'bt_dessert_d', icon: '🍰' },
  { key: 'home_kitchen', nameKey: 'bt_home', descKey: 'bt_home_d', icon: '🏠' },
  { key: 'cloud_kitchen', nameKey: 'bt_cloud', descKey: 'bt_cloud_d', icon: '🛵' },
  { key: 'other', nameKey: 'bt_other', descKey: 'bt_other_d', icon: '🍴' },
];

const ICONS = { restaurant: '🍽', cafe: '☕', bakery: '🥖', dessert_shop: '🍰', cake_business: '🎂', home_kitchen: '🏠', home_food_business: '🏠', cloud_kitchen: '🛵', small_food_business: '🍴' };

function getProfile(businessType) {
  return PROFILES[businessType] || PROFILES.small_food_business;
}

module.exports = { PROFILES, CHOOSER, ICONS, getProfile };
