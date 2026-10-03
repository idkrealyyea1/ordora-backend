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
 * Price one cart line's option selections from trusted definitions.
 * min/max count distinct choices; quantities accumulate per choice and are
 * capped by that choice's max_quantity. Replace-mode groups are single-pick
 * by schema and set the unit price; adjust-mode adds price × quantity.
 * Pushes frozen snapshot rows into `snapshots`. Throws on any mismatch —
 * client money is never read.
 */
async function priceSelections(client, { restaurantId, menuItemId, baseCents, selections, snapshots }) {
  const { rows } = await client.query(
    `SELECT g.id AS group_id, g.name AS group_name, g.is_required, g.min_picks, g.max_picks, g.pricing,
            c.id AS choice_id, c.name AS choice_name, c.price_cents, c.max_quantity, c.is_available
     FROM option_groups g
     JOIN option_choices c ON c.group_id = g.id AND c.restaurant_id = g.restaurant_id
     WHERE g.restaurant_id = $1 AND g.menu_item_id = $2
     ORDER BY g.position, g.name, c.position, c.name`,
    [restaurantId, menuItemId]
  );
  const groups = new Map();
  for (const r of rows) {
    if (!groups.has(r.group_id)) {
      groups.set(r.group_id, {
        name: r.group_name, minPicks: r.min_picks, maxPicks: r.max_picks,
        pricing: r.pricing, choices: new Map(),
      });
    }
    groups.get(r.group_id).choices.set(r.choice_id, r);
  }
  const seen = new Set();
  let unit = baseCents;
  for (const sel of selections) {
    const g = groups.get(sel.groupId);
    if (!g) throw badRequest('Unknown option selection', [{ field: 'selections' }]);
    if (seen.has(sel.groupId)) throw badRequest('Duplicate option group in selection', [{ field: 'selections' }]);
    seen.add(sel.groupId);
    const qtyByChoice = new Map();
    for (const line of sel.choices) {
      qtyByChoice.set(line.choiceId, (qtyByChoice.get(line.choiceId) || 0) + line.quantity);
    }
    if (qtyByChoice.size < g.minPicks || qtyByChoice.size > g.maxPicks) {
      throw badRequest(`Pick between ${g.minPicks} and ${g.maxPicks} for "${g.name}"`, [{ field: 'selections' }]);
    }
    if (g.pricing === 'replace') {
      const [[choiceId]] = [...qtyByChoice.entries()];
      const c = g.choices.get(choiceId);
      if (!c) throw badRequest('Unknown option selection', [{ field: 'selections' }]);
      if (!c.is_available) throw conflict('ITEMS_UNAVAILABLE', `"${c.choice_name}" is no longer available. Please refresh the menu.`);
      unit = c.price_cents;
      snapshots.push({
        groupId: sel.groupId, groupName: g.name, choiceId,
        choiceName: c.choice_name, unitPriceCents: c.price_cents, quantity: 1,
      });
    } else {
      for (const [choiceId, qty] of qtyByChoice) {
        const c = g.choices.get(choiceId);
        if (!c) throw badRequest('Unknown option selection', [{ field: 'selections' }]);
        if (!c.is_available) throw conflict('ITEMS_UNAVAILABLE', `"${c.choice_name}" is no longer available. Please refresh the menu.`);
        if (qty > c.max_quantity) throw badRequest(`At most ${c.max_quantity} × "${c.choice_name}"`, [{ field: 'selections' }]);
        unit += c.price_cents * qty;
        snapshots.push({
          groupId: sel.groupId, groupName: g.name, choiceId,
          choiceName: c.choice_name, unitPriceCents: c.price_cents, quantity: qty,
        });
      }
    }
  }
  for (const [gid, g] of groups) {
    if (g.minPicks > 0 && !seen.has(gid)) throw badRequest(`"${g.name}" is required`, [{ field: 'selections' }]);
  }
  return unit;
}

/**
 * Attach frozen option snapshots to order-item rows (which must carry `id`).
 * Lines without options get `options: []`.
 */
