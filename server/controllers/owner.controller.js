'use strict';

/**
 * Platform-owner controller: tenant management, admin accounts,
 * platform-wide monitoring. All handlers require role='owner'.
 */

const crypto = require('crypto');
const restaurants = require('../services/restaurants.service');
const users = require('../services/users.service');
const ordersService = require('../services/orders.service');
const settingsService = require('../services/settings.service');
const delivery = require('../services/delivery.service');
const { normalizeSlug } = require('../utils/checks');
const { conflict, notFound, badRequest } = require('../utils/errors');
const { assertUuid } = require('../utils/checks');
const { sendCsv } = require('../utils/csv');
const { asyncHandler } = require('../utils/errors');
const v = require('../validators');

async function overview(req, res) {
  res.json(await restaurants.platformOverview());
}

/** GET /api/owner/reports/restaurants.csv — per-restaurant summary for owners. */
async function restaurantsReportCsv(req, res) {
  const rows = await restaurants.reportSummaryForOwner();
  const header = ['Name', 'Slug', 'Active', 'Menu items', 'Orders (30d)', 'Revenue (30d cents)', 'Orders (all time)', 'Created'];
  const body = rows.map((r) => [
    r.name, r.slug, r.isActive ? 'yes' : 'no', r.itemCount,
    r.orders30d, r.revenue30dCents, r.ordersAllTime, r.createdAt,
  ]);
  sendCsv(res, 'restaurants-summary.csv', [header, ...body]);
}

async function listRestaurants(req, res) {
  const page = v.validatePagination(req.query);
  const search = req.query.search ? String(req.query.search).slice(0, 80) : null;
  const status = ['active', 'inactive'].includes(req.query.status) ? req.query.status : null;

  const { total, restaurants: rows } = await restaurants.listForOwner({
    search,
    status,
    limit: page.limit,
    offset: page.offset,
  });

  res.json({
    total,
    page: page.page,
    limit: page.limit,
    restaurants: rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      status: r.status,
      isActive: r.is_active,
      maxMenuItems: r.max_menu_items,
      itemCount: r.item_count,
      createdAt: r.created_at,
    })),
  });
}

async function createRestaurant(req, res) {
  const data = v.validateRestaurantCreate(req.body);
  if (data.slug === undefined) {
    data.slug = normalizeSlug(data.name); // derive from name
  }
  if (await restaurants.slugExists(data.slug)) {
    throw conflict('SLUG_TAKEN', 'A restaurant with this URL slug already exists');
  }
  // 7-day trial support — ponytail: single field, owner sets trialDays=7 to auto-expire
  data.subscriptionEndsAt = v.validateTrialWindow(req.body);
  const restaurant = await restaurants.createRestaurant(data);

  // Optionally create the first admin account in the same request.
  let admin = null;
  let generatedPassword;
  if (req.body.adminUsername) {
    const username = v.validateUsername(req.body.adminUsername);
    const email = v.validateEmailOptional(req.body.adminEmail);
    let password = req.body.adminPassword;
    if (password === undefined || password === '') {
      generatedPassword = crypto.randomBytes(12).toString('base64url');
      password = generatedPassword;
    } else {
      password = v.validatePassword(password);
    }
    admin = await users.createAdmin({ restaurantId: restaurant.id, username, email, password });
  }

  res.status(201).json({
    restaurant: {
      id: restaurant.id,
      slug: restaurant.slug,
      name: restaurant.name,
      status: restaurant.status,
      isActive: restaurant.is_active,
      maxMenuItems: restaurant.max_menu_items,
      createdAt: restaurant.created_at,
    },
    ...(admin
      ? {
          admin: {
            id: admin.id,
            username: admin.username,
            // Echoed only when the server generated it (shown once):
            generatedPassword,
          },
        }
      : {}),
  });
}

async function getRestaurant(req, res) {
  const id = assertUuid(req.params.id, 'id');
  const restaurant = await restaurants.getById(id);
  if (!restaurant) throw notFound('Restaurant not found');

  res.json({
    restaurant: {
      id: restaurant.id,
      slug: restaurant.slug,
      name: restaurant.name,
      status: restaurant.status,
      isActive: restaurant.is_active,
      maxMenuItems: restaurant.max_menu_items,
      createdAt: restaurant.created_at,
      settings: await restaurants.getSettings(id),
    },
    stats: await restaurants.ownerStats(id),
    admins: await users.listAdminsForRestaurant(id),
  });
}

