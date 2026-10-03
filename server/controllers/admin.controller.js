'use strict';

/**
 * Restaurant-admin controller.
 * SECURITY: every handler derives restaurantId from req.user (server-side),
 * never from the request. Owners bypass tenant scoping only where noted.
 */

const QRCode = require('qrcode');
const config = require('../../config');
const restaurants = require('../services/restaurants.service');
const subscriptions = require('../services/subscriptions.service');
const categoriesService = require('../services/categories.service');
const menu = require('../services/menu.service');
const options = require('../services/options.service');
const orders = require('../services/orders.service');
const bookings = require('../services/bookings.service');
const settingsService = require('../services/settings.service');
const sse = require('../middleware/sse');
const delivery = require('../services/delivery.service');
const { handleImageUpload, persistSavedImage, deleteUpload } = require('../middleware/upload');
const { sendCsv } = require('../utils/csv');
const { assertUuid } = require('../utils/checks');
const { forbidden, notFound, badRequest } = require('../utils/errors');
const { asyncHandler } = require('../utils/errors');
const v = require('../validators');

function tenantId(req) {
  // Staff hold no tenant scope: their only platform power (restaurant creation)
  // lives on owner routes, never here.
  if (req.user.role === 'staff') throw forbidden('FORBIDDEN', 'Staff cannot access restaurant data');
  if (req.user.role === 'owner') {
    // Platform owners may inspect a specific restaurant via ?restaurantId=
    const id = req.query.restaurantId || req.user.restaurant_id;
    if (!id) throw forbidden('RESTAURANT_REQUIRED', 'Specify ?restaurantId=');
    return id;
  }
  return req.user.restaurant_id;
}

/* ------------------------- overview ---------------------------- */

async function myRestaurant(req, res) {
  const id = tenantId(req);
  const restaurant = await restaurants.getById(id);
  if (!restaurant) throw notFound('Restaurant not found');
  const settings = await settingsService.getOwned(id);
  res.json({
    restaurant: {
      id: restaurant.id,
      slug: restaurant.slug,
      name: restaurant.name,
      businessType: restaurant.business_type || 'restaurant',
      status: restaurant.status,
      maxMenuItems: restaurant.max_menu_items,
      itemCount: await restaurants.countItems(id),
    },
    settings,
    openNow: await settingsService.computeOpenNow(id),
    subscription: await subscriptions.statusFor(id).catch(() => null),
  });
}

const RESTAURANT_STATUSES = ['open', 'closed', 'temporarily_closed'];

/** Restaurant admins set their own restaurant's open/closed status here. */
async function setStatus(req, res) {
  const id = tenantId(req);
  const { status } = req.body || {};
  if (!RESTAURANT_STATUSES.includes(status)) {
    throw badRequest('status must be one of: ' + RESTAURANT_STATUSES.join(', '));
  }
  const updated = await restaurants.updateRestaurant(id, { status });
  if (!updated) throw notFound('Restaurant not found');
  res.json({ status: updated.status });
}

async function dashboard(req, res) {
  const id = tenantId(req);
  const restaurant = await restaurants.getById(id);
  res.json({
    counts: await orders.dashboardCounts(id, await tzOf(id)),
    itemCount: await restaurants.countItems(id),
    maxMenuItems: restaurant ? restaurant.max_menu_items : null,
    openNow: await settingsService.computeOpenNow(id),
    subscription: await subscriptions.statusFor(id).catch(() => null),
  });
}

async function tzOf(restaurantId) {
  const settings = await restaurants.getSettings(restaurantId);
  return settings.timezone || 'UTC';
}

/* -------------------------- orders ------------------------------ */

async function listOrders(req, res) {
  const id = tenantId(req);
  const page = v.validatePagination(req.query);
  const { total, orders: rows } = await orders.listForRestaurant(id, {
    status: req.query.status || null,
    limit: page.limit,
    offset: page.offset,
  });
  res.json({ total, page: page.page, limit: page.limit, orders: rows });
}

async function getOrder(req, res) {
  const row = await orders.getForRestaurant(req.params.id, tenantId(req));
  res.json({ order: row });
}

async function changeOrderStatus(req, res) {
  const { status } = v.validateStatusChange(req.body);
  const row = await orders.changeStatus(req.params.id, tenantId(req), status);
  require('../services/notifications.service').emit({
    restaurantId: tenantId(req), type: 'order.status_changed',
    orderId: row.id, orderCode: row.code, status: row.status,
  });
  res.json({ order: row });
}

