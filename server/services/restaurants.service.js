'use strict';

/**
 * Restaurant (tenant) data access + public view assembly.
 */

const { query, withTx } = require('../db/pool');
const { conflict, notFound, badRequest } = require('../utils/errors');
const { isOpenNow, timeToHhmm } = require('../utils/datetime');
const observe = require('../utils/observe');
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
    // Every tenant gets exactly one subscription row (Task 14): admin and
    // demo creations land here too, so no path can leave a row-less business.
    const planRes = await client.query(`SELECT id FROM plans WHERE key = 'standard'`);
    if (planRes.rows[0]) {
      const end = subscriptionEndsAt || null;
      await client.query(
          `INSERT INTO subscriptions
             (restaurant_id, plan_id, status, current_period_start, current_period_end, grace_until)
           VALUES ($1, $2, 'active', now(), $3::timestamptz,
             CASE WHEN $3::timestamptz IS NULL THEN NULL ELSE ($3::timestamptz + INTERVAL '7 days') END)
          ON CONFLICT (restaurant_id) DO NOTHING`,
        [restaurant.id, planRes.rows[0].id, end]
      );
    }
    observe.info('business.created', { restaurantId: restaurant.id, slug: restaurant.slug });
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

/**
 * Subscription status for gates and panels. Derivation-aware (Task 14):
 * joins the subscription row and resolves trial/active/grace/expired through
 * server time; stored suspended/cancelled override. Falls back to the legacy
 * clock when no subscription row exists. `active` stays true through grace
 * (recovery-first); `endsAt` is the instant gates should enforce.
 */
