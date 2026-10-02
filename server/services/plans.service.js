'use strict';

/**
 * Data-driven SaaS plans + entitlement mappings. Plans never branch feature
 * code: features ask capabilities.service ("can this business perform X?"),
 * which reads these mappings. Unknown capability keys are rejected here so
 * the matrix vocabulary stays the single authority (owned there).
 */

const { query, withTx } = require('../db/pool');
const { conflict, notFound } = require('../utils/errors');
const { CAPABILITIES } = require('./capabilities.service');

const MATRIX_KEYS = new Set(CAPABILITIES.map((c) => c.key));
/* Numeric-limit entitlement keys (limit_value path; enforced where the underlying feature lives). */
const LIMIT_KEYS = new Set(['max_menu_items']);

function assertKnownKey(key) {
  if (!MATRIX_KEYS.has(key) && !LIMIT_KEYS.has(key)) {
    const { badRequest } = require('../utils/errors');
    throw badRequest(`Unknown entitlement key: ${key}`, [{ field: 'entitlements' }]);
  }
}

function toPublicPlan(row, entitlements) {
  const capabilities = {};
  const limits = {};
  for (const e of entitlements || []) {
    if (LIMIT_KEYS.has(e.capability_key)) {
      if (e.limit_value !== null && e.limit_value !== undefined) limits[e.capability_key] = e.limit_value;
    } else {
      capabilities[e.capability_key] = e.allowed;
    }
  }
  return {
    key: row.key,
    name: row.name,
    description: row.description,
    isActive: row.is_active,
    priceCents: row.price_cents,
    currency: row.currency,
    period: row.period,
    trialEligible: row.trial_eligible,
    capabilities,
    limits,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getEntitlementRows(planId) {
  const { rows } = await query(
    'SELECT capability_key, allowed, limit_value FROM plan_entitlements WHERE plan_id = $1',
    [planId]
  );
  return rows;
}

async function listPlans() {
  const { rows } = await query('SELECT * FROM plans ORDER BY created_at ASC');
  const out = [];
  for (const row of rows) out.push(toPublicPlan(row, await getEntitlementRows(row.id)));
  return out;
}

async function getPlan(key) {
  const { rows } = await query('SELECT * FROM plans WHERE key = $1', [key]);
  if (!rows[0]) return null;
  return toPublicPlan(rows[0], await getEntitlementRows(rows[0].id));
}

async function getPlanRow(key) {
  const { rows } = await query('SELECT * FROM plans WHERE key = $1', [key]);
  return rows[0] || null;
}

async function writeEntitlements(client, planId, entitlements) {
  for (const [key, rule] of Object.entries(entitlements)) {
    assertKnownKey(key);
    if (LIMIT_KEYS.has(key)) {
      await client.query(
        `INSERT INTO plan_entitlements (plan_id, capability_key, allowed, limit_value)
         VALUES ($1, $2, TRUE, $3)
         ON CONFLICT (plan_id, capability_key)
         DO UPDATE SET allowed = TRUE, limit_value = $3`,
        [planId, key, rule.limit === undefined ? null : rule.limit]
      );
    } else {
      await client.query(
        `INSERT INTO plan_entitlements (plan_id, capability_key, allowed, limit_value)
         VALUES ($1, $2, $3, NULL)
         ON CONFLICT (plan_id, capability_key)
         DO UPDATE SET allowed = $3, limit_value = NULL`,
        [planId, key, rule.allowed]
      );
    }
  }
}

async function createPlan(data) {
  return withTx(async (client) => {
    let row;
    try {
      const { rows } = await client.query(
        `INSERT INTO plans (key, name, description, price_cents, currency, period, trial_eligible)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [data.key, data.name, data.description, data.priceCents, data.currency, data.period, data.trialEligible]
      );
      row = rows[0];
    } catch (err) {
      if (err.code === '23505') throw conflict('DUPLICATE', 'A plan with this key already exists');
      throw err;
    }
    await writeEntitlements(client, row.id, data.entitlements);
    console.log('[plans] created', row.key);
    return getPlan(data.key);
  });
}

async function updatePlan(key, patch) {
  return withTx(async (client) => {
    const sets = [];
    const params = [key];
    const map = { name: 'name', description: 'description', priceCents: 'price_cents', currency: 'currency', period: 'period', isActive: 'is_active', trialEligible: 'trial_eligible' };
    for (const [k, col] of Object.entries(map)) {
      if (patch[k] !== undefined) {
        params.push(patch[k]);
        sets.push(`${col} = $${params.length}`);
      }
    }
    // Price edits apply to future assignments/renewals only — running periods untouched.
    if (sets.length > 0) {
      params.push(new Date().toISOString());
      await client.query(`UPDATE plans SET ${sets.join(', ')}, updated_at = $${params.length} WHERE key = $1`, params);
    }
    if (patch.entitlements !== undefined) {
      const { rows } = await client.query('SELECT id FROM plans WHERE key = $1', [key]);
      if (!rows[0]) return null;
      await writeEntitlements(client, rows[0].id, patch.entitlements);
    }
    console.log('[plans] updated', key);
  }).then(() => getPlan(key));
}

module.exports = { listPlans, getPlan, getPlanRow, getEntitlementRows, createPlan, updatePlan, toPublicPlan, LIMIT_KEYS };
