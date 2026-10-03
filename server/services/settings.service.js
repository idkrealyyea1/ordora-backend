'use strict';

/**
 * Restaurant settings + opening hours.
 * All writes are whitelisted field-by-field (mass-assignment safe).
 */

const { query, withTx } = require('../db/pool');
const { notFound } = require('../utils/errors');
const { isOpenNow, timeToHhmm } = require('../utils/datetime');

function toPublicSettings(row) {
  return {
    description: row.description,
    phone: row.phone,
    whatsapp: row.whatsapp,
    address: row.address,
    timezone: row.timezone,
    logoPath: row.logo_path,
    coverPath: row.cover_path,
    nameEn: row.name_en || '',
    primaryColor: row.primary_color,
    secondaryColor: row.secondary_color,
    currency: row.currency.toUpperCase(),
    deliveryFeeCents: row.delivery_fee_cents,
    freeDeliveryEnabled: row.free_delivery_enabled === true,
    freeDeliveryThresholdCents: row.free_delivery_threshold_cents || 0,
    deliveryEnabled: row.delivery_enabled !== false,
    ignoreOpeningHours: row.ignore_opening_hours,
    storefrontLanguage: row.storefront_language || 'ar',
  };
}

async function getOwned(restaurantId) {
  const { rows } = await query(
    'SELECT * FROM restaurant_settings WHERE restaurant_id = $1',
    [restaurantId]
  );
  if (!rows[0]) throw notFound('Settings not found');
  return toPublicSettings(rows[0]);
}

const FIELD_COLUMNS = {
  description: 'description',
  phone: 'phone',
  whatsapp: 'whatsapp',
  address: 'address',
  timezone: 'timezone',
  logoPath: 'logo_path',
  coverPath: 'cover_path',
  nameEn: 'name_en',
  primaryColor: 'primary_color',
  secondaryColor: 'secondary_color',
  currency: 'currency',
  deliveryFeeCents: 'delivery_fee_cents',
  freeDeliveryEnabled: 'free_delivery_enabled',
  freeDeliveryThresholdCents: 'free_delivery_threshold_cents',
  deliveryEnabled: 'delivery_enabled',
  ignoreOpeningHours: 'ignore_opening_hours',
  storefrontLanguage: 'storefront_language',
};

async function updateOwned(restaurantId, patch) {
  const sets = [];
  const params = [restaurantId];
  for (const [key, col] of Object.entries(FIELD_COLUMNS)) {
    if (patch[key] !== undefined) {
      params.push(patch[key]);
      sets.push(`${col} = $${params.length}`);
    }
  }
  if (sets.length === 0) return getOwned(restaurantId);

  const { rows } = await query(
    `UPDATE restaurant_settings SET ${sets.join(', ')} WHERE restaurant_id = $1 RETURNING *`,
    params
  );
  if (!rows[0]) throw notFound('Settings not found');
  return toPublicSettings(rows[0]);
}

async function getHours(restaurantId) {
  const { rows } = await query(
    `SELECT day_of_week, is_closed, opens_at, closes_at
     FROM restaurant_hours WHERE restaurant_id = $1 ORDER BY day_of_week`,
    [restaurantId]
  );
  return rows.map((r) => ({
    day: r.day_of_week,
    closed: r.is_closed,
    opensAt: timeToHhmm(r.opens_at),
    closesAt: timeToHhmm(r.closes_at),
  }));
}

/** Replace all seven day rows atomically. rows: exactly 7 entries, day 0..6. */
async function setHours(restaurantId, rowsIn) {
  return withTx(async (client) => {
    await client.query('DELETE FROM restaurant_hours WHERE restaurant_id = $1', [restaurantId]);
    for (const row of rowsIn) {
      await client.query(
        `INSERT INTO restaurant_hours (restaurant_id, day_of_week, is_closed, opens_at, closes_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [restaurantId, row.day, row.closed, row.opensAt, row.closesAt]
      );
    }
    return getHoursTx(client, restaurantId);
  });
}

async function getHoursTx(client, restaurantId) {
  const { rows } = await client.query(
    `SELECT day_of_week, is_closed, opens_at, closes_at
     FROM restaurant_hours WHERE restaurant_id = $1 ORDER BY day_of_week`,
    [restaurantId]
  );
  return rows.map((r) => ({
    day: r.day_of_week,
    closed: r.is_closed,
    opensAt: timeToHhmm(r.opens_at),
    closesAt: timeToHhmm(r.closes_at),
  }));
}

/** Server-side open check used by admin UI status hints and tests. */
async function computeOpenNow(restaurantId) {
  const rest = (
    await query('SELECT status FROM restaurants WHERE id = $1', [restaurantId])
  ).rows[0];
  if (!rest) throw notFound('Restaurant not found');
  if (rest.status !== 'open') return false;
  const settings = (
    await query('SELECT timezone, ignore_opening_hours FROM restaurant_settings WHERE restaurant_id = $1', [restaurantId])
  ).rows[0];
  if (!settings || settings.ignore_opening_hours) return true;
  const hours = (
    await query('SELECT day_of_week, is_closed, opens_at, closes_at FROM restaurant_hours WHERE restaurant_id = $1', [restaurantId])
  ).rows;
  return isOpenNow(hours, settings.timezone);
}

module.exports = { getOwned, updateOwned, getHours, setHours, computeOpenNow };
