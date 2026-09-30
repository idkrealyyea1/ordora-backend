'use strict';

/**
 * Product option groups + choices — tenant-scoped CRUD mirroring menu.service.
 * Snapshots live on order lines (order_item_options); definitions here
 * never rewrite history.
 */

const { query } = require('../db/pool');
const { notFound } = require('../utils/errors');

/** Item must belong to the same tenant. */
async function assertItemOwned(restaurantId, menuItemId) {
  const { rowCount } = await query(
    'SELECT 1 FROM menu_items WHERE id = $1 AND restaurant_id = $2',
    [menuItemId, restaurantId]
  );
  if (!rowCount) throw notFound('Menu item not found');
}

async function assertGroupOwned(restaurantId, groupId) {
  const { rows } = await query(
    'SELECT * FROM option_groups WHERE id = $1 AND restaurant_id = $2',
    [groupId, restaurantId]
  );
  if (!rows[0]) throw notFound('Option group not found');
  return rows[0];
}

const GROUP_COLS = 'id, menu_item_id, name, is_required, min_picks, max_picks, pricing, position';
const CHOICE_COLS = 'id, group_id, name, price_cents, max_quantity, is_available, position';

async function listGroupsOwned(restaurantId, menuItemId) {
  const { rows } = await query(
    `SELECT ${GROUP_COLS} FROM option_groups WHERE restaurant_id = $1 AND menu_item_id = $2 ORDER BY position, name`,
    [restaurantId, menuItemId]
  );
  return rows;
}

async function createGroupOwned(restaurantId, data) {
  await assertItemOwned(restaurantId, data.menuItemId);
  const { rows } = await query(
    `INSERT INTO option_groups (restaurant_id, menu_item_id, name, is_required, min_picks, max_picks, pricing, position)
     VALUES ($1, $2, $3, $4, $5, $6, $7,
             COALESCE($8, (SELECT COALESCE(MAX(position), 0) + 1 FROM option_groups WHERE menu_item_id = $2)))
     RETURNING ${GROUP_COLS}`,
    [
      restaurantId, data.menuItemId, data.name,
      data.isRequired === undefined ? false : data.isRequired,
      data.minPicks === undefined ? 0 : data.minPicks,
      data.maxPicks === undefined ? 1 : data.maxPicks,
      data.pricing === undefined ? 'adjust' : data.pricing,
      data.position === undefined ? null : data.position,
    ]
  );
  return rows[0];
}

async function updateGroupOwned(restaurantId, groupId, patch) {
  await assertGroupOwned(restaurantId, groupId);
  const map = { name: 'name', isRequired: 'is_required', minPicks: 'min_picks', maxPicks: 'max_picks', pricing: 'pricing', position: 'position' };
  const sets = [];
  const params = [groupId, restaurantId];
  for (const [key, col] of Object.entries(map)) {
    if (patch[key] !== undefined) {
      params.push(patch[key]);
      sets.push(`${col} = $${params.length}`);
    }
  }
  if (sets.length === 0) {
    const { rows } = await query(`SELECT ${GROUP_COLS} FROM option_groups WHERE id = $1 AND restaurant_id = $2`, [groupId, restaurantId]);
    return rows[0];
  }
  const { rows } = await query(
    `UPDATE option_groups SET ${sets.join(', ')} WHERE id = $1 AND restaurant_id = $2 RETURNING ${GROUP_COLS}`,
    params
  );
  if (!rows[0]) throw notFound('Option group not found');
  return rows[0];
}

async function deleteGroupOwned(restaurantId, groupId) {
  const { rowCount } = await query(
    'DELETE FROM option_groups WHERE id = $1 AND restaurant_id = $2',
    [groupId, restaurantId]
  );
  if (!rowCount) throw notFound('Option group not found');
}

async function listChoicesOwned(restaurantId, groupId) {
  const group = await assertGroupOwned(restaurantId, groupId);
  const { rows } = await query(
    `SELECT ${CHOICE_COLS} FROM option_choices WHERE group_id = $1 ORDER BY position, name`,
    [group.id]
  );
  return rows;
}