/** Owner update: identity/limits/activation here; colors proxied to settings. */
async function updateRestaurant(req, res) {
  const id = assertUuid(req.params.id, 'id');
  await restaurants.assertExists(id);
  const patch = v.validateRestaurantUpdate(req.body);

  const colorKeys = ['primaryColor', 'secondaryColor'];
  const restPatch = {};
  const settingsPatch = {};
  for (const [k, val] of Object.entries(patch)) {
    if (colorKeys.includes(k)) settingsPatch[k] = val;
    else restPatch[k] = val;
  }

  let updated = null;
  if (Object.keys(restPatch).length > 0) {
    updated = await restaurants.updateRestaurant(id, restPatch);
  }
  if (Object.keys(settingsPatch).length > 0) {
    await require('../services/settings.service').updateOwned(id, settingsPatch);
  }

  if (!updated) updated = await restaurants.getById(id);
  res.json({
    restaurant: {
      id: updated.id,
      slug: updated.slug,
      name: updated.name,
      status: updated.status,
      isActive: updated.is_active,
      maxMenuItems: updated.max_menu_items,
    },
  });
}

async function deleteRestaurant(req, res) {
  const id = assertUuid(req.params.id, 'id');
  const ok = await restaurants.deleteById(id);
  if (!ok) throw notFound('Restaurant not found');
  res.json({ ok: true });
}

/* --------------------- restaurant admins ------------------------- */

function requireOwnedAdmin(req) {
  const userId = assertUuid(req.params.userId, 'userId');
  return userId;
}

async function createAdminUser(req, res) {
  const restaurantId = assertUuid(req.params.id, 'id');
  await restaurants.assertExists(restaurantId);

  const username = v.validateUsername(req.body.username);
  const email = v.validateEmailOptional(req.body.email);
  const password = v.validatePassword(req.body.password);
  const admin = await users.createAdmin({ restaurantId, username, email, password });
  res.status(201).json({ admin });
}

/** Reset an admin's password. Generates one when none is provided. */
async function resetAdminPassword(req, res) {
  const restaurantId = assertUuid(req.params.id, 'id');
  const userId = requireOwnedAdmin(req);

  // Ensure the target account belongs to this restaurant.
  const target = await users.findById(userId);
  if (!target || target.role !== 'admin' || target.restaurant_id !== restaurantId) {
    throw notFound('Admin account not found for this restaurant');
  }

  const generated = !req.body.password;
  const password = generated
    ? crypto.randomBytes(12).toString('base64url')
    : v.validatePassword(req.body.password);

  await users.setPassword(userId, password);
  res.json({ ok: true, ...(generated ? { password } : {}) });
}

async function toggleAdminActive(req, res) {
  const restaurantId = assertUuid(req.params.id, 'id');
  const userId = requireOwnedAdmin(req);
  const active = req.body.isActive;

  const target = await users.findById(userId);
  if (!target || target.role !== 'admin' || target.restaurant_id !== restaurantId) {
    throw notFound('Admin account not found for this restaurant');
  }

  const result = await users.setIsActive(userId, Boolean(active));
  if (!result) throw badRequest('Nothing changed');
  res.json({ ok: true, isActive: Boolean(active) });
}

async function deleteAdminUser(req, res) {
  const restaurantId = assertUuid(req.params.id, 'id');
  const userId = requireOwnedAdmin(req);

  const target = await users.findById(userId);
  if (!target || target.role !== 'admin' || target.restaurant_id !== restaurantId) {
    throw notFound('Admin account not found for this restaurant');
  }
  await users.deleteAdmin(userId);
  res.json({ ok: true });
}

/* --------------------------- platform staff -------------------------- */

async function listStaff(req, res) {
  res.json({ staff: await users.listStaffs() });
}

async function createStaff(req, res) {
  const username = v.validateUsername(req.body.username);
  const email = v.validateEmailOptional(req.body.email);
  const password = v.validatePassword(req.body.password);
  const staff = await users.createStaff({ username, email, password });
  res.status(201).json({ staff });
}