async function getSubscription(restaurantId) {
  const { rows } = await query(
    `SELECT r.subscription_ends_at AS "endsAt", s.status, s.current_period_end,
            s.grace_until, s.cancel_effective_at
     FROM restaurants r LEFT JOIN subscriptions s ON s.restaurant_id = r.id
     WHERE r.id = $1`,
    [restaurantId]
  );
  if (!rows[0]) return { active: false, endsAt: null, state: 'expired' };
  if (!rows[0].status) {
    const endsAt = rows[0].endsAt;
    const active = !endsAt || new Date(endsAt).getTime() > Date.now();
    return { active, endsAt, state: active ? 'active' : 'expired' };
  }
  const { derive } = require('./subscriptions.service');
  const eff = derive(
    {
      status: rows[0].status,
      current_period_end: rows[0].current_period_end,
      grace_until: rows[0].grace_until,
      cancel_effective_at: rows[0].cancel_effective_at,
    },
    null
  );
  const accessStates = ['trial', 'active', 'grace'];
  return { active: accessStates.includes(eff.state), endsAt: eff.accessEndsAt, state: eff.state };
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
 * Task 14 (clarified): lapsed access degrades the storefront instead of
 * deleting it — expired/cancelled-effective stores render the menu with
 * ordering disabled; suspended stores render the controlled notice.
 * Only platform-deactivated (`is_active = false`) stores 404.
 */
async function getPublicView(slug) {
  const restaurant = await getBySlug(slug);
  if (!restaurant || !restaurant.is_active) return null;
  const sub = await getSubscription(restaurant.id);
  const orderingBlocked = !sub.active;
  const noticeKey = !sub.active
    ? (sub.state === 'suspended' ? 'sub_store_suspended' : 'sub_store_expired')
    : null;

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

  // Ordered additional photos per item. One LEFT JOIN for the whole menu, not a
  // query per item. `image_path` is untouched and still element 0 of `images`,
  // so every existing consumer of image_path keeps working.
  const itemPhotos = await itemPhotoMap(restaurant.id, items.map((i) => i.id));
  for (const item of items) {
    const extra = itemPhotos.get(item.id) || [];
    item.images = (item.image_path ? [item.image_path] : []).concat(extra);
  }

  const heroImages = await getHeroImages(restaurant.id);

  const openNow =
    restaurant.status === 'open' &&
    (settings.ignore_opening_hours || isOpenNow(hours, settings.timezone));

  const deliveryGroups = await delivery.namesForRestaurant(restaurant.id);

  return {
    name: restaurant.name,
    slug: restaurant.slug,
    businessType: restaurant.business_type || 'restaurant',
    orderingBlocked,
    noticeKey,
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
      // Free-delivery threshold is public: the storefront shows progress
      // toward it. The server recomputes the fee at checkout regardless.
      freeDeliveryEnabled: settings.free_delivery_enabled === true,
      freeDeliveryThresholdCents: settings.free_delivery_threshold_cents || 0,
      storefrontLanguage: settings.storefront_language || 'ar',
    },
    heroImages: heroImages.map((h) => ({ imagePath: h.image_path, position: h.position, isPrimary: h.is_primary })),
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
            r.business_type, r.subscription_ends_at,
            s.status AS sub_status, s.current_period_end AS sub_ends_at,
            p.key AS plan_key, COALESCE(items.n, 0)::int AS item_count
     FROM restaurants r
     LEFT JOIN subscriptions s ON s.restaurant_id = r.id
     LEFT JOIN plans p ON p.id = s.plan_id
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
       LEFT JOIN subscriptions sub ON sub.restaurant_id = r.id
       WHERE r.is_active AND (r.subscription_ends_at IS NULL OR r.subscription_ends_at > now())
         AND (sub.status IS NULL OR sub.status IN ('trial', 'active', 'grace')
           OR (sub.status = 'cancelled'
             AND COALESCE(sub.cancel_effective_at, sub.current_period_end, now()) > now()))
         AND (sub.status IS NULL OR sub.status <> 'suspended')
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

async function getHeroImages(businessId) {
  const { rows } = await query(
    'SELECT id, image_path, position, is_primary, is_active FROM business_hero_images WHERE business_id = $1 AND is_active = true ORDER BY position',
    [businessId]
  );
  return rows;
}

async function getHeroImagesForSlug(slug) {
  const { rows } = await query(
    `SELECT h.id, h.image_path, h.position, h.is_primary
     FROM business_hero_images h
     JOIN restaurants r ON r.id = h.business_id
     WHERE r.slug = $1 AND h.is_active = true
     ORDER BY h.position`,
    [slug]
  );
  return rows;
}

/** Next free hero position for a business. Includes soft-deleted rows so a reused
 *  position can never collide with UNIQUE (business_id, position). */
async function nextHeroPosition(businessId) {
  const { rows } = await query(
    'SELECT COALESCE(MAX(position), -1) + 1 AS next FROM business_hero_images WHERE business_id = $1',
    [businessId]
  );
  return rows[0].next;
}

async function addHeroImage(businessId, imagePath, options) {
  const { rows: cnt } = await query('SELECT COUNT(*)::int AS n FROM business_hero_images WHERE business_id = $1 AND is_active = true', [businessId]);
  const platform = require('./platform.service');
  const { max_hero_images } = await platform.getPricing();
  const maxHero = max_hero_images ?? 6;
  if (cnt[0].n >= maxHero) throw badRequest('Maximum ' + maxHero + ' hero images');
  const isPrimary = (options && options.isPrimary) !== undefined ? options.isPrimary : (cnt[0].n === 0);
  if (isPrimary) {
    await query('UPDATE business_hero_images SET is_primary = false WHERE business_id = $1', [businessId]);
  }
  // MAX(position) must scan ALL rows, not just active ones: removeHeroImage
  // soft-deletes and keeps the row, so scanning active rows only hands back a
  // position that a soft-deleted row still occupies, and UNIQUE (business_id,
  // position) then rejects the insert with 23505 on add-after-remove.
  const position = (options && options.position) !== undefined
    ? options.position
    : await nextHeroPosition(businessId);
  const { rows } = await query(
    `INSERT INTO business_hero_images (business_id, image_path, position, is_primary, is_active)
     VALUES ($1, $2, $3, $4, true)
     RETURNING *`,
    [businessId, imagePath, position, isPrimary]
  );
  return rows[0];
}

async function updateHeroImage(businessId, imageId, patch) {
  const sets = [];
  const params = [businessId, imageId];
  if (patch.position !== undefined) { params.push(patch.position); sets.push(`position = $${params.length}`); }
  if (patch.isPrimary !== undefined) {
    if (patch.isPrimary) {
      await query('UPDATE business_hero_images SET is_primary = false WHERE business_id = $1', [businessId]);
    }
    params.push(patch.isPrimary); sets.push(`is_primary = $${params.length}`);
  }
  if (patch.isActive !== undefined) { params.push(patch.isActive); sets.push(`is_active = $${params.length}`); }
  if (sets.length === 0) return null;
  const { rows } = await query(
    `UPDATE business_hero_images SET ${sets.join(', ')} WHERE business_id = $1 AND id = $2 RETURNING *`,
    params
  );
  return rows[0] || null;
}

async function removeHeroImage(businessId, imageId) {
  const { rowCount } = await query(
    'UPDATE business_hero_images SET is_active = false WHERE business_id = $1 AND id = $2',
    [businessId, imageId]
  );
  if (rowCount > 0) await ensureHeroPrimary(businessId);
  return rowCount > 0;
}

/** Map of menu_item_id → ordered additional image paths. One query for the whole
 *  menu (Constitution XXIV: no N+1). Returns [] for an item with no extra photos. */
async function itemPhotoMap(businessId, itemIds) {
  const map = new Map();
  if (!itemIds.length) return map;
  const { rows } = await query(
    `SELECT menu_item_id, image_path
       FROM menu_item_images
      WHERE restaurant_id = $1 AND menu_item_id = ANY($2::uuid[])
      ORDER BY menu_item_id, position`,
    [businessId, itemIds]
  );
  for (const row of rows) {
    if (!map.has(row.menu_item_id)) map.set(row.menu_item_id, []);
    map.get(row.menu_item_id).push(row.image_path);
  }
  return map;
}

async function listItemImages(businessId, itemId) {
  const { rows } = await query(
    `SELECT id, menu_item_id, image_path, position
       FROM menu_item_images
      WHERE restaurant_id = $1 AND menu_item_id = $2
      ORDER BY position`,
    [businessId, itemId]
  );
  return rows;
}

async function addItemImage(businessId, itemId, imagePath) {
  const { rows } = await query(
    'SELECT COALESCE(MAX(position), -1) + 1 AS next FROM menu_item_images WHERE menu_item_id = $1',
    [itemId]
  );
  const { rows: out } = await query(
    `INSERT INTO menu_item_images (restaurant_id, menu_item_id, image_path, position)
     VALUES ($1, $2, $3, $4)
     RETURNING id, menu_item_id, image_path, position`,
    [businessId, itemId, imagePath, rows[0].next]
  );
  return out[0];
}

/** Apply a reorder as a permutation in one transaction. A bare per-row position
 *  update would transiently violate UNIQUE (menu_item_id, position). */
async function reorderItemImages(businessId, itemId, orderedIds) {
  if (!Array.isArray(orderedIds) || !orderedIds.length) throw badRequest('order must be a non-empty array');
  const unique = [...new Set(orderedIds)];
  if (unique.length !== orderedIds.length) throw badRequest('order contains duplicate images');
  const { rows: owned } = await query(
    `SELECT id FROM menu_item_images
      WHERE restaurant_id = $1 AND menu_item_id = $2 AND id = ANY($3::uuid[])`,
    [businessId, itemId, unique]
  );
  if (owned.length !== unique.length) throw badRequest('order contains unknown images');
  await withTx(async (client) => {
    const { rows: maxRows } = await client.query(
      'SELECT COALESCE(MAX(position), 0)::int AS max_pos FROM menu_item_images WHERE menu_item_id = $1',
      [itemId]
    );
    const offset = maxRows[0].max_pos + 1;
    await client.query(
      `UPDATE menu_item_images m
          SET position = $3 + t.rn
         FROM (
           SELECT id, row_number() OVER (ORDER BY position, id)::int AS rn
             FROM menu_item_images WHERE menu_item_id = $1
         ) t
        WHERE m.id = t.id AND m.menu_item_id = $1`,
      [itemId, itemId, offset]
    );
    for (let i = 0; i < orderedIds.length; i += 1) {
      await client.query(
        'UPDATE menu_item_images SET position = $3 WHERE menu_item_id = $1 AND id = $2',
        [itemId, orderedIds[i], i]
      );
    }
  });
  return listItemImages(businessId, itemId);
}

async function removeItemImage(businessId, itemId, imageId) {
  const { rowCount } = await query(
    'DELETE FROM menu_item_images WHERE restaurant_id = $1 AND menu_item_id = $2 AND id = $3',
    [businessId, itemId, imageId]
  );
  return rowCount > 0;
}

/** Guarantee exactly one active primary. Soft-deleting the primary used to leave a
 *  business with none, and addHeroImage only defaults isPrimary when the count is 0,
 *  so no later upload would claim it either. */
async function ensureHeroPrimary(businessId) {
  const { rows } = await query(
    `SELECT id FROM business_hero_images
      WHERE business_id = $1 AND is_active = true
      ORDER BY (is_primary) DESC, position ASC`,
    [businessId]
  );
  if (rows.length === 0) return null;
  const current = await query(
    'SELECT id FROM business_hero_images WHERE business_id = $1 AND is_active = true AND is_primary = true',
    [businessId]
  );
  if (current.rows.length === 1 && current.rows[0].id === rows[0].id) return rows[0].id;
  await query('UPDATE business_hero_images SET is_primary = (id = $2) WHERE business_id = $1', [businessId, rows[0].id]);
  return rows[0].id;
}

/** Apply a reorder as a permutation in one transaction. Assigning a bare position
 *  per row transiently violates UNIQUE (business_id, position), so rows are first
 *  shifted into a negative range that no live position occupies. */
async function reorderHeroImages(businessId, orderedIds) {
  if (!Array.isArray(orderedIds) || !orderedIds.length) throw badRequest('order must be a non-empty array');
  const unique = [...new Set(orderedIds)];
  if (unique.length !== orderedIds.length) throw badRequest('order contains duplicate images');
  const { rows: owned } = await query(
    'SELECT id FROM business_hero_images WHERE business_id = $1 AND is_active = true AND id = ANY($2::uuid[])',
    [businessId, unique]
  );
  if (owned.length !== unique.length) throw badRequest('order contains unknown images');
  // Two phases inside one transaction.
  //
  // Phase 1 parks EVERY row (soft-deleted ones too — they keep their position and
  // are covered by UNIQUE (business_id, position)) at distinct values above the
  // current maximum. Phase 2 then writes the requested order for the active rows.
  // Neither phase can transiently violate the unique constraint.
  //
  // The parking range must stay non-negative: hero_images_position_check enforces
  // position >= 0, so a negative parking range is rejected outright.
  await withTx(async (client) => {
    const { rows: maxRows } = await client.query(
      'SELECT COALESCE(MAX(position), 0)::int AS max_pos FROM business_hero_images WHERE business_id = $1',
      [businessId]
    );
    const offset = maxRows[0].max_pos + 1;
    await client.query(
      `UPDATE business_hero_images h
          SET position = $2 + t.rn
         FROM (
           SELECT id, row_number() OVER (ORDER BY position, id)::int AS rn
             FROM business_hero_images
            WHERE business_id = $1
         ) t
        WHERE h.id = t.id AND h.business_id = $1`,
      [businessId, offset]
    );
    for (let i = 0; i < orderedIds.length; i += 1) {
      await client.query(
        'UPDATE business_hero_images SET position = $3 WHERE business_id = $1 AND id = $2',
        [businessId, orderedIds[i], i]
      );
    }
  });
  await ensureHeroPrimary(businessId);
  return getHeroImages(businessId);
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
  getHeroImages,
  getHeroImagesForSlug,
  addHeroImage,
  updateHeroImage,
  removeHeroImage,
  reorderHeroImages,
  ensureHeroPrimary,
  itemPhotoMap,
  listItemImages,
  addItemImage,
  reorderItemImages,
  removeItemImage,
};