async function createChoiceOwned(restaurantId, groupId, data) {
  const group = await assertGroupOwned(restaurantId, groupId);
  const { rows } = await query(
    `INSERT INTO option_choices (group_id, restaurant_id, name, price_cents, max_quantity, is_available, position)
     VALUES ($1, $2, $3, $4, $5, $6,
             COALESCE($7, (SELECT COALESCE(MAX(position), 0) + 1 FROM option_choices WHERE group_id = $1)))
     RETURNING ${CHOICE_COLS}`,
    [
      group.id, restaurantId, data.name,
      data.priceCents === undefined ? 0 : data.priceCents,
      data.maxQuantity === undefined ? 1 : data.maxQuantity,
      data.isAvailable === undefined ? true : data.isAvailable,
      data.position === undefined ? null : data.position,
    ]
  );
  return rows[0];
}

async function updateChoiceOwned(restaurantId, groupId, choiceId, patch) {
  await assertGroupOwned(restaurantId, groupId);
  const map = { name: 'name', priceCents: 'price_cents', maxQuantity: 'max_quantity', isAvailable: 'is_available', position: 'position' };
  const sets = [];
  const params = [choiceId, groupId, restaurantId];
  for (const [key, col] of Object.entries(map)) {
    if (patch[key] !== undefined) {
      params.push(patch[key]);
      sets.push(`${col} = $${params.length}`);
    }
  }
  const sel = `SELECT ${CHOICE_COLS} FROM option_choices WHERE id = $1 AND group_id = $2 AND restaurant_id = $3`;
  if (sets.length === 0) {
    const { rows } = await query(sel, params);
    if (!rows[0]) throw notFound('Option choice not found');
    return rows[0];
  }
  const { rows } = await query(
    `UPDATE option_choices SET ${sets.join(', ')} WHERE id = $1 AND group_id = $2 AND restaurant_id = $3 RETURNING ${CHOICE_COLS}`,
    params
  );
  if (!rows[0]) throw notFound('Option choice not found');
  return rows[0];
}

async function deleteChoiceOwned(restaurantId, groupId, choiceId) {
  await assertGroupOwned(restaurantId, groupId);
  const { rowCount } = await query(
    'DELETE FROM option_choices WHERE id = $1 AND group_id = $2 AND restaurant_id = $3',
    [choiceId, groupId, restaurantId]
  );
  if (!rowCount) throw notFound('Option choice not found');
}

/**
 * Batched definitions for storefront/admin item lists (no N+1).
 * Returns Map menuItemId -> [groups with choices[]]. Items without
 * groups map to [].
 */
async function definitionsForItems(restaurantId, menuItemIds) {
  const out = new Map((menuItemIds || []).map((id) => [id, []]));
  if (!menuItemIds || menuItemIds.length === 0) return out;
  const { rows } = await query(
    `SELECT g.menu_item_id, g.id AS group_id, g.name AS group_name,
            g.is_required, g.min_picks, g.max_picks, g.pricing, g.position AS gpos,
            c.id AS choice_id, c.name AS choice_name, c.price_cents, c.max_quantity,
            c.is_available, c.position AS cpos
     FROM option_groups g
     LEFT JOIN option_choices c ON c.group_id = g.id
     WHERE g.restaurant_id = $1 AND g.menu_item_id = ANY($2::uuid[])
     ORDER BY g.position, g.name, c.position, c.name`,
    [restaurantId, menuItemIds]
  );
  const groupsById = new Map();
  for (const r of rows) {
    let g = groupsById.get(r.group_id);
    if (!g) {
      g = {
        id: r.group_id, name: r.group_name, is_required: r.is_required,
        min_picks: r.min_picks, max_picks: r.max_picks, pricing: r.pricing, choices: [],
      };
      groupsById.set(r.group_id, g);
      const list = out.get(r.menu_item_id);
      if (list) list.push(g);
    }
    if (r.choice_id) {
      g.choices.push({
        id: r.choice_id, name: r.choice_name, price_cents: Number(r.price_cents),
        max_quantity: r.max_quantity, is_available: r.is_available,
      });
    }
  }
  return out;
}

module.exports = {
  listGroupsOwned,
  createGroupOwned,
  updateGroupOwned,
  deleteGroupOwned,
  listChoicesOwned,
  createChoiceOwned,
  updateChoiceOwned,
  deleteChoiceOwned,
  definitionsForItems,
};
