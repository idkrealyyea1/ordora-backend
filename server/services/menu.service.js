'use strict';

/**
 * Menu items — tenant-scoped queries + the backend-enforced
 * per-restaurant item limit (row-locked so it is race-safe).
 */

const { query, withTx } = require('../db/pool');
const { conflict, notFound } = require('../utils/errors');

async function listOwned(restaurantId) {
  const { rows } = await query(
    `SELECT m.id, m.category_id, c.name AS category_name, m.name, m.description,
            m.price_cents, m.image_path, m.is_available, m.is_popular, m.position,
            m.is_preorder, m.preorder_note,
            m.created_at, m.updated_at
     FROM menu_items m
     JOIN categories c ON c.id = m.category_id
     WHERE m.restaurant_id = $1
     ORDER BY c.position, c.name, m.position, m.created_at`,
    [restaurantId]
  );
  const defs = await require('./options.service').definitionsForItems(
    restaurantId,
    rows.map((r) => r.id)
  );
  for (const row of rows) row.options = defs.get(row.id) || [];
  return rows;
}

async function getOwned(restaurantId, itemId) {
  const { rows } = await query(
    `SELECT id, category_id, name, description, price_cents, image_path,
            is_available, is_popular, position, is_preorder, preorder_note
     FROM menu_items WHERE id = $1 AND restaurant_id = $2`,
    [itemId, restaurantId]
  );
  if (!rows[0]) throw notFound('Menu item not found');
  return rows[0];
}

/** Category must belong to the same tenant. */
async function assertCategoryOwned(restaurantId, categoryId) {
  const { rowCount } = await query(
    'SELECT 1 FROM categories WHERE id = $1 AND restaurant_id = $2',
    [categoryId, restaurantId]
  );
  if (!rowCount) throw notFound('Category not found');
}

async function createOwned(restaurantId, data) {
  await assertCategoryOwned(restaurantId, data.categoryId);
  return withTx(async (client) => {
    // Lock the tenant row so concurrent creations cannot exceed the limit.
    const rest = await client.query(
      'SELECT max_menu_items FROM restaurants WHERE id = $1 FOR UPDATE',
      [restaurantId]
    );
    if (!rest.rows[0]) throw notFound('Restaurant not found');

    // Plan limit wins when the assigned plan sets one (Task 14); otherwise
    // the business row value governs. Same tx, same lock discipline.
    let max = rest.rows[0].max_menu_items;
    const planLim = await client.query(
      `SELECT pe.limit_value FROM subscriptions s
       JOIN plan_entitlements pe ON pe.plan_id = s.plan_id
       WHERE s.restaurant_id = $1 AND pe.capability_key = 'max_menu_items'
         AND pe.limit_value IS NOT NULL`,
      [restaurantId]
    );
    if (planLim.rows[0]) max = planLim.rows[0].limit_value;

    const countRes = await client.query(
      'SELECT COUNT(*)::int AS n FROM menu_items WHERE restaurant_id = $1',
      [restaurantId]
    );
    if (countRes.rows[0].n >= max) {
      throw conflict(
        'MENU_LIMIT_REACHED',
        `Menu limit reached (${max} items). Ask the platform owner to raise it.`,
        [{ limit: max, used: countRes.rows[0].n }]
      );
    }

    const { rows } = await client.query(
      `INSERT INTO menu_items (restaurant_id, category_id, name, description, price_cents, image_path, is_available, is_popular, position, is_preorder, preorder_note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
               COALESCE($9, (SELECT COALESCE(MAX(position), 0) + 1 FROM menu_items WHERE restaurant_id = $1)), $10, $11)
       RETURNING id, category_id, name, description, price_cents, image_path, is_available, is_popular, position, is_preorder, preorder_note`,
      [
        restaurantId,
        data.categoryId,
        data.name,
        data.description || '',
        data.priceCents,
        data.imagePath || null,
        data.isAvailable === undefined ? true : data.isAvailable,
        data.isPopular === undefined ? false : data.isPopular,
        data.position === undefined ? null : data.position,
        data.isPreorder === undefined ? false : data.isPreorder,
        data.preorderNote === undefined ? '' : data.preorderNote,
      ]
    );
    return rows[0];
  });
}

async function updateOwned(restaurantId, itemId, patch) {
  if (patch.categoryId !== undefined) {
    await assertCategoryOwned(restaurantId, patch.categoryId);
  }
  const sets = [];
  const params = [itemId, restaurantId];
  const map = {
    categoryId: 'category_id',
    name: 'name',
    description: 'description',
    priceCents: 'price_cents',
    imagePath: 'image_path',
    isAvailable: 'is_available',
    isPopular: 'is_popular',
    position: 'position',
    isPreorder: 'is_preorder',
    preorderNote: 'preorder_note',
  };
  for (const [key, col] of Object.entries(map)) {
    if (patch[key] !== undefined) {
      params.push(patch[key]);
      sets.push(`${col} = $${params.length}`);
    }
  }
  if (sets.length === 0) return getOwned(restaurantId, itemId);

  const { rows } = await query(
    `UPDATE menu_items SET ${sets.join(', ')}
     WHERE id = $1 AND restaurant_id = $2
     RETURNING id, category_id, name, description, price_cents, image_path, is_available, is_popular, position, is_preorder, preorder_note`,
    params
  );
  if (!rows[0]) throw notFound('Menu item not found');
  return rows[0];
}

async function deleteOwned(restaurantId, itemId) {
  const { rowCount } = await query(
    'DELETE FROM menu_items WHERE id = $1 AND restaurant_id = $2',
    [itemId, restaurantId]
  );
  if (!rowCount) throw notFound('Menu item not found');
}

module.exports = { listOwned, getOwned, createOwned, updateOwned, deleteOwned };
