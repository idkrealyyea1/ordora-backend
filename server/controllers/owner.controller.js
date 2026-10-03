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
const { persistSavedImage } = require('../middleware/upload');
const { sendCsv } = require('../utils/csv');
const { asyncHandler } = require('../utils/errors');
const v = require('../validators');

async function overview(req, res) {
  res.json(await restaurants.platformOverview());
}

/** GET /api/owner/reports/restaurants.csv — per-restaurant summary for owners. */
async function restaurantsReportCsv(req, res) {
  const rows = await restaurants.reportSummaryForOwner();
  const header = ['Name', 'Slug', 'Active', 'Currency', 'Menu items', 'Orders (30d)', 'Revenue (30d cents)', 'Orders (all time)', 'Created'];
  const body = rows.map((r) => [
    r.name, r.slug, r.isActive ? 'yes' : 'no', r.currency || 'USD', r.itemCount,
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
      businessType: r.business_type || 'restaurant',
      status: r.status,
      isActive: r.is_active,
      maxMenuItems: r.max_menu_items,
      itemCount: r.item_count,
      planKey: r.plan_key || null,
      subStatus: r.sub_status || null,
      periodEndsAt: r.sub_ends_at || r.subscription_ends_at || null,
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
      businessType: restaurant.business_type || 'restaurant',
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
      businessType: restaurant.business_type || 'restaurant',
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

/** Owner update: identity/limits/activation here; colors/currency proxied to settings. */
async function updateRestaurant(req, res) {
  const id = assertUuid(req.params.id, 'id');
  await restaurants.assertExists(id);
  const patch = v.validateRestaurantUpdate(req.body);

  // Currency mutates only via business-admin settings or the creation
  // default; the platform-owner update path intentionally ignores it.
  const settingsKeys = ['primaryColor', 'secondaryColor'];
  const restPatch = {};
  const settingsPatch = {};
  for (const [k, val] of Object.entries(patch)) {
    if (settingsKeys.includes(k)) settingsPatch[k] = val;
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
      businessType: updated.business_type || 'restaurant',
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

/* ------------------- subscription management (Task 14) -------------- */
/* Platform-owner only (routes enforce). Thin handlers over the lifecycle
   service; the actor is always the session user, never request data. */

async function listPlans(req, res) {
  const plans = require('../services/plans.service');
  res.json({ plans: await plans.listPlans() });
}

async function createPlan(req, res) {
  const plans = require('../services/plans.service');
  const data = v.validatePlanCreate(req.body);
  const plan = await plans.createPlan(data);
  res.status(201).json(plan);
}

async function getPlan(req, res) {
  const plans = require('../services/plans.service');
  const plan = await plans.getPlan(String(req.params.key || '').trim().toLowerCase());
  if (!plan) throw notFound('Unknown plan');
  res.json(plan);
}

async function updatePlan(req, res) {
  const plans = require('../services/plans.service');
  const key = String(req.params.key || '').trim().toLowerCase();
  const patch = v.validatePlanUpdate(req.body);
  const plan = await plans.updatePlan(key, patch);
  if (!plan) throw notFound('Unknown plan');
  res.json(plan);
}

function subTarget(req) {
  const id = assertUuid(req.params.id, 'id');
  return { id, actorId: req.user ? req.user.id : null };
}

function toPublicSub(row) {
  if (!row) return null;
  return {
    state: row.status,
    planId: row.plan_id,
    trialStartedAt: row.trial_started_at,
    periodStart: row.current_period_start,
    periodEndsAt: row.current_period_end,
    current_period_end: row.current_period_end,
    graceUntil: row.grace_until,
    cancelledAt: row.cancelled_at,
    cancelEffectiveAt: row.cancel_effective_at,
    suspendedAt: row.suspended_at,
    suspendReason: row.suspend_reason,
  };
}

async function getSubscription(req, res) {
  const subs = require('../services/subscriptions.service');
  const { id } = subTarget(req);
  const detailed = await subs.statusFor(id);
  res.json(detailed);
}

async function activateSubscription(req, res) {
  const subs = require('../services/subscriptions.service');
  const { id, actorId } = subTarget(req);
  const data = v.validateSubscriptionActivate(req.body);
  res.json(toPublicSub(await subs.activate({ restaurantId: id, ...data, actorId })));
}

async function extendSubscription(req, res) {
  const subs = require('../services/subscriptions.service');
  const { id, actorId } = subTarget(req);
  const data = v.validateSubscriptionExtend(req.body);
  res.json(toPublicSub(await subs.extend({ restaurantId: id, ...data, actorId })));
}

async function cancelSubscription(req, res) {
  const subs = require('../services/subscriptions.service');
  const { id, actorId } = subTarget(req);
  const data = v.validateSubscriptionCancel(req.body);
  res.json(toPublicSub(await subs.cancel({ restaurantId: id, ...data, actorId })));
}

async function suspendSubscription(req, res) {
  const subs = require('../services/subscriptions.service');
  const { id, actorId } = subTarget(req);
  const data = v.validateSubscriptionSuspend(req.body);
  res.json(toPublicSub(await subs.suspend({ restaurantId: id, ...data, actorId })));
}

async function reactivateSubscription(req, res) {
  const subs = require('../services/subscriptions.service');
  const { id, actorId } = subTarget(req);
  const data = v.validateSubscriptionReason(req.body);
  res.json(toPublicSub(await subs.reactivate({ restaurantId: id, ...data, actorId })));
}

async function listSubscriptionEvents(req, res) {
  const { query } = require('../db/pool');
  const { id } = subTarget(req);
  const { rows } = await query(
    `SELECT e.*, u.username AS actor_username FROM subscription_events e
     LEFT JOIN users u ON u.id = e.actor_user_id
     WHERE e.restaurant_id = $1 ORDER BY e.created_at DESC`,
    [id]
  );
  res.json({
    events: rows.map((e) => ({
      id: e.id,
      actor: e.actor_username || (e.actor_user_id ? String(e.actor_user_id) : 'system'),
      action: e.action,
      oldState: e.old_status,
      newState: e.new_status,
      oldPlan: e.old_plan_key,
      newPlan: e.new_plan_key,
      oldEndsAt: e.old_ends_at,
      newEndsAt: e.new_ends_at,
      reason: e.reason,
      at: e.created_at,
    })),
  });
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
  listPlans: asyncHandler(listPlans),
  createPlan: asyncHandler(createPlan),
  getPlan: asyncHandler(getPlan),
  updatePlan: asyncHandler(updatePlan),
  getSubscription: asyncHandler(getSubscription),
  activateSubscription: asyncHandler(activateSubscription),
  extendSubscription: asyncHandler(extendSubscription),
  cancelSubscription: asyncHandler(cancelSubscription),
  suspendSubscription: asyncHandler(suspendSubscription),
  reactivateSubscription: asyncHandler(reactivateSubscription),
  listSubscriptionEvents: asyncHandler(listSubscriptionEvents),
  listHeroImages: asyncHandler(listHeroImages),
  addHeroImage: asyncHandler(addHeroImage),
  updateHeroImage: asyncHandler(updateHeroImage),
  removeHeroImage: asyncHandler(removeHeroImage),
  reorderHeroImages: asyncHandler(reorderHeroImages),
  listTranslations: asyncHandler(listTranslations),
  updateTranslation: asyncHandler(updateTranslation),
};

async function listHeroImages(req, res) {
  const rows = await restaurants.getHeroImages(req.params.id);
  res.json({ heroImages: rows });
}

async function addHeroImage(req, res) {
  // The route pins the upload namespace to "hero", so a validated upload gives us a
  // trusted path. A body-supplied path is accepted only for callers that already
  // hold one, and only after the same validator every other write path uses — an
  // arbitrary client string must never reach the database.
  let imagePath = req.savedImagePublicPath;
  if (imagePath) {
    await persistSavedImage(req);
  } else if (req.body && req.body.imagePath) {
    imagePath = v.validateHeroImagePath(req.body.imagePath);
  } else {
    throw badRequest('No image uploaded');
  }
  const row = await restaurants.addHeroImage(req.params.id, imagePath);
  res.status(201).json({ heroImage: row });
}

async function updateHeroImage(req, res) {
  const patch = {};
  if (req.body.position !== undefined) patch.position = req.body.position;
  if (req.body.isPrimary !== undefined) patch.isPrimary = req.body.isPrimary;
  if (req.body.isActive !== undefined) patch.isActive = req.body.isActive;
  const row = await restaurants.updateHeroImage(req.params.id, req.params.imageId, patch);
  if (!row) throw notFound('Hero image not found');
  res.json({ heroImage: row });
}

async function removeHeroImage(req, res) {
  const ok = await restaurants.removeHeroImage(req.params.id, req.params.imageId);
  if (!ok) throw notFound('Hero image not found');
  res.status(204).end();
}

/** Reorder as a permutation. The target business comes from the route param, which
 *  requireOwner authorises; the service additionally scopes every read/write to it. */
async function reorderHeroImages(req, res) {
  const order = req.body && req.body.order;
  if (!Array.isArray(order)) throw badRequest('order must be an array of image ids');
  const heroImages = await restaurants.reorderHeroImages(req.params.id, order);
  res.json({ heroImages });
}

async function listTranslations(req, res) {
  const svc = require('../services/translations.service');
  const rows = await svc.getAllTranslations();
  res.json({ translations: rows });
}

async function updateTranslation(req, res) {
  const svc = require('../services/translations.service');
  const { locale, value } = req.body;
  if (!locale || !value) throw badRequest('locale and value are required');
  const row = await svc.updateTranslation(req.params.key, locale, value);
  res.json(row);
}