async function resetStaffPassword(req, res) {
  const userId = assertUuid(req.params.id, 'id');
  const target = await users.findById(userId);
  if (!target || target.role !== 'staff') throw notFound('Staff account not found');
  const generated = !req.body.password;
  const password = generated ? crypto.randomBytes(12).toString('base64url') : v.validatePassword(req.body.password);
  await users.setPassword(userId, password);
  res.json({ ok: true, ...(generated ? { password } : {}) });
}

async function toggleStaffActive(req, res) {
  const userId = assertUuid(req.params.id, 'id');
  const target = await users.findById(userId);
  if (!target || target.role !== 'staff') throw notFound('Staff account not found');
  const result = await users.setStaffActive(userId, Boolean(req.body.isActive));
  if (!result) throw badRequest('Nothing changed');
  res.json({ ok: true, isActive: Boolean(req.body.isActive) });
}

async function deleteStaff(req, res) {
  const userId = assertUuid(req.params.id, 'id');
  const target = await users.findById(userId);
  if (!target || target.role !== 'staff') throw notFound('Staff account not found');
  await users.deleteStaff(userId);
  res.json({ ok: true });
}

/* --------------------------- orders view -------------------------- */

async function listOrdersForRestaurant(req, res) {
  const id = assertUuid(req.params.id, 'id');
  await restaurants.assertExists(id);
  const page = v.validatePagination(req.query);
  const status = ordersService.STATUSES.includes(req.query.status) ? req.query.status : null;
  const { total, orders: rows } = await ordersService.listForRestaurant(id, {
    status,
    limit: page.limit,
    offset: page.offset,
  });
  res.json({ total, page: page.page, limit: page.limit, orders: rows });
}

/* ------------------------ delivery groups --------------------------- */

async function listDeliveryGroups(req, res) {
  const rows = await delivery.listAll();
  const groups = [];
  for (const g of rows) {
    const accounts = await users.listDeliveriesForGroup(g.id);
    groups.push({ ...g, isActive: g.is_active, accounts: accounts.map((a) => ({
      id: a.id, username: a.username, email: a.email,
      isActive: a.is_active, createdAt: a.created_at,
    })) });
  }
  res.json({ groups });
}

/** Create a delivery company login account. Returns a generated password when none given. */
async function createDeliveryAccount(req, res) {
  const groupId = assertUuid(req.params.id, 'id');
  const group = await delivery.getById(groupId);
  if (!group) throw notFound('Delivery company not found');

  if (await users.findByGroup(groupId)) {
    throw conflict('ACCOUNT_EXISTS', 'This delivery company already has a login account');
  }

  const username = req.body.username
    ? v.validateUsername(req.body.username)
    : 'dlv_' + (group.name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20) || 'company');
  const email = v.validateEmailOptional(req.body.email);
  const generated = !req.body.password;
  const password = generated
    ? crypto.randomBytes(12).toString('base64url')
    : v.validatePassword(req.body.password);

  const account = await users.createDelivery({ deliveryGroupId: groupId, username, email, password });
  res.status(201).json({ account: { id: account.id, username: account.username }, ...(generated ? { password } : {}) });
}

async function resetDeliveryAccountPassword(req, res) {
  const groupId = assertUuid(req.params.id, 'id');
  const account = await users.findByGroup(groupId);
  if (!account) throw notFound('No login account for this delivery company');
  const generated = !req.body.password;
  const password = generated
    ? crypto.randomBytes(12).toString('base64url')
    : v.validatePassword(req.body.password);
  await users.setPassword(account.id, password);
  res.json({ ok: true, ...(generated ? { password } : {}) });
}

async function toggleDeliveryAccountActive(req, res) {
  const groupId = assertUuid(req.params.id, 'id');
  const account = await users.findByGroup(groupId);
  if (!account) throw notFound('No login account for this delivery company');
  const result = await users.setDeliveryActive(account.id, Boolean(req.body.isActive));
  if (!result) throw badRequest('Nothing changed');
  res.json({ ok: true, isActive: Boolean(req.body.isActive) });
}

async function deleteDeliveryAccount(req, res) {
  const groupId = assertUuid(req.params.id, 'id');
  const account = await users.findByGroup(groupId);
  if (!account) throw notFound('No login account for this delivery company');
  await users.deleteDelivery(account.id);
  res.json({ ok: true });
}

