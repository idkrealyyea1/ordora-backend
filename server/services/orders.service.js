'use strict';

/**
 * Orders — server-priced checkout, tenant-scoped management,
 * status transitions and analytics. Prices ALWAYS come from the database
 * at purchase time; anything sent by the browser about money is ignored.
 */

const { query, withTx } = require('../db/pool');
const { badRequest, conflict, notFound } = require('../utils/errors');
const { orderCode } = require('../utils/ids');
const { isOpenNow } = require('../utils/datetime');

const STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'completed', 'cancelled'];

/** Orders only start counting as revenue once the restaurant confirms them. */
const REVENUE_STATUSES = ['confirmed', 'preparing', 'ready', 'out_for_delivery', 'completed'];
const REVENUE_SQL = `status IN ('${REVENUE_STATUSES.join("','")}')`;
const REVENUE_SQL_O = `o.status IN ('${REVENUE_STATUSES.join("','")}')`;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Clients may reference an order by its UUID or by its short `code`.
 * Resolving up front means a stale cached bundle that sends the code still
 * works (previously a non-UUID produced Postgres 22P02 -> "Invalid data format").
 */
async function resolveOrderId(orderRef, restaurantId) {
  if (UUID_RE.test(orderRef || '')) {
    const { rows } = await query(
      'SELECT id FROM orders WHERE id = $1 AND restaurant_id = $2',
      [orderRef, restaurantId]
    );
    if (!rows[0]) throw notFound('Order not found');
    return rows[0].id;
  }
  const { rows } = await query(
    'SELECT id FROM orders WHERE code = $1 AND restaurant_id = $2',
    [orderRef, restaurantId]
  );
  if (!rows[0]) throw notFound('Order not found');
  return rows[0].id;
}

