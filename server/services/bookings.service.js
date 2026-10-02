'use strict';

const { query, withTx } = require('../db/pool');
const { badRequest, notFound, conflict } = require('../utils/errors');
const { orderCode } = require('../utils/ids');

const STATUSES = ['pending', 'confirmed', 'cancelled', 'completed', 'noshow'];
const TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled', 'noshow'],
  cancelled: [],
  completed: [],
  noshow: [],
};

function assertTransition(current, next) {
  if (!STATUSES.includes(next)) throw badRequest('Unknown booking status');
  const allowed = TRANSITIONS[current] || [];
  if (!allowed.includes(next)) throw conflict('INVALID_STATUS_TRANSITION', `Cannot move booking from "${current}" to "${next}"`);
}

// ponytail: fixed 120-min overlap window — no duration exists in payload/validator/schema.
// Confirm the house slot length with the business before changing; the 019 migration
// backfills ends_at with the same value, so change both together.
const BOOKING_SLOT_MINUTES = 120;

async function create({ restaurantId, payload }) {
  return withTx(async (client) => {
    const rRows = (
      await client.query('SELECT id, is_active, subscription_ends_at FROM restaurants WHERE id = $1 FOR UPDATE', [
        restaurantId,
      ])
    ).rows;
    if (!rRows[0]) throw notFound('Restaurant not found');
    if (!rRows[0].is_active) throw conflict('RESTAURANT_UNAVAILABLE', 'Restaurant is not active');
    {
      const { accessAllowed } = require('./subscriptions.service');
      if (!(await accessAllowed(client, restaurantId))) {
        throw require('../utils/errors').forbidden('SUBSCRIPTION_EXPIRED', 'Subscription expired — please renew ($19.99/month) | انتهت التجربة — تواصل +972567439846');
      }
    }

    const bookedAt = new Date(payload.bookedAt).toISOString();
    const endsAt = new Date(new Date(payload.bookedAt).getTime() + BOOKING_SLOT_MINUTES * 60 * 1000).toISOString();

    // Serialize per restaurant (FOR UPDATE above): the overlap check and the
    // insert run in one transaction, so two conflicting attempts cannot both
    // commit. Range overlap needs no extension (only gist *indexes* do).
    const clash = await client.query(
      `SELECT 1 FROM bookings
       WHERE restaurant_id = $1
         AND status NOT IN ('cancelled', 'completed', 'noshow')
         AND tstzrange(booked_at, ends_at) && tstzrange($2::timestamptz, $3::timestamptz)
       LIMIT 1`,
      [restaurantId, bookedAt, endsAt]
    );
    if (clash.rowCount > 0) {
      throw conflict('BOOKING_CONFLICT', 'That time slot was just taken. Please choose another time.');
    }

    let code = null;
    let booking = null;
    for (let attempt = 0; attempt < 5 && !booking; attempt++) {
      code = orderCode();
      try {
        const { rows } = await client.query(
          `INSERT INTO bookings (code, restaurant_id, customer_name, customer_whatsapp, customer_phone, tables_count, booked_at, ends_at, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           RETURNING id, code, restaurant_id, customer_name, customer_whatsapp, customer_phone, tables_count, booked_at, status, notes, created_at`,
          [code, restaurantId, payload.customerName, payload.customerWhatsapp, payload.customerPhone, payload.tablesCount, bookedAt, endsAt, payload.notes]
        );
        booking = rows[0];
      } catch (err) {
        if (err.code === '23505') continue;
        throw err;
      }
    }
    if (!booking) throw conflict('BOOKING_CODE_COLLISION', 'Could not generate booking code, please retry');
    return booking;
  });
}

async function listForRestaurant(restaurantId, { status, limit, offset }) {
  if (status && !STATUSES.includes(status)) throw badRequest('Unknown booking status');
  const params = [restaurantId];
  let where = 'restaurant_id = $1';
  if (status) {
    params.push(status);
    where += ` AND status = $${params.length}`;
  }
  const count = await query(`SELECT COUNT(*)::int AS n FROM bookings WHERE ${where}`, params);
  params.push(limit, offset);
  const { rows } = await query(
    `SELECT * FROM bookings WHERE ${where} ORDER BY booked_at DESC, created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return { total: count.rows[0].n, bookings: rows };
}

async function getForRestaurant(bookingId, restaurantId) {
  const { rows } = await query('SELECT * FROM bookings WHERE id = $1 AND restaurant_id = $2', [bookingId, restaurantId]);
  if (!rows[0]) throw notFound('Booking not found');
  return rows[0];
}

async function changeStatus(bookingId, restaurantId, nextStatus) {
  return withTx(async (client) => {
    const cur = await client.query('SELECT status FROM bookings WHERE id = $1 AND restaurant_id = $2', [bookingId, restaurantId]);
    if (!cur.rows[0]) throw notFound('Booking not found');
    assertTransition(cur.rows[0].status, nextStatus);
    const { rows } = await client.query(
      'UPDATE bookings SET status = $3, updated_at = now() WHERE id = $1 AND restaurant_id = $2 RETURNING *',
      [bookingId, restaurantId, nextStatus]
    );
    return rows[0];
  });
}

async function archive(bookingId, restaurantId) {
  const cur = await query('SELECT status FROM bookings WHERE id = $1 AND restaurant_id = $2', [bookingId, restaurantId]);
  if (!cur.rows[0]) throw notFound('Booking not found');
  if (!['cancelled', 'completed', 'noshow'].includes(cur.rows[0].status)) throw conflict('INVALID_STATUS_TRANSITION', 'Only cancelled/completed/noshow bookings can be archived');
  // ponytail: keep original status, just delete — don't clobber completed/noshow to cancelled
  const { rowCount } = await query('DELETE FROM bookings WHERE id = $1 AND restaurant_id = $2', [bookingId, restaurantId]);
  if (!rowCount) throw notFound('Booking not found');
}

module.exports = { create, listForRestaurant, getForRestaurant, changeStatus, archive, STATUSES, TRANSITIONS };
