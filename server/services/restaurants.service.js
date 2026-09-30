'use strict';

/**
 * Restaurant (tenant) data access + public view assembly.
 */

const { query, withTx } = require('../db/pool');
const { conflict, notFound } = require('../utils/errors');
const { isOpenNow, timeToHhmm } = require('../utils/datetime');
// Keep revenue semantics identical to orders.service (confirmed+ only).
const { REVENUE_SQL } = require('./orders.service');
const delivery = require('./delivery.service');

async function slugExists(slug) {
  const { rowCount } = await query('SELECT 1 FROM restaurants WHERE slug = $1', [slug]);
  return rowCount > 0;
}

/** Create tenant + default settings + 7 default hour rows in one transaction. */
async function createRestaurant({ name, slug, maxMenuItems, subscriptionEndsAt, businessType, currency }) {
  return withTx(async (client) => {
    // Serialize on slug uniqueness explicitly for a clean error message.
    const dupe = await client.query('SELECT 1 FROM restaurants WHERE slug = $1', [slug]);
    if (dupe.rowCount > 0) throw conflict('SLUG_TAKEN', 'A restaurant with this URL slug already exists');

    const { rows } = await client.query(
      `INSERT INTO restaurants (name, slug, max_menu_items, subscription_ends_at, business_type)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, slug, maxMenuItems, subscriptionEndsAt || null, businessType || 'restaurant']
    );
    const restaurant = rows[0];
    await client.query(
      'INSERT INTO restaurant_settings (restaurant_id, currency) VALUES ($1, $2)',
      [restaurant.id, currency || 'USD']
    );
    for (let day = 0; day < 7; day++) {
      await client.query(
        'INSERT INTO restaurant_hours (restaurant_id, day_of_week) VALUES ($1, $2)',
        [restaurant.id, day]
      );
    }
    return restaurant;
  });
}

async function updateRestaurant(id, patch) {
  const sets = [];
  const params = [id];
  if (patch.name !== undefined) {
    params.push(patch.name);
    sets.push(`name = $${params.length}`);
  }
  if (patch.slug !== undefined) {
    params.push(patch.slug);
    sets.push(`slug = $${params.length}`);
  }
  if (patch.maxMenuItems !== undefined) {
    params.push(patch.maxMenuItems);
    sets.push(`max_menu_items = $${params.length}`);
  }
  if (patch.isActive !== undefined) {
    params.push(patch.isActive);
    sets.push(`is_active = $${params.length}`);
  }
  if (patch.status !== undefined) {
    params.push(patch.status);
    sets.push(`status = $${params.length}`);
  }
  if (patch.businessType !== undefined) {
    params.push(patch.businessType);
    sets.push(`business_type = $${params.length}`);
  }
  if (sets.length === 0) return getById(id);

  try {
    const { rows } = await query(
      `UPDATE restaurants SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );
    return rows[0] || null;
  } catch (err) {
    if (err.code === '23505') throw conflict('SLUG_TAKEN', 'A restaurant with this URL slug already exists');
    throw err;
  }
}

async function deleteById(id) {
  const { rowCount } = await query('DELETE FROM restaurants WHERE id = $1', [id]);
  return rowCount > 0;
}

async function getById(id) {
  const { rows } = await query('SELECT * FROM restaurants WHERE id = $1', [id]);
  return rows[0] || null;
}

/** Subscription status for the admin panel. NULL / future date = active. */
async function getSubscription(restaurantId) {
  const { rows } = await query(
    'SELECT subscription_ends_at AS "endsAt" FROM restaurants WHERE id = $1',
    [restaurantId]
  );
  const endsAt = rows[0] ? rows[0].endsAt : null;
  const active = !endsAt || new Date(endsAt).getTime() > Date.now();
  return { active, endsAt };
}

async function getBySlug(slug) {
  const { rows } = await query('SELECT * FROM restaurants WHERE slug = $1', [slug]);
  return rows[0] || null;
}

async function getSettings(restaurantId) {
  const { rows } = await query('SELECT * FROM restaurant_settings WHERE restaurant_id = $1', [restaurantId]);
  return rows[0] || null;
}

async function getHours(restaurantId) {
  const { rows } = await query(
    'SELECT day_of_week, is_closed, opens_at, closes_at FROM restaurant_hours WHERE restaurant_id = $1 ORDER BY day_of_week',
    [restaurantId]
  );
  return rows;
}

/**
 * Public storefront payload: everything a customer's browser may see.
 * Never exposes owner-only fields (max_menu_items, is_active internals).
 */
async function getPublicView(slug) {
  const restaurant = await getBySlug(slug);
  if (!restaurant || !restaurant.is_active) return null;
  // 7-day trial: public page also expires — ponytail: reuse getSubscription
  const sub = await getSubscription(restaurant.id);
  if (!sub.active) return null;

  const settings = await getSettings(restaurant.id);
  const hours = await getHours(restaurant.id);

  const categories = (
    await query(
      'SELECT id, name, position FROM categories WHERE restaurant_id = $1 ORDER BY position, name',
      [restaurant.id]
    )
  ).rows;

  const items = (
    await query(
      `SELECT id, category_id, name, description, price_cents, image_path,
              is_available, is_popular, is_preorder, preorder_note
       FROM menu_items WHERE restaurant_id = $1
       ORDER BY position, created_at`,
      [restaurant.id]
    )
  ).rows;

  const optionDefs = await require('./options.service').definitionsForItems(
    restaurant.id,
    items.map((i) => i.id)
  );
  for (const item of items) item.options = optionDefs.get(item.id) || [];

  const openNow =
    restaurant.status === 'open' &&
    (settings.ignore_opening_hours || isOpenNow(hours, settings.timezone));

  const deliveryGroups = await delivery.namesForRestaurant(restaurant.id);

  return {
    name: restaurant.name,
    slug: restaurant.slug,
    businessType: restaurant.business_type || 'restaurant',
    status: restaurant.is_active ? restaurant.status : 'closed',
    openNow,
    deliveryGroups,
    settings: {
      description: settings.description,
      phone: settings.phone,
      whatsapp: settings.whatsapp,
      address: settings.address,
      logoPath: settings.logo_path,
      coverPath: settings.cover_path,
      primaryColor: settings.primary_color,
      secondaryColor: settings.secondary_color,
      currency: settings.currency.toUpperCase(),
      deliveryFeeCents: settings.delivery_fee_cents,
      deliveryEnabled: settings.delivery_enabled !== false,
    },
    hours: hours.map((h) => ({
      day: h.day_of_week,
      closed: h.is_closed,
      opensAt: timeToHhmm(h.opens_at),
      closesAt: timeToHhmm(h.closes_at),
    })),
    categories,
    items,
  };
}

async function countItems(restaurantId) {
  const { rows } = await query('SELECT COUNT(*)::int AS n FROM menu_items WHERE restaurant_id = $1', [restaurantId]);
  return rows[0].n;
}

/**
 * Platform-owner listing with search + filters + item usage.
 */
async function listForOwner({ search, status, limit, offset }) {
  const params = [];
  let where = 'TRUE';

  if (search) {
    const escSearch = search.toLowerCase().replace(/[%_\\]/g, '\\$&');
    params.push(`%${escSearch}%`);
    where += ` AND (LOWER(r.name) LIKE $${params.length} ESCAPE '\\' OR r.slug LIKE $${params.length} ESCAPE '\\')`;
  }
  if (status === 'active') where += ' AND r.is_active = TRUE';
  if (status === 'inactive') where += ' AND r.is_active = FALSE';

  const countRes = await query(`SELECT COUNT(*)::int AS n FROM restaurants r WHERE ${where}`, params);

  params.push(limit, offset);
  const { rows } = await query(
    `SELECT r.id, r.slug, r.name, r.status, r.is_active, r.max_menu_items, r.created_at,
            r.business_type, COALESCE(items.n, 0)::int AS item_count
     FROM restaurants r
     LEFT JOIN (SELECT restaurant_id, COUNT(*) AS n FROM menu_items GROUP BY restaurant_id) items
       ON items.restaurant_id = r.id
     WHERE ${where}
     ORDER BY r.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return { total: countRes.rows[0].n, restaurants: rows };
}

/** Aggregate stats shown on one restaurant's owner detail card. */
async function ownerStats(restaurantId) {
  const itemCount = await countItems(restaurantId);
  const orders7 = await query(
    `SELECT COUNT(*)::int AS n, COALESCE(SUM(total_cents), 0)::bigint AS revenue_cents
     FROM orders
     WHERE restaurant_id = $1 AND created_at >= now() - INTERVAL '7 days'
       AND ${REVENUE_SQL}`,
    [restaurantId]
  );
  const pending = await query(
    `SELECT COUNT(*)::int AS n FROM orders WHERE restaurant_id = $1 AND status = 'pending'`,
    [restaurantId]
  );
  return {
    itemCount,
    ordersLast7d: orders7.rows[0].n,
    revenueLast7dCents: Number(orders7.rows[0].revenue_cents),
    pendingOrders: pending.rows[0].n,
  };
}

/** Platform-wide overview numbers. Single-currency totals are kept for
 *  backwards compatibility; revenueByCurrency adds context without conversion. */
async function platformOverview() {  const res = await query(
    `SELECT
       (SELECT COUNT(*)::int FROM restaurants) AS restaurants_total,
       (SELECT COUNT(*)::int FROM restaurants WHERE is_active) AS restaurants_active,
       (SELECT COUNT(*)::int FROM orders WHERE created_at >= date_trunc('day', now())) AS orders_today,
       (SELECT COALESCE(SUM(total_cents), 0)::bigint FROM orders
          WHERE created_at >= date_trunc('day', now()) AND ${REVENUE_SQL}) AS revenue_today_cents`
  );
  const byCurrency = await query(
    `SELECT UPPER(COALESCE(o.currency, s.currency, 'USD')) AS currency,
            COALESCE(SUM(o.total_cents), 0)::bigint AS cents
     FROM orders o
     JOIN restaurants r ON r.id = o.restaurant_id
     LEFT JOIN restaurant_settings s ON s.restaurant_id = r.id
     WHERE o.created_at >= date_trunc('day', now()) AND ${REVENUE_SQL_O}
     GROUP BY 1 ORDER BY 1`
  );
  const row = res.rows[0];
  return {
    restaurantsTotal: row.restaurants_total,
    restaurantsActive: row.restaurants_active,
    ordersToday: row.orders_today,
    revenueTodayCents: Number(row.revenue_today_cents),
    revenueByCurrency: byCurrency.rows.map((b) => ({ currency: b.currency, cents: Number(b.cents) })),
  };
}

/** Per-restaurant summary for owner CSV export (30-day window). */
async function reportSummaryForOwner() {
  const { rows } = await query(
    `SELECT r.name, r.slug, r.is_active AS "isActive", r.created_at AS "createdAt",
            UPPER(COALESCE(s.currency, 'USD')) AS "currency",
            COALESCE(items.n, 0)::int AS "itemCount",
            COALESCE(o7.orders, 0)::int AS "orders30d",
            COALESCE(o7.revenue, 0)::bigint AS "revenue30dCents",
            COALESCE(o30.orders, 0)::int AS "ordersAllTime"
     FROM restaurants r
     LEFT JOIN restaurant_settings s ON s.restaurant_id = r.id
     LEFT JOIN (SELECT restaurant_id, COUNT(*) AS n FROM menu_items GROUP BY restaurant_id) items
       ON items.restaurant_id = r.id
     LEFT JOIN (
       SELECT restaurant_id, COUNT(*) AS orders, SUM(total_cents) AS revenue
       FROM orders WHERE ${REVENUE_SQL} AND created_at >= now() - INTERVAL '30 days'
       GROUP BY restaurant_id
     ) o7 ON o7.restaurant_id = r.id
     LEFT JOIN (
       SELECT restaurant_id, COUNT(*) AS orders
       FROM orders WHERE ${REVENUE_SQL}
       GROUP BY restaurant_id
     ) o30 ON o30.restaurant_id = r.id
     ORDER BY r.created_at ASC`
  );
  return rows.map((r) => ({ ...r, revenue30dCents: Number(r.revenue30dCents), isActive: Boolean(r.isActive) }));
}

/** Public homepage directory: every active restaurant with showcase data. */
async function listPublicDirectory() {
  const rows = (
    await query(
      `SELECT r.id, r.slug, r.name, r.status, r.business_type,
              s.description, s.logo_path, s.cover_path, s.currency,
              s.timezone, s.ignore_opening_hours, s.name_en,
              (SELECT COUNT(*)::int FROM menu_items m
                 WHERE m.restaurant_id = r.id AND m.is_available) AS item_count
       FROM restaurants r
       LEFT JOIN restaurant_settings s ON s.restaurant_id = r.id
       WHERE r.is_active AND (r.subscription_ends_at IS NULL OR r.subscription_ends_at > now())
       ORDER BY r.created_at ASC`
    )
  ).rows;

  if (rows.length === 0) return [];

  const hoursRows = (
    await query(
      'SELECT restaurant_id, day_of_week, is_closed, opens_at, closes_at FROM restaurant_hours WHERE restaurant_id = ANY($1::uuid[])',
      [rows.map((r) => r.id)]
    )
  ).rows;

  return rows.map((r) => {
    let openNow = false;
    if (r.status === 'open') {
      if (r.ignore_opening_hours) openNow = true;
      else {
        const mine = hoursRows.filter((h) => h.restaurant_id === r.id);
        openNow = isOpenNow(mine, r.timezone);
      }
    }
    return {
      slug: r.slug,
      name: r.name,
      nameEn: r.name_en || '',
      businessType: r.business_type || 'restaurant',
      description: r.description || '',
      logoPath: r.logo_path,
      coverPath: r.cover_path,
      currency: r.currency || 'USD',
      itemCount: r.item_count || 0,
      openNow,
    };
  });
}

async function assertExists(id) {
  const row = await getById(id);
  if (!row) throw notFound('Restaurant not found');
  return row;
}

module.exports = {
  slugExists,
  createRestaurant,
  updateRestaurant,
  deleteById,
  getById,
  assertExists,
  getSubscription,
  getBySlug,
  getSettings,
  getHours,
  getPublicView,
  listPublicDirectory,
  countItems,
  listForOwner,
  ownerStats,
  platformOverview,
  reportSummaryForOwner,
};
