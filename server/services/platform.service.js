'use strict';
const { query } = require('../db/pool');

async function getPricing() {
  try {
    const { rows } = await query('SELECT pricing_cents, pricing_currency, pricing_period, trial_days, brand_name, max_hero_images FROM platform_settings WHERE id=1');
    if (!rows[0]) return { pricing_cents: 1999, pricing_currency: 'USD', pricing_period: 'month', trial_days: 7, brand_name: 'Restivo', max_hero_images: 6 };
    return {
      pricing_cents: rows[0].pricing_cents,
      pricing_currency: rows[0].pricing_currency,
      pricing_period: rows[0].pricing_period,
      trial_days: rows[0].trial_days,
      brand_name: rows[0].brand_name,
      max_hero_images: rows[0].max_hero_images ?? 6,
    };
  } catch (_) {
    return { pricing_cents: 1999, pricing_currency: 'USD', pricing_period: 'month', trial_days: 7, brand_name: 'Restivo', max_hero_images: 6 };
  }
}

async function updatePricing(patch) {
  const sets = [];
  const params = [1];
  const map = {
    pricingCents: 'pricing_cents',
    pricingCurrency: 'pricing_currency',
    pricingPeriod: 'pricing_period',
    trialDays: 'trial_days',
    brandName: 'brand_name',
  };
  for (const [k, col] of Object.entries(map)) {
    if (patch[k] !== undefined) {
      params.push(patch[k]);
      sets.push(`${col} = $${params.length}`);
    }
  }
  if (sets.length === 0) return getPricing();
  const { rows } = await query(`UPDATE platform_settings SET ${sets.join(', ')} WHERE id=$1 RETURNING pricing_cents, pricing_currency, pricing_period, trial_days, brand_name`, params);
  return {
    pricing_cents: rows[0].pricing_cents,
    pricing_currency: rows[0].pricing_currency,
    pricing_period: rows[0].pricing_period,
    trial_days: rows[0].trial_days,
    brand_name: rows[0].brand_name,
  };
}

module.exports = { getPricing, updatePricing };