async function deleteOrder(req, res) {
  const row = await orders.archiveOrder(req.params.id, tenantId(req));
  res.json({ ok: true, order: row });
}

/* ------------------------- bookings ---------------------------- */

async function listBookings(req, res) {
  const id = tenantId(req);
  const page = v.validatePagination(req.query);
  const { total, bookings: rows } = await bookings.listForRestaurant(id, {
    status: req.query.status || null,
    limit: page.limit,
    offset: page.offset,
  });
  res.json({ total, page: page.page, limit: page.limit, bookings: rows });
}

async function getBooking(req, res) {
  const row = await bookings.getForRestaurant(req.params.id, tenantId(req));
  res.json({ booking: row });
}

async function changeBookingStatus(req, res) {
  const { status } = v.validateBookingStatusChange(req.body);
  const row = await bookings.changeStatus(req.params.id, tenantId(req), status);
  sse.broadcast(tenantId(req), 'booking:status', { bookingId: row.id, code: row.code, status: row.status });
  sse.broadcast(tenantId(req), 'booking:new', { bookingId: row.id, code: row.code });
  res.json({ booking: row });
}

async function deleteBooking(req, res) {
  await bookings.archive(req.params.id, tenantId(req));
  res.json({ ok: true });
}

/* ------------------------ categories ---------------------------- */

async function listCategories(req, res) {
  res.json({ categories: await categoriesService.listOwned(tenantId(req)) });
}

async function createCategory(req, res) {
  const data = v.validateCategoryCreate(req.body);
  res.status(201).json({ category: await categoriesService.createOwned(tenantId(req), data) });
}

async function updateCategory(req, res) {
  const patch = v.validateCategoryUpdate(req.body);
  res.json({ category: await categoriesService.updateOwned(tenantId(req), req.params.id, patch) });
}

async function deleteCategory(req, res) {
  await categoriesService.deleteOwned(tenantId(req), req.params.id);
  res.json({ ok: true });
}

/* -------------------------- items -------------------------------- */

async function listItems(req, res) {
  res.json({ items: await menu.listOwned(tenantId(req)) });
}

async function createItem(req, res) {
  const data = v.validateItemCreate(req.body);
  res.status(201).json({ item: await menu.createOwned(tenantId(req), data) });
}

async function updateItem(req, res) {
  const patch = v.validateItemUpdate(req.body);
  res.json({ item: await menu.updateOwned(tenantId(req), req.params.id, patch) });
}

async function deleteItem(req, res) {
  await menu.deleteOwned(tenantId(req), req.params.id);
  res.json({ ok: true });
}

/* ---------------------- product options -------------------------- */

async function listOptionGroups(req, res) {
  const { menuItemId } = req.query || {};
  if (!menuItemId) throw badRequest('menuItemId query is required', [{ field: 'menuItemId' }]);
  res.json({ groups: await options.listGroupsOwned(tenantId(req), assertUuid(menuItemId, 'menuItemId')) });
}

async function createOptionGroup(req, res) {
  const data = v.validateOptionGroupCreate(req.body);
  res.status(201).json({ group: await options.createGroupOwned(tenantId(req), data) });
}

async function updateOptionGroup(req, res) {
  const patch = v.validateOptionGroupUpdate(req.body);
  res.json({ group: await options.updateGroupOwned(tenantId(req), req.params.id, patch) });
}

async function deleteOptionGroup(req, res) {
  await options.deleteGroupOwned(tenantId(req), req.params.id);
  res.json({ ok: true });
}

async function listOptionChoices(req, res) {
  res.json({ choices: await options.listChoicesOwned(tenantId(req), req.params.id) });
}

async function createOptionChoice(req, res) {
  const data = v.validateOptionChoiceCreate(req.body);
  res.status(201).json({ choice: await options.createChoiceOwned(tenantId(req), req.params.id, data) });
}

async function updateOptionChoice(req, res) {
  const patch = v.validateOptionChoiceUpdate(req.body);
  res.json({
    choice: await options.updateChoiceOwned(tenantId(req), req.params.groupId, req.params.choiceId, patch),
  });
}

async function deleteOptionChoice(req, res) {
  await options.deleteChoiceOwned(tenantId(req), req.params.groupId, req.params.choiceId);
  res.json({ ok: true });
}

/* ------------------------- settings ------------------------------ */

async function getSettings(req, res) {
  const id = tenantId(req);
  res.json({ settings: await settingsService.getOwned(id), openNow: await settingsService.computeOpenNow(id) });
}