async function createDeliveryGroup(req, res) {
  const data = v.validateDeliveryGroupCreate(req.body);
  try {
    res.status(201).json({ group: await delivery.create(data) });
  } catch (err) {
    if (err.code === '23505') throw conflict('GROUP_EXISTS', 'A company with this name already exists');
    throw err;
  }
}

async function updateDeliveryGroup(req, res) {
  const patch = v.validateDeliveryGroupUpdate(req.body);
  try {
    res.json({ group: await delivery.rename(req.params.id, patch) });
  } catch (err) {
    if (err.code === '23505') throw conflict('GROUP_EXISTS', 'A company with this name already exists');
    throw err;
  }
}

async function deleteDeliveryGroup(req, res) {
  await delivery.remove(req.params.id);
  res.json({ ok: true });
}

async function getPlatformPricing(req, res) {
  const platform = require('../services/platform.service');
  const p = await platform.getPricing();
  res.json({ pricing: p });
}
async function updatePlatformPricing(req, res) {
  const platform = require('../services/platform.service');
  const v = require('../validators');
  const patch = v.validatePlatformPricing(req.body);
  const p = await platform.updatePricing(patch);
  res.json({ pricing: p });
}

async function listRestaurantRequests(req, res) {
  const svc = require('../services/restaurantRequests.service');
  const page = v.validatePagination(req.query);
  const status = req.query.status && ['pending','contacted','approved','rejected'].includes(String(req.query.status)) ? String(req.query.status) : null;
  const data = await svc.list({ status, limit: page.limit, offset: page.offset });
  res.json({ total: data.total, page: page.page, limit: page.limit, requests: data.requests });
}
async function updateRestaurantRequestStatus(req, res) {
  const svc = require('../services/restaurantRequests.service');
  const id = assertUuid(req.params.id, 'id');
  const status = String(req.body.status||'').trim().toLowerCase();
  const row = await svc.setStatus(id, status);
  res.json({ request: row });
}
async function deleteRestaurantRequest(req, res) {
  const svc = require('../services/restaurantRequests.service');
  const id = assertUuid(req.params.id, 'id');
  await svc.remove(id);
  res.json({ ok: true });
}

module.exports = {
  overview: asyncHandler(overview),
  restaurantsReportCsv: asyncHandler(restaurantsReportCsv),
  listRestaurants: asyncHandler(listRestaurants),
  createRestaurant: asyncHandler(createRestaurant),
  getRestaurant: asyncHandler(getRestaurant),
  updateRestaurant: asyncHandler(updateRestaurant),
  deleteRestaurant: asyncHandler(deleteRestaurant),
  createAdminUser: asyncHandler(createAdminUser),
  resetAdminPassword: asyncHandler(resetAdminPassword),
  toggleAdminActive: asyncHandler(toggleAdminActive),
  deleteAdminUser: asyncHandler(deleteAdminUser),
  listStaff: asyncHandler(listStaff),
  createStaff: asyncHandler(createStaff),
  resetStaffPassword: asyncHandler(resetStaffPassword),
  toggleStaffActive: asyncHandler(toggleStaffActive),
  deleteStaff: asyncHandler(deleteStaff),
  listOrdersForRestaurant: asyncHandler(listOrdersForRestaurant),
  listDeliveryGroups: asyncHandler(listDeliveryGroups),
  createDeliveryGroup: asyncHandler(createDeliveryGroup),
  updateDeliveryGroup: asyncHandler(updateDeliveryGroup),
  deleteDeliveryGroup: asyncHandler(deleteDeliveryGroup),
  createDeliveryAccount: asyncHandler(createDeliveryAccount),
  resetDeliveryAccountPassword: asyncHandler(resetDeliveryAccountPassword),
  toggleDeliveryAccountActive: asyncHandler(toggleDeliveryAccountActive),
  deleteDeliveryAccount: asyncHandler(deleteDeliveryAccount),
  getPlatformPricing: asyncHandler(getPlatformPricing),
  updatePlatformPricing: asyncHandler(updatePlatformPricing),
  listRestaurantRequests: asyncHandler(listRestaurantRequests),
  updateRestaurantRequestStatus: asyncHandler(updateRestaurantRequestStatus),
  deleteRestaurantRequest: asyncHandler(deleteRestaurantRequest),
};