async function attachOptionSnapshots(runner, items) {
  if (!items.length) return items;
  const { rows } = await runner.query(
    `SELECT order_item_id, group_name, choice_name, unit_price_cents, quantity, line_total_cents
     FROM order_item_options WHERE order_item_id = ANY($1::uuid[]) ORDER BY created_at`,
    [items.map((i) => i.id)]
  );
  const byLine = new Map(items.map((i) => [i.id, []]));
  for (const r of rows) {
    const list = byLine.get(r.order_item_id);
    if (list) {
      list.push({
        group_name: r.group_name,
        choice_name: r.choice_name,
        unit_price_cents: Number(r.unit_price_cents),
        quantity: r.quantity,
        line_total_cents: Number(r.line_total_cents),
      });
    }
  }
  for (const i of items) i.options = byLine.get(i.id) || [];
  return items;
}

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
              s.timezone, s.delivery_fee_cents, s.delivery_enabled, s.ignore_opening_hours,
              s.currency, s.free_delivery_enabled, s.free_delivery_threshold_cents
       FROM restaurants r
       JOIN restaurant_settings s ON s.restaurant_id = r.id
       WHERE r.id = $1
       FOR UPDATE OF r`,
      [restaurantId]
    );
     const rest = restRes.rows[0];
    if (!rest || !rest.is_active) throw conflict('RESTAURANT_UNAVAILABLE', 'This restaurant is not accepting orders');

    // Subscription gate (Task 14): derived state — grace keeps ordering.
    {
      const { accessAllowed } = require('./subscriptions.service');
      if (!(await accessAllowed(client, restaurantId))) {
        throw require('../utils/errors').forbidden('SUBSCRIPTION_EXPIRED', 'Subscription expired — please renew ($19.99/month) | انتهت التجربة — تواصل +972567439846');
      }
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
      `SELECT id, name, price_cents, is_preorder, preorder_note FROM menu_items
       WHERE restaurant_id = $1 AND is_available = TRUE AND id = ANY($2::uuid[])`,
      [restaurantId, [...wanted.keys()]]
    );
    if (itemRes.rowCount !== wanted.size) {
      throw conflict('ITEMS_UNAVAILABLE', 'One or more items are no longer available. Please refresh the menu.');
    }

    const lines = [];
    let subtotal = 0;
    // Merge duplicate item entries (and their selections) exactly like quantities.
    const selByItem = new Map();
    for (const p of payload.items) {
      const key = String(p.itemId).toLowerCase();
      selByItem.set(key, (selByItem.get(key) || []).concat(p.selections || []));
    }
    for (const row of itemRes.rows) {
      const qty = wanted.get(row.id);
      let unit = row.price_cents;
      const snapshots = [];
      const sels = selByItem.get(String(row.id).toLowerCase()) || [];
      if (sels.length > 0) {
        unit = await priceSelections(client, {
          restaurantId,
          menuItemId: row.id,
          baseCents: row.price_cents,
          selections: sels,
          snapshots,
        });
      }
      const lineTotal = unit * qty;
      subtotal += lineTotal;
      lines.push({
        menuItemId: row.id,
        itemName: row.name,
        unitPriceCents: unit,
        quantity: qty,
        lineTotalCents: lineTotal,
        snapshots,
        isPreorder: Boolean(row.is_preorder),
        preorderNote: row.is_preorder ? String(row.preorder_note || '') : '',
      });
    }

    // Server-authoritative delivery fee. Optional free-delivery threshold:
    // delivery orders whose server-computed subtotal reaches the business
    // threshold ship free. Pickup never carries a fee. Client values ignored.
    const freeShip =
      payload.orderType === 'delivery' &&
      rest.free_delivery_enabled === true &&
      subtotal >= Number(rest.free_delivery_threshold_cents || 0);
    const deliveryFee =
      payload.orderType === 'delivery' && !freeShip ? Number(rest.delivery_fee_cents || 0) : 0;
    const total = subtotal + deliveryFee;

    // Idempotent retry: a repeated submission of the same customer intent
    // (double-click, slow network, browser retry) returns the original order
    // instead of inserting a duplicate. key is client-generated per attempt.
    const submissionKey = payload.submissionKey || null;
    if (submissionKey) {
      const existing = await client.query(
        `SELECT id, code, status, subtotal_cents, delivery_fee_cents, total_cents, currency, created_at
         FROM orders WHERE restaurant_id = $1 AND submission_key = $2`,
        [restaurantId, submissionKey]
      );
      if (existing.rows[0]) return existing.rows[0];
    }

    // Snapshot the currency valid at checkout so later settings changes
    // never relabel history. Amounts stay plain integer cents.
    const orderCurrency = String(rest.currency || 'USD').toUpperCase();

    // Insert with collision-resistant public code (retry on rare clash).
    let orderRow = null;
    for (let attempt = 0; attempt < 5 && !orderRow; attempt++) {
      try {
        const res = await client.query(
          `INSERT INTO orders
             (code, restaurant_id, customer_name, customer_whatsapp, customer_phone,
              customer_address, order_type, notes, subtotal_cents, delivery_fee_cents, total_cents,
              submission_key, currency)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
           RETURNING id, code, status, subtotal_cents, delivery_fee_cents, total_cents, currency, created_at`,
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
            orderCurrency,
          ]
        );
        orderRow = res.rows[0];
      } catch (err) {
        if (err.code === '23505' && err.constraint !== 'orders_submission_key_uniq') continue; // code collision — retry
        if (err.code === '23505') {
          // Lost the race with our own retry: return the winner.
          const winner = await client.query(
            `SELECT id, code, status, subtotal_cents, delivery_fee_cents, total_cents, currency, created_at
             FROM orders WHERE restaurant_id = $1 AND submission_key = $2`,
            [restaurantId, submissionKey]
          );
          if (winner.rows[0]) return winner.rows[0];
        }
        throw err;
      }
    }

    for (const line of lines) {
      const { rows: lineRows } = await client.query(
        `INSERT INTO order_items (order_id, menu_item_id, item_name, unit_price_cents, quantity, line_total_cents, is_preorder, preorder_note)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [orderRow.id, line.menuItemId, line.itemName, line.unitPriceCents, line.quantity, line.lineTotalCents, line.isPreorder, line.preorderNote]
      );
      for (const snap of line.snapshots) {
        await client.query(
          `INSERT INTO order_item_options
             (order_item_id, group_id, choice_id, group_name, choice_name,
              unit_price_cents, quantity, line_total_cents)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            lineRows[0].id, snap.groupId, snap.choiceId, snap.groupName, snap.choiceName,
            snap.unitPriceCents, snap.quantity, snap.unitPriceCents * snap.quantity,
          ]
        );
      }
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
            COALESCE(SUM(oi.quantity), 0)::int AS total_units,
            EXISTS(SELECT 1 FROM order_items oi2 WHERE oi2.order_id = o.id AND oi2.is_preorder) AS has_preorder
     FROM orders o
     LEFT JOIN order_items oi ON oi.order_id = o.id
     WHERE ${where}
     GROUP BY o.id
     ORDER BY CASE WHEN o.status = 'pending' THEN 0 ELSE 1 END, o.created_at DESC
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
      `SELECT id, menu_item_id, item_name, unit_price_cents, quantity, line_total_cents,
              is_preorder, preorder_note
       FROM order_items WHERE order_id = $1 ORDER BY created_at`,
      [id]
    )
  ).rows;
  await attachOptionSnapshots({ query }, order.items);
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
    await query('SELECT id, code, status, order_type FROM orders WHERE id = $1 AND restaurant_id = $2', [id, restaurantId])
  ).rows[0];
  if (!current) throw notFound('Order not found');
  // Same-status repeat is a safe no-op while the order is still active
  // (double-submit safe). Terminal states stay strictly immutable: even
  // re-asserting them is refused so history can never be rewritten.
  if (current.status === nextStatus) {
    if (current.status === 'completed' || current.status === 'cancelled') {
      throw conflict('TERMINAL_STATE', `Order is already "${current.status}" and cannot be changed`);
    }
    return { id: current.id, code: current.code, status: current.status };
  }
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

async function analyticsSeries(restaurantId, timezone, daysOrPeriod) {
  const { from, to } = toPeriodBounds(daysOrPeriod, timezone);
  const res = await query(
    `SELECT to_char((created_at AT TIME ZONE $2)::date, 'YYYY-MM-DD') AS day,
            COUNT(*)::int AS orders,
            COALESCE(SUM(total_cents), 0)::bigint AS revenue_cents
     FROM orders
     WHERE restaurant_id = $1 AND ${REVENUE_SQL}
       AND (created_at AT TIME ZONE $2)::date BETWEEN $3::date AND $4::date
     GROUP BY 1
     ORDER BY 1`,
    [restaurantId, timezone, from, to]
  );

  // Fill zero-days so charts are continuous.
  const byDay = new Map(res.rows.map((r) => [r.day, r]));
  const series = [];
  for (let d = new Date(from + 'T00:00:00Z'); d <= new Date(to + 'T00:00:00Z'); d = new Date(d.getTime() + 86400000)) {
    const label = d.toISOString().slice(0, 10);
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
  // Distinct snapshot currencies in the window so figures never lose context
  // when a business changed currency mid-period. No conversion is applied.
  const currencies = (
    await query(
      `SELECT DISTINCT UPPER(COALESCE(currency, 'USD')) AS currency
       FROM orders
       WHERE restaurant_id = $1 AND ${REVENUE_SQL}
         AND (created_at AT TIME ZONE 'UTC')::date BETWEEN $2::date AND $3::date`,
      [restaurantId, from, to]
    )
  ).rows.map((r) => r.currency);
  return { series, totals, currencies, revenueByCurrency: await revenueByCurrency(restaurantId, from, to) };
}

/** Revenue + order counts grouped by frozen order currency. No conversion. */
async function revenueByCurrency(restaurantId, from, to) {
  const { rows } = await query(
    `SELECT UPPER(COALESCE(currency, 'USD')) AS currency,
            COUNT(*)::int AS orders,
            COALESCE(SUM(total_cents), 0)::bigint AS revenue_cents
     FROM orders
     WHERE restaurant_id = $1 AND ${REVENUE_SQL}
       AND (created_at AT TIME ZONE 'UTC')::date BETWEEN $2::date AND $3::date
     GROUP BY 1`,
    [restaurantId, from, to]
  );
  const out = {};
  for (const r of rows) out[r.currency] = { orders: r.orders, revenueCents: Number(r.revenue_cents) };
  return out;
}

/** Status / pickup-vs-delivery / normal-vs-preorder splits for a period. */
async function orderSplits(restaurantId, from, to) {
  const { rows } = await query(
    `SELECT o.status, o.order_type,
            EXISTS(SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.is_preorder) AS is_preorder
     FROM orders o
     WHERE o.restaurant_id = $1
       AND (o.created_at AT TIME ZONE 'UTC')::date BETWEEN $2::date AND $3::date`,
    [restaurantId, from, to]
  );
  const statusSplit = {};
  const pickupVsDelivery = { pickup: 0, delivery: 0 };
  const preorderSplit = { normal: 0, preorder: 0 };
  for (const r of rows) {
    statusSplit[r.status] = (statusSplit[r.status] || 0) + 1;
    if (r.order_type === 'delivery') pickupVsDelivery.delivery += 1;
    else pickupVsDelivery.pickup += 1;
    if (r.is_preorder) preorderSplit.preorder += 1;
    else preorderSplit.normal += 1;
  }
  return { statusSplit, pickupVsDelivery, preorderSplit };
}

/** Resolve a days number or {mode,preset,from,to} into [from,to] date labels. */
function toPeriodBounds(daysOrPeriod, timezone) {
  const today = tzToday(timezone);
  if (daysOrPeriod && typeof daysOrPeriod === 'object') {
    const p = daysOrPeriod;
    if (p.mode === 'range') return { from: p.from, to: p.to };
    if (p.mode === 'preset') {
      if (p.preset === 'today') return { from: today, to: today };
      if (p.preset === '30d') return { from: shiftDate(today, -29), to: today };
      return { from: shiftDate(today, -6), to: today };
    }
    return { from: shiftDate(today, -(p.days - 1)), to: today };
  }
  const days = Math.min(Math.max(Number(daysOrPeriod) || 7, 1), 90);
  return { from: shiftDate(today, -(days - 1)), to: today };
}

function tzToday(timezone) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function shiftDate(label, deltaDays) {
  const d = new Date(label + 'T00:00:00Z');
  return new Date(d.getTime() + deltaDays * 86400000).toISOString().slice(0, 10);
}

async function topItems(restaurantId, daysOrPeriod = 30, limit = 10) {
  // Counts parent order_items rows only: option/variant lines live in
  // order_item_options and roll their revenue into the parent line.
  const period = typeof daysOrPeriod === 'object' ? daysOrPeriod : { mode: 'days', days: Math.max(daysOrPeriod, 30) };
  const { from, to } = toPeriodBounds(period, 'UTC');
  const { rows } = await query(
    `SELECT oi.menu_item_id, oi.item_name, SUM(oi.quantity)::int AS units, COALESCE(SUM(oi.line_total_cents),0)::bigint AS revenue_cents
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     WHERE o.restaurant_id = $1 AND ${REVENUE_SQL_O}
       AND (o.created_at AT TIME ZONE 'UTC')::date BETWEEN $2::date AND $3::date
     GROUP BY oi.menu_item_id, oi.item_name
     ORDER BY units DESC
     LIMIT $4`,
    [restaurantId, from, to, limit]
  );
  return rows.map((r) => ({
    ...r, quantity: r.units, name: r.item_name, revenueCents: Number(r.revenue_cents),
  }));
}

/** Orders grouped by day of week (0=Sunday..6) over the period. */
async function byDayOfWeek(restaurantId, timezone, daysOrPeriod) {
  const { from, to } = toPeriodBounds(daysOrPeriod, timezone);
  const { rows } = await query(
    `SELECT extract(dow FROM (o.created_at AT TIME ZONE $2))::int AS dow,
            COUNT(*)::int AS orders,
            COALESCE(SUM(o.total_cents), 0)::bigint AS revenue_cents
     FROM orders o
     WHERE o.restaurant_id = $1 AND ${REVENUE_SQL_O}
       AND (o.created_at AT TIME ZONE $2)::date BETWEEN $3::date AND $4::date
     GROUP BY dow
     ORDER BY dow`,
    [restaurantId, timezone, from, to]
  );
  return rows.map((r) => ({ dow: r.dow, orders: r.orders, revenueCents: Number(r.revenue_cents) }));
}

/** Orders grouped by hour of day (0..23, restaurant-local time) over the period. */
async function byHour(restaurantId, timezone, daysOrPeriod) {
  const { from, to } = toPeriodBounds(daysOrPeriod, timezone);
  const { rows } = await query(
    `SELECT extract(hour FROM (o.created_at AT TIME ZONE $2))::int AS hour,
            COUNT(*)::int AS orders,
            COALESCE(SUM(o.total_cents), 0)::bigint AS revenue_cents
     FROM orders o
     WHERE o.restaurant_id = $1 AND ${REVENUE_SQL_O}
       AND (o.created_at AT TIME ZONE $2)::date BETWEEN $3::date AND $4::date
     GROUP BY hour
     ORDER BY hour`,
    [restaurantId, timezone, from, to]
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
            UPPER(COALESCE(o.currency, 'USD')) AS currency,
            (SELECT COALESCE(string_agg(s, ', '), '') FROM (
               SELECT DISTINCT ooo.choice_name ||
                 CASE WHEN ooo.quantity > 1 THEN ' ×' || ooo.quantity ELSE '' END AS s
               FROM order_items oi
               JOIN order_item_options ooo ON ooo.order_item_id = oi.id
               WHERE oi.order_id = o.id
             ) t) AS options_summary,
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
              COALESCE(o.currency, s.currency, 'USD') AS currency
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
      `SELECT id, menu_item_id, item_name, unit_price_cents, quantity, line_total_cents,
              is_preorder, preorder_note
       FROM order_items WHERE order_id = $1 ORDER BY created_at`,
      [order.id]
    )
  ).rows;
  await attachOptionSnapshots({ query }, order.items);
  for (const item of order.items) delete item.id;
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
  revenueByCurrency,
  orderSplits,
  topItems,
  byDayOfWeek,
  byHour,
  exportRows,
  getByCode,
  cancelByCustomer,
};