async function updateSettings(req, res) {
  const patch = v.validateSettingsUpdate(req.body);
  const updated = await settingsService.updateOwned(tenantId(req), patch);
  res.json({ settings: updated });
}

async function getHours(req, res) {
  res.json({ hours: await settingsService.getHours(tenantId(req)) });
}

async function updateHours(req, res) {
  const rows = v.validateHours(req.body.hours);
  await settingsService.setHours(tenantId(req), rows);
  res.json({ hours: await settingsService.getHours(tenantId(req)) });
}

/* -------------------------- uploads ------------------------------ */

/**
 * POST /api/admin/images?type=logos|covers|items[&itemId=...]
 * The reference is attached to settings/item immediately (no orphan files).
 */
const uploadImage = [
  handleImageUpload,
  asyncHandler(async (req, res) => {
    const id = tenantId(req);
    await persistSavedImage(req);

    if (req.query.type === 'hero') {
      const row = await restaurants.addHeroImage(id, req.savedImagePublicPath);
      return res.status(201).json({ path: req.savedImagePublicPath, heroImage: row });
    }

    try {
      if (req.query.type === 'logos') {
        const old = (await settingsService.getOwned(id)).logoPath;
        await settingsService.updateOwned(id, { logoPath: req.savedImagePublicPath });
        if (old) await deleteUpload(old);
      } else if (req.query.type === 'covers') {
        const old = (await settingsService.getOwned(id)).coverPath;
        await settingsService.updateOwned(id, { coverPath: req.savedImagePublicPath });
        if (old) await deleteUpload(old);
        // Also add to hero images carousel (FR-052)
      const existingHeroes = await restaurants.getHeroImages(id);
      const isPrimary = existingHeroes.length === 0;
      // Position is resolved inside addHeroImage over ALL rows, not just the active
      // ones returned here — a soft-deleted row keeps its position, so deriving it
      // from the active list would hand back an occupied value and 23505 on insert.
      await restaurants.addHeroImage(id, req.savedImagePublicPath, { isPrimary });
      } else {
        // items: attach to an owned menu item
        const itemId = v.assertUuid(req.query.itemId, 'itemId');
        const old = (await menu.getOwned(id, itemId)).image_path;
        await menu.updateOwned(id, itemId, { imagePath: req.savedImagePublicPath });
        if (old) await deleteUpload(old);
      }
    } catch (err) {
      await deleteUpload(req.savedImagePublicPath); // don't leave orphans on failure
      throw err;
    }

    res.status(201).json({ path: req.savedImagePublicPath });
  }),
];

/* ----------------------------- QR -------------------------------- */

async function qrCode(req, res) {
  const id = tenantId(req);
  const restaurant = await restaurants.getById(id);
  if (!restaurant) throw notFound('Restaurant not found');

  let base = config.appUrl;
  if (!base) {
    const proto = req.protocol;
    const host = req.headers.host;
    base = `${proto}://${host}`;
  }
  const url = `${base}/restaurant/${restaurant.slug}`;
  const svg = await QRCode.toString(url, { type: 'svg', margin: 1, width: 320 });

  res.json({ url, svg });
}

/* --------------------------- analytics --------------------------- */

async function analytics(req, res) {
  const id = tenantId(req);
  const period = v.validateAnalyticsPeriod(req.query);
  const tz = await tzOf(id);
  const topDays = period.mode === 'days' ? Math.max(period.days, 30) : period;
  const [series, top, byDow, byHourRes, splits] = await Promise.all([
    orders.analyticsSeries(id, tz, period.mode === 'days' ? period.days : period),
    orders.topItems(id, topDays),
    orders.byDayOfWeek(id, tz, period.mode === 'days' ? period.days : period),
    orders.byHour(id, tz, period.mode === 'days' ? period.days : period),
    orders.orderSplits(id, ...periodRange(period, tz)),
  ]);
  const averages = series.totals.orders > 0
    ? { averageOrderValueCents: Math.round(series.totals.revenueCents / series.totals.orders) }
    : { averageOrderValueCents: 0 };
  const averageOrderValueByCurrency = {};
  for (const [cur, fig] of Object.entries(series.revenueByCurrency || {})) {
    averageOrderValueByCurrency[cur] = fig.orders > 0 ? Math.round(fig.revenueCents / fig.orders) : 0;
  }
  res.json({
    ...series, ...averages, today: await orders.dashboardCounts(id, tz),
    topItems: top, byDayOfWeek: byDow, byHour: byHourRes,
    period: { ...period, timezone: tz },
    averageOrderValueByCurrency,
    pickupVsDelivery: splits.pickupVsDelivery,
    statusSplit: splits.statusSplit,
    preorderSplit: splits.preorderSplit,
  });
}

