'use strict';

/**
 * Onboarding progress reads/writes. Progress itself lives in the real rows
 * (products, hours, settings); only the wizard position marker
 * (onboarding_status/onboarding_step) lives on the restaurant. Tenant id
 * always comes from the session — never from arguments the client controls.
 */

const { query } = require('../db/pool');
const { AppError } = require('../utils/errors');
const observe = require('../utils/observe');
const businessTypes = require('./business-types.service');

const STEP_ORDER = ['type', 'info', 'setup', 'product', 'fulfillment', 'hours', 'review', 'done'];

async function getBusiness(restaurantId) {
  const { rows } = await query(
    `SELECT id, name, slug, business_type, onboarding_status, onboarding_step,
            subscription_ends_at
     FROM restaurants WHERE id = $1`,
    [restaurantId]
  );
  return rows[0] || null;
}

function snapshotFor(business, { hasProduct }) {
  const completed = business.onboarding_status === 'completed';
  const idx = Math.max(0, STEP_ORDER.indexOf(business.onboarding_step));
  const total = STEP_ORDER.length - 1; // exclude 'done'
  const next = completed ? [] : STEP_ORDER.slice(Math.min(idx + 1, total), total);
  const stepSeen = (s) => completed || STEP_ORDER.indexOf(s) <= idx;
  return {
    business: {
      id: business.id,
      name: business.name,
      slug: business.slug,
      businessType: business.business_type,
    },
    onboardingStatus: business.onboarding_status,
    onboardingStep: business.onboarding_step,
    completeness: completed ? 100 : Math.round((idx / total) * 100),
    next,
    configured: {
      hasProduct,
      fulfillmentSet: stepSeen('fulfillment'),
      hoursSet: stepSeen('hours'),
    },
    storefrontUrl: `/restaurant/${business.slug}`,
  };
}

async function getState(restaurantId) {
  const business = await getBusiness(restaurantId);
  if (!business) throw new AppError(404, 'NO_BUSINESS', 'No business is linked to this account');
  const { rows } = await query('SELECT COUNT(*)::int AS n FROM menu_items WHERE restaurant_id = $1', [restaurantId]);
  return snapshotFor(business, { hasProduct: rows[0].n > 0 });
}

async function setStep(restaurantId, step) {
  const business = await getBusiness(restaurantId);
  if (!business) throw new AppError(404, 'NO_BUSINESS', 'No business is linked to this account');
  if (business.onboarding_status !== 'completed') {
    await query('UPDATE restaurants SET onboarding_step = $2 WHERE id = $1', [restaurantId, step]);
    observe.info('onboarding.step', { restaurantId, slug: business.slug, step });
    return getState(restaurantId);
  }
  return getState(restaurantId);
}

/** Finish gate: the review step must have been reached (product count is NOT a gate). */
async function complete(restaurantId) {
  const business = await getBusiness(restaurantId);
  if (!business) throw new AppError(404, 'NO_BUSINESS', 'No business is linked to this account');
  if (business.onboarding_status === 'completed') return finishedPayload(business);
  if (business.onboarding_step !== 'review') {
    const idx = STEP_ORDER.indexOf(business.onboarding_step);
    const missing = STEP_ORDER.slice(Math.min(idx + 1, STEP_ORDER.length - 1), STEP_ORDER.length - 1);
    const err = new AppError(409, 'INCOMPLETE_SETUP', 'Setup is not finished yet');
    err.details = { missing };
    throw err;
  }
  await query(
    `UPDATE restaurants SET onboarding_status = 'completed', onboarding_step = 'done' WHERE id = $1`,
    [restaurantId]
  );
  observe.info('onboarding.completed', { restaurantId, slug: business.slug });
  return finishedPayload({ ...business, onboarding_status: 'completed' });
}

function finishedPayload(business) {
  const storeUrl = `/restaurant/${business.slug}`;
  return {
    onboardingStatus: 'completed',
    storefrontUrl: storeUrl,
    dashboardUrl: '/admin.html',
    share: { url: storeUrl, qrUrl: '/api/admin/qr' },
  };
}

async function getProfile(restaurantId) {
  const business = await getBusiness(restaurantId);
  if (!business) throw new AppError(404, 'NO_BUSINESS', 'No business is linked to this account');
  return { businessType: business.business_type, ...businessTypes.getProfile(business.business_type) };
}

module.exports = { getState, setStep, complete, getProfile, STEP_ORDER };
