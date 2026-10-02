'use strict';

/**
 * Self-service signup: one atomic transaction creates the owner account
 * (role='admin') plus a real tenant business with settings, 7 hour rows,
 * trial clock, and in-progress onboarding state. No partial rows survive
 * failure; client-sent plan/capability/tenant claims never reach here
 * (rejected by validateSignup).
 */

const { withTx } = require('../db/pool');
const { conflict } = require('../utils/errors');
const { normalizeSlug, withSlugSuffix } = require('../utils/checks');
const { resolveSignupType } = require('../validators');
const users = require('./users.service');
const platform = require('./platform.service');

const MAX_SLUG_ATTEMPTS = 100;

async function resolveFreeSlug(client, base) {
  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
    const slug = withSlugSuffix(base, attempt);
    const dupe = await client.query('SELECT 1 FROM restaurants WHERE slug = $1', [slug]);
    if (dupe.rowCount === 0) return slug;
  }
  const err = conflict('SLUG_TAKEN', 'No free address variant is available; try a different name');
  err.details = { suggestion: null };
  throw err;
}

/**
 * @returns {{ user, restaurant, trialEndsAt }}
 */
async function signup({ email, username, password, businessName, businessType, slug }) {
  const hash = await users.hashPassword(password);
  const storedType = resolveSignupType(businessType);

  return withTx(async (client) => {
    const base = slug || normalizeSlug(businessName);
    const freeSlug = await resolveFreeSlug(client, base);

    const pricing = await platform.getPricing().catch(() => ({ trial_days: 7 }));
    const trialDays = Number.isInteger(pricing.trial_days) ? pricing.trial_days : 7;
    const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString();

    let restaurant;
    try {
      const { rows } = await client.query(
        `INSERT INTO restaurants
           (name, slug, business_type, subscription_ends_at, onboarding_status, onboarding_step)
         VALUES ($1, $2, $3, $4, 'in_progress', 'info')
         RETURNING *`,
        [businessName, freeSlug, storedType, trialEndsAt]
      );
      restaurant = rows[0];
    } catch (err) {
      if (err.code === '23505') throw conflict('SLUG_TAKEN', 'This store address is taken');
      throw err;
    }

    await client.query(
      'INSERT INTO restaurant_settings (restaurant_id) VALUES ($1)',
      [restaurant.id]
    );
    for (let day = 0; day < 7; day++) {
      await client.query(
        'INSERT INTO restaurant_hours (restaurant_id, day_of_week) VALUES ($1, $2)',
        [restaurant.id, day]
      );
    }

    // Trial subscription in the same transaction: identity first, then the
    // commercial record — never an orphan either way. UNIQUE blocks doubles.
    const planRes = await client.query(`SELECT id FROM plans WHERE key = 'standard'`);
    if (planRes.rows[0]) {
      const now = new Date().toISOString();
      await client.query(
        `INSERT INTO subscriptions
           (restaurant_id, plan_id, status, trial_started_at,
            current_period_start, current_period_end, grace_until)
         VALUES ($1, $2, 'trial', $3, $3, $4, ($4::timestamptz + INTERVAL '7 days'))`,
        [restaurant.id, planRes.rows[0].id, now, trialEndsAt]
      );
    }

    let userRow;
    try {
      const { rows } = await client.query(
        `INSERT INTO users (role, restaurant_id, username, email, password_hash)
         VALUES ('admin', $1, $2, $3, $4)
         RETURNING id, role, username, email, restaurant_id, is_active, created_at`,
        [restaurant.id, username, email || null, hash]
      );
      userRow = rows[0];
    } catch (err) {
      // Same safe message for email/username collisions (no account enumeration).
      if (err.code === '23505') throw conflict('DUPLICATE', 'An account with these details already exists');
      throw err;
    }

    console.log('[signup] account+created', restaurant.slug, storedType);
    return { user: users.publicUser(userRow), restaurant, trialEndsAt };
  });
}

module.exports = { signup, MAX_SLUG_ATTEMPTS };