/** [from, to] date labels for a validated period (matches service bounds). */
function periodRange(period, tz) {
  if (period.mode === 'range') return [period.from, period.to];
  let today;
  try {
    today = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
  } catch {
    today = new Date().toISOString().slice(0, 10);
  }
  const shift = (n) => new Date(new Date(today + 'T00:00:00Z').getTime() + n * 86400000).toISOString().slice(0, 10);
  if (period.mode === 'preset') {
    if (period.preset === 'today') return [today, today];
    if (period.preset === '30d') return [shift(-29), today];
    return [shift(-6), today];
  }
  return [shift(-(period.days - 1)), today];
}

/* ----------------------------- reports ---------------------------- */

/** GET /api/admin/reports/orders.csv — downloadable order log (revenue by default). */
async function ordersReportCsv(req, res) {
  const id = tenantId(req);
  const revenueOnly = req.query.scope !== 'all';
  const rows = await orders.exportRows(id, { revenueOnly, status: req.query.status || null });
  const header = [
    'Code', 'Status', 'Type', 'Customer', 'WhatsApp', 'Phone', 'Address', 'Notes',
    'Subtotal (cents)', 'Delivery fee (cents)', 'Total (cents)', 'Currency', 'Options', 'Created', 'Updated',
  ];
  const body = rows.map((r) => [
    r.code, r.status, r.order_type, r.customer_name, r.customer_whatsapp, r.customer_phone,
    r.customer_address, r.notes, r.subtotal_cents, r.delivery_fee_cents, r.total_cents,
    r.currency || 'USD', r.options_summary || '', r.created_at, r.updated_at,
  ]);
  sendCsv(res, `orders-${id.slice(0, 8)}.csv`, [header, ...body]);
}

/* ----------------------------- SSE ------------------------------- */

function events(req, res) {
  const id = tenantId(req);
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 5000\n\n');
  sse.addClient(id, res);
}

/* --------------------- push subscriptions ------------------------ */

const notify = require('../services/notifications.service');

async function pushPublicKey(req, res) {
  res.json(notify.vapidPublic());
}

async function listPushSubscriptions(req, res) {
  res.json({ subscriptions: await notify.listSubscriptions(tenantId(req)) });
}

async function createPushSubscription(req, res) {
  const data = v.validatePushSubscription(req.body);
  res.status(201).json({ subscription: await notify.saveSubscription(tenantId(req), data) });
}

async function deletePushSubscription(req, res) {
  const ok = await notify.removeSubscription(tenantId(req), assertUuid(req.params.id, 'id'));
  if (!ok) throw notFound('Subscription not found');
  res.json({ ok: true });
}

/* --------------------- delivery companies -------------------------- */

async function listMyDeliveryGroups(req, res) {
  res.json({ groups: await delivery.listForRestaurant(tenantId(req)) });
}

async function saveMyDeliveryGroups(req, res) {
  const groupIds = v.validateDeliverySelection(req.body);
  const groups = await delivery.setForRestaurant(tenantId(req), groupIds);
  res.json({ groups });
}

async function listMyHeroImages(req, res) {
  res.json({ heroImages: await restaurants.getHeroImages(tenantId(req)) });
}

async function addMyHeroImage(req, res) {
  const imagePath = v.validateHeroImagePath(req.body && req.body.imagePath);
  const row = await restaurants.addHeroImage(tenantId(req), imagePath);
  res.status(201).json({ heroImage: row });
}

async function updateMyHeroImage(req, res) {
  const patch = {};
  if (req.body && req.body.position !== undefined) patch.position = req.body.position;
  if (req.body && req.body.isPrimary !== undefined) patch.isPrimary = req.body.isPrimary;
  if (req.body && req.body.isActive !== undefined) patch.isActive = req.body.isActive;
  const row = await restaurants.updateHeroImage(tenantId(req), req.params.imageId, patch);
  if (!row) throw notFound('Hero image not found');
  res.json({ heroImage: row });
}

async function removeMyHeroImage(req, res) {
  const ok = await restaurants.removeHeroImage(tenantId(req), req.params.imageId);
  if (!ok) throw notFound('Hero image not found');
  res.status(204).end();
}

/* ---- Product photo set ----------------------------------------------
   Tenant comes only from the session (tenantId); the item id from the route.
   An unowned item yields 404 so existence is not disclosed across tenants. */