const TRANSITIONS = {
  pending: ['confirmed', 'preparing', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['out_for_delivery', 'completed', 'cancelled'],
  out_for_delivery: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

function assertTransition(current, next, orderType) {
  if (!STATUSES.includes(next)) throw badRequest('Unknown order status');
  const allowed = TRANSITIONS[current] || [];
  if (!allowed.includes(next)) {
    throw conflict('INVALID_STATUS_TRANSITION', `Cannot change status from "${current}" to "${next}"`);
  }
  if (next === 'out_for_delivery' && orderType !== 'delivery') {
    throw badRequest('"Out for delivery" only applies to delivery orders');
  }
}

/* ------------------------------------------------------------------ */
/* Checkout                                                            */
/* ------------------------------------------------------------------ */

/**
 * payload: {
 *   customerName, customerWhatsapp, customerPhone?, customerAddress?,
 *   orderType: 'pickup'|'delivery', notes?,
 *   items: [{ itemId, quantity }]
 * }
 */
async function createCheckout({ restaurantId, payload }) {
  return withTx(async (client) => {
    // Lock the tenant row: prevents status flips mid-checkout and serializes
    // concurrent checkouts for this restaurant.
    const restRes = await client.query(
      `SELECT r.id, r.is_active, r.status,
              s.timezone, s.delivery_fee_cents, s.delivery_enabled, s.ignore_opening_hours
       FROM restaurants r
       JOIN restaurant_settings s ON s.restaurant_id = r.id
       WHERE r.id = $1
       FOR UPDATE OF r`,
      [restaurantId]
    );
     const rest = restRes.rows[0];
    if (!rest || !rest.is_active) throw conflict('RESTAURANT_UNAVAILABLE', 'This restaurant is not accepting orders');

    // $19.99/month subscription gate — NULL or future = active
    {
      const sub = await client.query('SELECT subscription_ends_at FROM restaurants WHERE id = $1', [restaurantId]);
      const endsAt = sub.rows[0] ? sub.rows[0].subscription_ends_at : null;
      const active = !endsAt || new Date(endsAt).getTime() > Date.now();
      if (!active) throw require('../utils/errors').forbidden('SUBSCRIPTION_EXPIRED', 'Subscription expired — please renew ($19.99/month) | انتهت التجربة — تواصل +972567439846');
    }

    if (rest.status !== 'open') {
      throw conflict('RESTAURANT_CLOSED', 'This restaurant is currently closed and not accepting new orders');
    }

    if (payload.orderType === 'delivery' && rest.delivery_enabled === false) {
      throw conflict('DELIVERY_UNAVAILABLE', 'This restaurant is not offering delivery right now.');
    }

    if (!rest.ignore_opening_hours) {
      const hours = (
        await client.query(
          'SELECT day_of_week, is_closed, opens_at, closes_at FROM restaurant_hours WHERE restaurant_id = $1',
          [restaurantId]
        )
      ).rows;
      if (!isOpenNow(hours, rest.timezone)) {
        throw conflict(
          'OUTSIDE_OPENING_HOURS',
          'This restaurant is outside its opening hours right now. Please come back later.'
        );
      }
    }

    // Merge duplicate item entries, enforce sane bounds.
    const wanted = new Map();
    let totalUnits = 0;
    for (const line of payload.items) {
      const id = String(line.itemId).toLowerCase();
      const qty = line.quantity;
      const merged = (wanted.get(id) || 0) + qty;
      if (merged > 99) throw badRequest('Quantity too high for one of the items');
      wanted.set(id, merged);
      totalUnits += merged;
      if (totalUnits > 200) throw badRequest('Too many items in a single order');
    }

    // Prices & availability from DB only.
    const itemRes = await client.query(
      `SELECT id, name, price_cents FROM menu_items
       WHERE restaurant_id = $1 AND is_available = TRUE AND id = ANY($2::uuid[])`,
      [restaurantId, [...wanted.keys()]]
    );
    if (itemRes.rowCount !== wanted.size) {
      throw conflict('ITEMS_UNAVAILABLE', 'One or more items are no longer available. Please refresh the menu.');
    }

    const lines = [];
    let subtotal = 0;
    for (const row of itemRes.rows) {
      const qty = wanted.get(row.id);
      const lineTotal = row.price_cents * qty;
      subtotal += lineTotal;
      lines.push({
        menuItemId: row.id,
        itemName: row.name,
        unitPriceCents: row.price_cents,
        quantity: qty,
        lineTotalCents: lineTotal,
      });
    }

    const deliveryFee =
      payload.orderType === 'delivery' ? Number(rest.delivery_fee_cents || 0) : 0;
    const total = subtotal + deliveryFee;

    // Idempotent retry: a repeated submission of the same customer intent
    // (double-click, slow network, browser retry) returns the original order
    // instead of inserting a duplicate. key is client-generated per attempt.
    const submissionKey = payload.submissionKey || null;
    if (submissionKey) {
      const existing = await client.query(
        `SELECT id, code, status, subtotal_cents, delivery_fee_cents, total_cents, created_at
         FROM orders WHERE restaurant_id = $1 AND submission_key = $2`,
        [restaurantId, submissionKey]
      );
      if (existing.rows[0]) return existing.rows[0];
    }

    // Insert with collision-resistant public code (retry on rare clash).
    let orderRow = null;
    for (let attempt = 0; attempt < 5 && !orderRow; attempt++) {
      try {
        const res = await client.query(
          `INSERT INTO orders
             (code, restaurant_id, customer_name, customer_whatsapp, customer_phone,
              customer_address, order_type, notes, subtotal_cents, delivery_fee_cents, total_cents,
              submission_key)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           RETURNING id, code, status, subtotal_cents, delivery_fee_cents, total_cents, created_at`,
          [
            orderCode(),
            restaurantId,
            payload.customerName,
            payload.customerWhatsapp,
            payload.customerPhone,
            payload.customerAddress,
            payload.orderType,
            payload.notes,
            subtotal,
            deliveryFee,
            total,
            submissionKey,
          ]
        );
        orderRow = res.rows[0];
      } catch (err) {
        if (err.code === '23505' && err.constraint !== 'orders_submission_key_uniq') continue; // code collision — retry
        if (err.code === '23505') {
          // Lost the race with our own retry: return the winner.
          const winner = await client.query(
            `SELECT id, code, status, subtotal_cents, delivery_fee_cents, total_cents, created_at
             FROM orders WHERE restaurant_id = $1 AND submission_key = $2`,
            [restaurantId, submissionKey]
          );
          if (winner.rows[0]) return winner.rows[0];
        }
        throw err;
      }
    }

    for (const line of lines) {
      await client.query(
        `INSERT INTO order_items (order_id, menu_item_id, item_name, unit_price_cents, quantity, line_total_cents)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [orderRow.id, line.menuItemId, line.itemName, line.unitPriceCents, line.quantity, line.lineTotalCents]
      );
    }

    return orderRow;
  });
}

/* ------------------------------------------------------------------ */
/* Restaurant-admin views                                              */
/* ------------------------------------------------------------------ */

async function listForRestaurant(restaurantId, { status, limit, offset }) {
  if (status && !STATUSES.includes(status)) throw badRequest('Unknown order status');
  const params = [restaurantId];
  let where = 'restaurant_id = $1 AND archived_at IS NULL';
  if (status) {
    params.push(status);
    where += ` AND status = $${params.length}`;
  }

  const count = await query(`SELECT COUNT(*)::int AS n FROM orders WHERE ${where}`, params);

  params.push(limit, offset);
  const { rows } = await query(
    `SELECT o.*, COUNT(oi.id)::int AS item_line_count,
            COALESCE(SUM(oi.quantity), 0)::int AS total_units
     FROM orders o
     LEFT JOIN order_items oi ON oi.order_id = o.id
     WHERE ${where}
     GROUP BY o.id
     ORDER BY o.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return { total: count.rows[0].n, orders: rows };
}

async function getForRestaurant(orderId, restaurantId) {
  const id = await resolveOrderId(orderId, restaurantId);
  const order = (
    await query('SELECT * FROM orders WHERE id = $1 AND restaurant_id = $2', [id, restaurantId])
  ).rows[0];
  if (!order) throw notFound('Order not found');
  order.items = (
    await query(
      `SELECT id, menu_item_id, item_name, unit_price_cents, quantity, line_total_cents
       FROM order_items WHERE order_id = $1 ORDER BY created_at`,
      [id]
    )
  ).rows;
  return order;
}

async function updateStatus(orderId, restaurantId, nextStatus) {
  if (!STATUSES.includes(nextStatus)) throw badRequest('Unknown order status');
  return withTx(async (client) => {
    const { rows } = await client.query(
      `UPDATE orders SET status = $3
       WHERE id = $1 AND restaurant_id = $2 AND status <> $3
       RETURNING id, code, status`,
      [orderId, restaurantId, nextStatus]
    );
    if (rows[0]) return rows[0];
    const existing = (
      await client.query(
        'SELECT status, code FROM orders WHERE id = $1 AND restaurant_id = $2',
        [orderId, restaurantId]
      )
    ).rows[0];
    if (!existing) throw notFound('Order not found');
    if (existing.status === nextStatus) return { id: orderId, code: existing.code, status: existing.status };
    throw conflict('SAME_STATUS', `Order status is already "${existing.status}"`);
  });
}

/** Validate then apply a status change (public helper used by controller). */
async function changeStatus(orderId, restaurantId, nextStatus) {
  const id = await resolveOrderId(orderId, restaurantId);
  const current = (
    await query('SELECT status, order_type FROM orders WHERE id = $1 AND restaurant_id = $2', [id, restaurantId])
  ).rows[0];
  if (!current) throw notFound('Order not found');
  assertTransition(current.status, nextStatus, current.order_type);
  return updateStatus(id, restaurantId, nextStatus);
}

/* ------------------------------------------------------------------ */
/**
 * Archive a finished order (completed/cancelled): it disappears from the
 * dashboard lists but its money remains counted in all revenue queries.
 */
async function archiveOrder(orderId, restaurantId) {
  const id = await resolveOrderId(orderId, restaurantId);
  const { rows } = await query(
    `UPDATE orders SET archived_at = now()
     WHERE id = $1 AND restaurant_id = $2 AND status IN ('completed', 'cancelled') AND archived_at IS NULL
     RETURNING id, code`,
    [id, restaurantId]
  );
  if (!rows[0]) throw notFound('Only completed or cancelled orders can be deleted');
  return rows[0];
}

/* Dashboard + analytics                                               */
/* ------------------------------------------------------------------ */

async function dashboardCounts(restaurantId, timezone) {
  const res = await query(
    `SELECT
       COUNT(*) FILTER (WHERE (created_at AT TIME ZONE $2)::date = (now() AT TIME ZONE $2)::date)::int AS orders_today,
       COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
       COUNT(*) FILTER (WHERE status IN ('confirmed','preparing','ready','out_for_delivery'))::int AS active_orders,
       COUNT(*) FILTER (WHERE status = 'completed' AND (updated_at AT TIME ZONE $2)::date = (now() AT TIME ZONE $2)::date)::int AS completed_today,
       COALESCE(SUM(total_cents) FILTER (
         WHERE ${REVENUE_SQL} AND (created_at AT TIME ZONE $2)::date = (now() AT TIME ZONE $2)::date
       ), 0)::bigint AS revenue_today_cents
     FROM orders
     WHERE restaurant_id = $1`,
    [restaurantId, timezone]
  );
  const r = res.rows[0];
  return {
    ordersToday: r.orders_today,
    pendingOrders: r.pending,
    activeOrders: r.active_orders,
    completedToday: r.completed_today,
    revenueTodayCents: Number(r.revenue_today_cents),
  };
}

async function analyticsSeries(restaurantId, timezone, days) {
  const res = await query(
    `SELECT to_char((created_at AT TIME ZONE $2)::date, 'YYYY-MM-DD') AS day,
            COUNT(*)::int AS orders,
            COALESCE(SUM(total_cents), 0)::bigint AS revenue_cents
     FROM orders
     WHERE restaurant_id = $1 AND ${REVENUE_SQL}
       AND (created_at AT TIME ZONE $2)::date >= ((now() AT TIME ZONE $2)::date - ($3::int - 1))
     GROUP BY 1
     ORDER BY 1`,
    [restaurantId, timezone, days]
  );

  // Fill zero-days so charts are continuous.
  const byDay = new Map(res.rows.map((r) => [r.day, r]));
  const series = [];
  const cursor = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(cursor.getTime() - i * 86400000);
    // Label using the restaurant's timezone.
    const label = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(d);
    const hit = byDay.get(label);
    series.push({
      day: label,
      orders: hit ? hit.orders : 0,
      revenueCents: hit ? Number(hit.revenue_cents) : 0,
    });
  }

  const totals = series.reduce(
    (acc, s) => ({ orders: acc.orders + s.orders, revenueCents: acc.revenueCents + s.revenueCents }),
    { orders: 0, revenueCents: 0 }
  );
  return { series, totals };
}

async function topItems(restaurantId, days = 30, limit = 10) {
  const { rows } = await query(
    `SELECT oi.item_name, SUM(oi.quantity)::int AS units, COALESCE(SUM(oi.line_total_cents),0)::bigint AS revenue_cents
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     WHERE o.restaurant_id = $1 AND ${REVENUE_SQL_O}
       AND o.created_at >= now() - ($2::int * INTERVAL '1 day')
     GROUP BY oi.item_name
     ORDER BY units DESC
     LIMIT $3`,
    [restaurantId, days, limit]
  );
  return rows.map((r) => ({ ...r, revenueCents: Number(r.revenue_cents) }));
}

/** Orders grouped by day of week (0=Sunday..6) over the last `days`. */
async function byDayOfWeek(restaurantId, timezone, days) {
  const { rows } = await query(
    `SELECT extract(dow FROM (o.created_at AT TIME ZONE $2))::int AS dow,
            COUNT(*)::int AS orders,
            COALESCE(SUM(o.total_cents), 0)::bigint AS revenue_cents
     FROM orders o
     WHERE o.restaurant_id = $1 AND ${REVENUE_SQL_O}
       AND (o.created_at AT TIME ZONE $2)::date >= ((now() AT TIME ZONE $2)::date - ($3::int - 1))
     GROUP BY dow
     ORDER BY dow`,
    [restaurantId, timezone, days]
  );
  return rows.map((r) => ({ dow: r.dow, orders: r.orders, revenueCents: Number(r.revenue_cents) }));
}

/** Orders grouped by hour of day (0..23, restaurant-local time) over the last `days`. */
async function byHour(restaurantId, timezone, days) {
  const { rows } = await query(
    `SELECT extract(hour FROM (o.created_at AT TIME ZONE $2))::int AS hour,
            COUNT(*)::int AS orders,
            COALESCE(SUM(o.total_cents), 0)::bigint AS revenue_cents
     FROM orders o
     WHERE o.restaurant_id = $1 AND ${REVENUE_SQL_O}
       AND (o.created_at AT TIME ZONE $2)::date >= ((now() AT TIME ZONE $2)::date - ($3::int - 1))
     GROUP BY hour
     ORDER BY hour`,
    [restaurantId, timezone, days]
  );
  return rows.map((r) => ({ hour: r.hour, orders: r.orders, revenueCents: Number(r.revenue_cents) }));
}

/** True when `revenueOnly` and the status is not a revenue status. */
function isNotRevenue(status) {
  return !REVENUE_STATUSES.includes(status);
}

/**
 * Flat, export-ready order rows for CSV/PDF reports. `revenueOnly` strips
 * pending/cancelled so money-facing exports match dashboard revenue.
 */
async function exportRows(restaurantId, { revenueOnly, status, limit = 5000 } = {}) {
  const params = [restaurantId];
  let where = 'o.restaurant_id = $1';
  if (revenueOnly) where += ` AND ${REVENUE_SQL_O}`;
  if (status) {
    params.push(status);
    where += ` AND o.status = $${params.length}`;
  }
  params.push(limit);
  const { rows } = await query(
    `SELECT o.code, o.status, o.order_type, o.customer_name, o.customer_whatsapp,
            o.customer_phone, o.customer_address, o.notes,
            o.subtotal_cents, o.delivery_fee_cents, o.total_cents,
            o.created_at, o.updated_at
     FROM orders o
     WHERE ${where} AND o.archived_at IS NULL
     ORDER BY o.created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return rows;
}

/* ------------------------------------------------------------------ */
/* Customer tracking                                                   */
/* ------------------------------------------------------------------ */async function getByCode(code) {
  const order = (
    await query(
      `SELECT o.id, o.code, o.status, o.order_type, o.total_cents, o.subtotal_cents, o.delivery_fee_cents,
              o.created_at, o.updated_at, r.name AS restaurant_name, r.slug AS restaurant_slug,
              s.currency
       FROM orders o
       JOIN restaurants r ON r.id = o.restaurant_id
       JOIN restaurant_settings s ON s.restaurant_id = r.id
       WHERE UPPER(o.code) = UPPER($1)`,
      [code]
    )
  ).rows[0];
  if (!order) throw notFound('No order found for this tracking code');

  order.items = (
    await query(
      `SELECT menu_item_id, item_name, unit_price_cents, quantity, line_total_cents
       FROM order_items WHERE order_id = $1 ORDER BY created_at`,
      [order.id]
    )
  ).rows;
  delete order.id;
  return order;
}

/**
 * Customer-initiated cancellation. Only allowed while the restaurant has not
 * begun preparing (status pending|confirmed) and within the grace window.
 */
async function cancelByCustomer(code, graceMs) {
  const order = (
    await query(
      `SELECT o.id, o.status, o.created_at, r.id AS "restaurantId"
       FROM orders o
       JOIN restaurants r ON r.id = o.restaurant_id
       WHERE UPPER(o.code) = UPPER($1)`,
      [code]
    )
  ).rows[0];
  if (!order) throw notFound('No order found for this tracking code');

  if (order.status !== 'pending' && order.status !== 'confirmed') {
    throw conflict('CANCEL_NOT_ALLOWED', 'This order can no longer be cancelled — it has already been prepared.');
  }
  if (new Date(order.created_at).getTime() + graceMs < Date.now()) {
    throw conflict('CANCEL_WINDOW_EXPIRED', 'The cancellation window has passed. Please contact the restaurant.');
  }

  const { rows } = await query(
    `UPDATE orders SET status = 'cancelled', updated_at = now()
     WHERE id = $1 AND status IN ('pending', 'confirmed')
       AND created_at > now() - ($2 || ' milliseconds')::interval
     RETURNING id, code, status`,
    [order.id, String(graceMs)]
  );
  if (!rows[0]) throw conflict('CANCEL_NOT_ALLOWED', 'This order can no longer be cancelled.');
  return { ...rows[0], restaurantId: order.restaurantId };
}

module.exports = {
  STATUSES,
  REVENUE_STATUSES,
  REVENUE_SQL,
  TRANSITIONS,
  createCheckout,
  listForRestaurant,
  getForRestaurant,
  changeStatus,
  archiveOrder,
  dashboardCounts,
  analyticsSeries,
  topItems,
  byDayOfWeek,
  byHour,
  exportRows,
  getByCode,
  cancelByCustomer,
};