async function listItemImages(req, res) {
  const id = tenantId(req);
  const item = await menu.getOwned(id, v.assertUuid(req.params.id, 'id'));
  res.json({ itemImages: await restaurants.listItemImages(id, item.id) });
}

async function addItemImage(req, res) {
  const id = tenantId(req);
  const item = await menu.getOwned(id, v.assertUuid(req.params.id, 'id'));
  const imagePath = v.validateItemImagePath(req.body && req.body.imagePath);
  const row = await restaurants.addItemImage(id, item.id, imagePath);
  res.status(201).json({ itemImage: row });
}

async function reorderItemImages(req, res) {
  const id = tenantId(req);
  const item = await menu.getOwned(id, v.assertUuid(req.params.id, 'id'));
  const order = req.body && req.body.order;
  if (!Array.isArray(order)) throw badRequest('order must be an array of image ids');
  const itemImages = await restaurants.reorderItemImages(id, item.id, order);
  res.json({ itemImages });
}

async function removeItemImage(req, res) {
  const id = tenantId(req);
  const item = await menu.getOwned(id, v.assertUuid(req.params.id, 'id'));
  const ok = await restaurants.removeItemImage(id, item.id, v.assertUuid(req.params.imageId, 'imageId'));
  if (!ok) throw notFound('Image not found');
  res.status(204).end();
}

/** Reorder as a permutation. Tenant comes only from the session (tenantId). */
async function reorderMyHeroImages(req, res) {
  const order = req.body && req.body.order;
  if (!Array.isArray(order)) throw badRequest('order must be an array of image ids');
  const heroImages = await restaurants.reorderHeroImages(tenantId(req), order);
  res.json({ heroImages });
}

module.exports = {
  tenantId,
  myRestaurant: asyncHandler(myRestaurant),
  setStatus: asyncHandler(setStatus),
  dashboard: asyncHandler(dashboard),
  listOrders: asyncHandler(listOrders),
  getOrder: asyncHandler(getOrder),
  changeOrderStatus: asyncHandler(changeOrderStatus),
  deleteOrder: asyncHandler(deleteOrder),
  listBookings: asyncHandler(listBookings),
  getBooking: asyncHandler(getBooking),
  changeBookingStatus: asyncHandler(changeBookingStatus),
  deleteBooking: asyncHandler(deleteBooking),
  listCategories: asyncHandler(listCategories),
  createCategory: asyncHandler(createCategory),
  updateCategory: asyncHandler(updateCategory),
  deleteCategory: asyncHandler(deleteCategory),
  listMyDeliveryGroups: asyncHandler(listMyDeliveryGroups),
  saveMyDeliveryGroups: asyncHandler(saveMyDeliveryGroups),
  listMyHeroImages: asyncHandler(listMyHeroImages),
  addMyHeroImage: asyncHandler(addMyHeroImage),
  updateMyHeroImage: asyncHandler(updateMyHeroImage),
  reorderMyHeroImages: asyncHandler(reorderMyHeroImages),
  listItemImages: asyncHandler(listItemImages),
  addItemImage: asyncHandler(addItemImage),
  reorderItemImages: asyncHandler(reorderItemImages),
  removeItemImage: asyncHandler(removeItemImage),
  removeMyHeroImage: asyncHandler(removeMyHeroImage),
  listItems: asyncHandler(listItems),
  createItem: asyncHandler(createItem),
  updateItem: asyncHandler(updateItem),
  deleteItem: asyncHandler(deleteItem),
  listOptionGroups: asyncHandler(listOptionGroups),
  createOptionGroup: asyncHandler(createOptionGroup),
  updateOptionGroup: asyncHandler(updateOptionGroup),
  deleteOptionGroup: asyncHandler(deleteOptionGroup),
  listOptionChoices: asyncHandler(listOptionChoices),
  createOptionChoice: asyncHandler(createOptionChoice),
  updateOptionChoice: asyncHandler(updateOptionChoice),
  deleteOptionChoice: asyncHandler(deleteOptionChoice),
  getSettings: asyncHandler(getSettings),
  updateSettings: asyncHandler(updateSettings),
  getHours: asyncHandler(getHours),
  updateHours: asyncHandler(updateHours),
  uploadImage,
  qrCode: asyncHandler(qrCode),
  analytics: asyncHandler(analytics),
  ordersReportCsv: asyncHandler(ordersReportCsv),
  events,
  pushPublicKey: asyncHandler(pushPublicKey),
  listPushSubscriptions: asyncHandler(listPushSubscriptions),
  createPushSubscription: asyncHandler(createPushSubscription),
  deletePushSubscription: asyncHandler(deletePushSubscription),
};
