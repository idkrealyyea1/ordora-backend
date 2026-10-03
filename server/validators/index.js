'use strict';

/**
 * Input validation & normalization for every endpoint.
 * Controllers receive fully-normalized values or a 400 is thrown.
 */

const {
  requireText,
  cleanText,
  cleanPhone,
  normalizeHexColor,
  normalizeSlug,
  toIntInRange,
  toBool,
  assertUuid,
  assertTime,
} = require('../utils/checks');
const { badRequest } = require('../utils/errors');
const { isValidTimezone } = require('../utils/datetime');
const { STATUSES } = require('../services/orders.service');

/* ---------------------------- auth ---------------------------- */

function validateLogin(body = {}) {
  const identifier = requireText(body.identifier, { field: 'identifier', min: 3, max: 120 });
  const password = typeof body.password === 'string' && body.password.length >= 1 && body.password.length <= 200
    ? body.password
    : (() => { throw badRequest('password is required'); })();
  return { identifier, password };
}

/* ------------------------- restaurants ------------------------ */

const NAME_OPTS = { field: 'name', min: 2, max: 80 };

/* Closed food-business type set (021_business_type.sql). New types need a later spec + migration. */
const BUSINESS_TYPES = [
  'restaurant', 'cafe', 'dessert_shop', 'bakery', 'cake_business',
  'home_kitchen', 'home_food_business', 'cloud_kitchen', 'small_food_business',
];

function validateBusinessType(value) {
  const t = String(value === undefined || value === null || value === '' ? 'restaurant' : value).trim().toLowerCase();
  if (!BUSINESS_TYPES.includes(t)) {
    throw badRequest('businessType must be one of: ' + BUSINESS_TYPES.join(', '), [{ field: 'businessType' }]);
  }
  return t;
}

function validateCurrencyOptional(value, field = 'currency') {
  if (value === undefined || value === null || value === '') return undefined;
  const cur = String(value).trim().toLowerCase();
  if (!/^[a-z]{3}$/.test(cur)) throw badRequest('currency must be a 3-letter ISO code', [{ field }]);
  return cur;
}

function validateRestaurantCreate(body = {}) {
  return {
    name: requireText(body.name, NAME_OPTS),
    slug: body.slug === undefined || body.slug === '' ? undefined : normalizeSlug(String(body.slug)),
    maxMenuItems: toIntInRange(body.maxMenuItems, 'maxMenuItems', { min: 1, max: 10000, fallback: 30 }),
    businessType: validateBusinessType(body.businessType),
    currency: validateCurrencyOptional(body.currency),
  };
}

/**
 * Trial/subscription window for restaurant creation. Preserves the historical
 * semantics exactly: out-of-range or unparsable values are silently ignored
 * (null), never rejected.
 */
function validateTrialWindow(body = {}) {
  if (body.trialDays !== undefined) {
    const days = Number(body.trialDays);
    if (Number.isInteger(days) && days >= 1 && days <= 365) {
      return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    }
    return null;
  }
  if (body.subscriptionEndsAt) {
    const d = new Date(body.subscriptionEndsAt);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

function validateRestaurantUpdate(body = {}) {
  const patch = {};
  if (body.name !== undefined) patch.name = requireText(body.name, NAME_OPTS);
  if (body.slug !== undefined) patch.slug = normalizeSlug(String(body.slug));
  if (body.maxMenuItems !== undefined) patch.maxMenuItems = toIntInRange(body.maxMenuItems, 'maxMenuItems', { min: 1, max: 10000 });
  if (body.businessType !== undefined) patch.businessType = validateBusinessType(body.businessType);
  if (body.currency !== undefined) {
    const cur = validateCurrencyOptional(body.currency);
    if (cur !== undefined) patch.currency = cur;
  }
  if (body.isActive !== undefined) patch.isActive = toBool(body.isActive, 'isActive');
  if (body.primaryColor !== undefined) patch.primaryColor = normalizeHexColor(body.primaryColor, 'primaryColor');
  if (body.secondaryColor !== undefined) patch.secondaryColor = normalizeHexColor(body.secondaryColor, 'secondaryColor');
  if (Object.keys(patch).length === 0) throw badRequest('No updatable fields provided');
  return patch;
}

/* -------------------------- admins ---------------------------- */

function validateUsername(value) {
  const username = String(value || '');
  if (!/^[a-zA-Z0-9_.-]{3,40}$/.test(username)) {
    throw badRequest('username must be 3-40 characters (letters, digits, . _ -)', [{ field: 'username' }]);
  }
  return username;
}

function validateEmailOptional(value) {
  if (value === undefined || value === null || value === '') return null;
  const email = String(value).trim();
  if (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw badRequest('email is invalid', [{ field: 'email' }]);
  }
  return email;
}

function validatePassword(value, field = 'password') {
  if (typeof value !== 'string' || value.length < 10 || value.length > 200) {
    throw badRequest(`${field} must be 10-200 characters`, [{ field, rule: 'minLength', min: 10 }]);
  }
  return value;
}

/* ------------------------- categories ------------------------- */

function validateCategoryCreate(body = {}) {
  return {
    name: requireText(body.name, { field: 'name', min: 1, max: 60 }),
    position: toIntInRange(body.position, 'position', { min: 0, max: 9999, fallback: 0 }),
  };
}

function validateCategoryUpdate(body = {}) {
  const patch = {};
  if (body.name !== undefined) patch.name = requireText(body.name, { field: 'name', min: 1, max: 60 });
  if (body.position !== undefined) patch.position = toIntInRange(body.position, 'position', { min: 0, max: 9999 });
  if (Object.keys(patch).length === 0) throw badRequest('No updatable fields provided');
  return patch;
}

/* ------------------------- menu items ------------------------- */

function validateItemCreate(body = {}) {
  return {
    categoryId: assertUuid(body.categoryId, 'categoryId'),
    name: requireText(body.name, { field: 'name', min: 1, max: 100 }),
    description: cleanText(body.description, { field: 'description', max: 500 }) || '',
    priceCents: toIntInRange(body.priceCents, 'priceCents', { min: 0, max: 10000000 }),
    imagePath: body.imagePath === undefined || body.imagePath === '' ? null : assertUploadPath(body.imagePath),
    isAvailable: toBool(body.isAvailable, 'isAvailable', true),
    isPopular: toBool(body.isPopular, 'isPopular', false),
    isPreorder: toBool(body.isPreorder, 'isPreorder', false),
    preorderNote: cleanText(body.preorderNote, { field: 'preorderNote', max: 300 }) || '',
    position:
      body.position === undefined || body.position === null || body.position === ''
        ? undefined
        : toIntInRange(body.position, 'position', { min: 0, max: 99999 }),
  };
}

function validateItemUpdate(body = {}) {
  const patch = {};
  if (body.categoryId !== undefined) patch.categoryId = assertUuid(body.categoryId, 'categoryId');
  if (body.name !== undefined) patch.name = requireText(body.name, { field: 'name', min: 1, max: 100 });
  if (body.description !== undefined) patch.description = cleanText(body.description, { field: 'description', max: 500 }) || '';
  if (body.priceCents !== undefined) patch.priceCents = toIntInRange(body.priceCents, 'priceCents', { min: 0, max: 10000000 });
  if (body.imagePath !== undefined) patch.imagePath = body.imagePath === null || body.imagePath === '' ? null : assertUploadPath(body.imagePath);
  if (body.isAvailable !== undefined) patch.isAvailable = toBool(body.isAvailable, 'isAvailable');
  if (body.isPopular !== undefined) patch.isPopular = toBool(body.isPopular, 'isPopular');
  if (body.isPreorder !== undefined) patch.isPreorder = toBool(body.isPreorder, 'isPreorder');
  if (body.preorderNote !== undefined) patch.preorderNote = cleanText(body.preorderNote, { field: 'preorderNote', max: 300 }) || '';
  if (body.position !== undefined) patch.position = toIntInRange(body.position, 'position', { min: 0, max: 99999 });
  if (Object.keys(patch).length === 0) throw badRequest('No updatable fields provided');
  return patch;
}

/** Upload references must look like our generated public paths. */
function assertUploadPath(value) {
  if (typeof value !== 'string' || !/^\/uploads\/(logos|covers|items)\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(value)) {
    throw badRequest('imagePath is invalid', [{ field: 'imagePath' }]);
  }
  return value;
}

/* -------------------------- settings --------------------------- */

function validateSettingsUpdate(body = {}) {
  const patch = {};
  if (body.description !== undefined) patch.description = cleanText(body.description, { field: 'description', max: 500 }) || '';
  if (body.phone !== undefined) patch.phone = cleanPhone(body.phone, { field: 'phone' }) || '';
  if (body.whatsapp !== undefined) patch.whatsapp = cleanPhone(body.whatsapp, { field: 'whatsapp' }) || '';
  if (body.address !== undefined) patch.address = cleanText(body.address, { field: 'address', max: 300 }) || '';
  if (body.timezone !== undefined) {
    const tz = String(body.timezone).trim();
    if (!isValidTimezone(tz)) throw badRequest('timezone is not a valid IANA zone', [{ field: 'timezone' }]);
    patch.timezone = tz;
  }
  if (body.logoPath !== undefined) patch.logoPath = body.logoPath ? assertUploadPath(body.logoPath) : null;
  if (body.coverPath !== undefined) patch.coverPath = body.coverPath ? assertUploadPath(body.coverPath) : null;
  if (body.nameEn !== undefined) patch.nameEn = cleanText(body.nameEn, { field: 'nameEn', max: 80 }) || null;
  if (body.primaryColor !== undefined) patch.primaryColor = normalizeHexColor(body.primaryColor, 'primaryColor');
  if (body.secondaryColor !== undefined) patch.secondaryColor = normalizeHexColor(body.secondaryColor, 'secondaryColor');
  if (body.currency !== undefined) {
    const cur = String(body.currency).trim().toLowerCase();
    if (!/^[a-z]{3}$/.test(cur)) throw badRequest('currency must be a 3-letter ISO code', [{ field: 'currency' }]);
    patch.currency = cur;
  }
  if (body.deliveryFeeCents !== undefined) {
    patch.deliveryFeeCents = toIntInRange(body.deliveryFeeCents, 'deliveryFeeCents', { min: 0, max: 1000000 });
  }
  if (body.freeDeliveryEnabled !== undefined) patch.freeDeliveryEnabled = toBool(body.freeDeliveryEnabled, 'freeDeliveryEnabled');
  if (body.freeDeliveryThresholdCents !== undefined) {
    patch.freeDeliveryThresholdCents = toIntInRange(body.freeDeliveryThresholdCents, 'freeDeliveryThresholdCents', { min: 0, max: 1000000 });
  }
  if (body.ignoreOpeningHours !== undefined) patch.ignoreOpeningHours = toBool(body.ignoreOpeningHours, 'ignoreOpeningHours');
  if (body.deliveryEnabled !== undefined) patch.deliveryEnabled = toBool(body.deliveryEnabled, 'deliveryEnabled');
  if (body.storefrontLanguage !== undefined) patch.storefrontLanguage = validateLocale(body.storefrontLanguage);
  if (Object.keys(patch).length === 0) throw badRequest('No updatable fields provided');
  return patch;
}

/* ---------------------- opening hours -------------------------- */

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function validateHours(bodyRows) {
  if (!Array.isArray(bodyRows) || bodyRows.length !== 7) {
    throw badRequest('hours must contain exactly 7 day rows (0-6)');
  }
  const seen = new Set();
  const out = bodyRows.map((row, idx) => {
    const day = toIntInRange(row && row.day, 'hours[].day', { min: 0, max: 6 });
    if (seen.has(day)) throw badRequest(`Duplicate hours entry for ${DAY_NAMES[day]}`);
    seen.add(day);
    const closed = toBool(row.closed, `hours[${idx}].closed`, false);
    const opensAt = assertTime(row.opensAt ?? '09:00', `hours[${idx}].opensAt`);
    const closesAt = assertTime(row.closesAt ?? '17:00', `hours[${idx}].closesAt`);
    return { day, closed, opensAt, closesAt };
  });
  out.sort((a, b) => a.day - b.day);
  return out;
}

/* -------------------------- checkout --------------------------- */

function validateCheckout(body = {}) {
  const customerName = requireText(body.customerName, { field: 'customerName', min: 2, max: 80 });
  const customerWhatsapp = cleanPhone(body.customerWhatsapp, { field: 'customerWhatsapp', required: true });
  const customerPhone = cleanPhone(body.customerPhone, { field: 'customerPhone' });

  const orderTypeRaw = body.orderType;
  if (orderTypeRaw !== 'pickup' && orderTypeRaw !== 'delivery') {
    throw badRequest('orderType must be "pickup" or "delivery"', [{ field: 'orderType' }]);
  }

  let customerAddress = null;
  if (orderTypeRaw === 'delivery') {
    customerAddress = requireText(body.customerAddress, { field: 'customerAddress', min: 5, max: 250 });
  } else if (body.customerAddress !== undefined && body.customerAddress !== '') {
    customerAddress = cleanText(body.customerAddress, { field: 'customerAddress', max: 250 }) || null;
  }

  const notes = cleanText(body.notes, { field: 'notes', max: 400 }) || null;

  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw badRequest('Cart is empty', [{ field: 'items' }]);
  }
  if (body.items.length > 50) throw badRequest('Too many distinct items', [{ field: 'items' }]);

  const items = body.items.map((line) => ({
    itemId: assertUuid(line && line.itemId, 'items[].itemId'),
    quantity: toIntInRange(line && line.quantity, 'items[].quantity', { min: 1, max: 99 }),
    selections: validateSelections(line && line.selections),
  }));

  // Optional idempotency key: client-generated UUID per order attempt. Repeat
  // submissions with the same key return the original order (FR-008b).
  const submissionKey =
    body.submissionKey === undefined || body.submissionKey === null || body.submissionKey === ''
      ? null
      : assertUuid(body.submissionKey, 'submissionKey');

  return { customerName, customerWhatsapp, customerPhone, customerAddress, orderType: orderTypeRaw, notes, items, submissionKey };
}

/* ---------------------- delivery groups ------------------------ */

function validateDeliveryGroupCreate(body = {}) {
  return {
    name: requireText(body.name, { field: 'name', min: 1, max: 80 }),
    phone: cleanPhone(body.phone, { field: 'phone' }) || '',
    notes: cleanText(body.notes, { field: 'notes', max: 300 }) || '',
  };
}

function validateDeliveryGroupUpdate(body = {}) {
  const patch = {};
  if (body.name !== undefined) patch.name = requireText(body.name, { field: 'name', min: 1, max: 80 });
  if (body.phone !== undefined) patch.phone = cleanPhone(body.phone, { field: 'phone' }) || '';
  if (body.notes !== undefined) patch.notes = cleanText(body.notes, { field: 'notes', max: 300 }) || '';
  if (Object.keys(patch).length === 0) throw badRequest('No updatable fields provided');
  return patch;
}

function validateDeliverySelection(body = {}) {
  if (!Array.isArray(body.groupIds)) throw badRequest('groupIds must be an array', [{ field: 'groupIds' }]);
  const ids = body.groupIds.map((id, i) => assertUuid(id, `groupIds[${i}]`));
  if (ids.length > 20) throw badRequest('Too many delivery groups selected');
  return [...new Set(ids)];
}

/* --------------------------- bookings --------------------------- */

const BOOKING_STATUSES = ['pending', 'confirmed', 'cancelled', 'completed', 'noshow'];

function validateBooking(body = {}) {
  const customerName = requireText(body.customerName, { field: 'customerName', min: 2, max: 80 });
  const customerWhatsapp = cleanPhone(body.customerWhatsapp, { field: 'customerWhatsapp', required: true });
  const customerPhone = cleanPhone(body.customerPhone, { field: 'customerPhone' });
  const tablesCount = toIntInRange(body.tablesCount, 'tablesCount', { min: 1, max: 20 });
  const rawAt = body.bookedAt;
  if (typeof rawAt !== 'string' || !rawAt) throw badRequest('bookedAt is required', [{ field: 'bookedAt' }]);
  const bookedAt = new Date(rawAt);
  if (Number.isNaN(bookedAt.getTime())) throw badRequest('bookedAt must be a valid ISO datetime', [{ field: 'bookedAt' }]);
  if (bookedAt.getTime() < Date.now() - 60 * 1000) throw badRequest('bookedAt cannot be in the past', [{ field: 'bookedAt' }]);
  const notes = cleanText(body.notes, { field: 'notes', max: 400 }) || null;
  return { customerName, customerWhatsapp, customerPhone, tablesCount, bookedAt: bookedAt.toISOString(), notes };
}

function validateBookingStatusChange(body = {}) {
  const status = body.status;
  if (!BOOKING_STATUSES.includes(status)) throw badRequest('Unknown booking status', [{ field: 'status' }]);
  return { status };
}

/* --------------------------- misc ------------------------------ */

function validateStatusChange(body = {}) {
  const status = body.status;
  if (!STATUSES.includes(status)) throw badRequest('Unknown order status', [{ field: 'status' }]);
  return { status };
}

function validatePlatformPricing(body = {}) {
  const patch = {};
  if (body.pricingCents !== undefined) patch.pricingCents = toIntInRange(body.pricingCents, 'pricingCents', { min: 0, max: 1000000 });
  if (body.pricingCurrency !== undefined) {
    const cur = String(body.pricingCurrency).trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(cur)) throw badRequest('pricingCurrency must be 3-letter code', [{ field: 'pricingCurrency' }]);
    patch.pricingCurrency = cur;
  }
  if (body.pricingPeriod !== undefined) {
    const p = String(body.pricingPeriod).trim().toLowerCase();
    if (!['month','year'].includes(p)) throw badRequest('pricingPeriod must be month or year', [{ field: 'pricingPeriod' }]);
    patch.pricingPeriod = p;
  }
  if (body.trialDays !== undefined) patch.trialDays = toIntInRange(body.trialDays, 'trialDays', { min: 0, max: 365 });
  if (body.brandName !== undefined) patch.brandName = requireText(body.brandName, { field: 'brandName', min: 1, max: 40 });
  if (Object.keys(patch).length === 0) throw badRequest('No updatable fields provided');
  return patch;
}

function validateRestaurantRequest(body = {}) {
  return {
    customerName: requireText(body.customerName, { field: 'customerName', min: 2, max: 80 }),
    restaurantName: requireText(body.restaurantName, { field: 'restaurantName', min: 2, max: 80 }),
    phone: cleanPhone(body.phone, { field: 'phone', required: true }),
    whatsapp: cleanPhone(body.whatsapp, { field: 'whatsapp', required: true }),
    city: cleanText(body.city, { field: 'city', max: 60 }) || '',
    notes: cleanText(body.notes, { field: 'notes', max: 500 }) || '',
  };
}

function validatePagination(query) {
  const limit = Math.min(toIntInRange(query.limit, 'limit', { min: 1, max: 100, fallback: 25 }), 100);
  const page = Math.max(toIntInRange(query.page, 'page', { min: 1, max: 1000000, fallback: 1 }), 1);
  return { limit, offset: (page - 1) * limit, page };
}

/* Analytics period: presets plus a bounded custom range (mutually exclusive). */

const ANALYTICS_PRESETS = ['today', '7d', '30d'];
const ANALYTICS_MAX_RANGE_DAYS = 90;

function parseAnalyticsDate(value, field) {
  const s = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw badRequest(`${field} must be YYYY-MM-DD`, [{ field }]);
  const d = new Date(s + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) throw badRequest(`${field} is not a valid date`, [{ field }]);
  return s;
}

function validateAnalyticsPeriod(query = {}) {
  const { preset, from, to, days } = query;
  if ((from !== undefined || to !== undefined) && days !== undefined) {
    throw badRequest('Use either days or from/to, not both', [{ field: 'days' }]);
  }
  if (from !== undefined || to !== undefined) {
    if (from === undefined || to === undefined) throw badRequest('from and to are both required', [{ field: 'from' }]);
    const fromStr = parseAnalyticsDate(from, 'from');
    const toStr = parseAnalyticsDate(to, 'to');
    if (fromStr > toStr) throw badRequest('from must not be after to', [{ field: 'from' }]);
    const span = (new Date(toStr + 'T00:00:00Z') - new Date(fromStr + 'T00:00:00Z')) / 86400000 + 1;
    if (span > ANALYTICS_MAX_RANGE_DAYS) {
      throw badRequest(`Custom range must not exceed ${ANALYTICS_MAX_RANGE_DAYS} days`, [{ field: 'to' }]);
    }
    return { mode: 'range', from: fromStr, to: toStr };
  }
  if (preset !== undefined && preset !== '') {
    const p = String(preset).trim().toLowerCase();
    if (!ANALYTICS_PRESETS.includes(p)) {
      throw badRequest('preset must be one of: today, 7d, 30d', [{ field: 'preset' }]);
    }
    return { mode: 'preset', preset: p };
  }
  const n = Math.min(Math.max(Number.parseInt(days, 10) || 7, 1), 90);
  return { mode: 'days', days: n };
}

/* ---------------------- push subscriptions --------------------- */

function assertPushUrl(value, field = 'endpoint') {
  const s = String(value || '').trim();
  if (s.length < 10 || s.length > 2000) throw badRequest(`${field} must be 10-2000 characters`, [{ field }]);
  let u;
  try {
    u = new URL(s);
  } catch {
    throw badRequest(`${field} must be a valid URL`, [{ field }]);
  }
  if (u.protocol !== 'https:') throw badRequest(`${field} must use https`, [{ field }]);
  return s;
}

function assertPushKey(value, field) {
  const s = String(value || '').trim();
  if (!s || s.length > 512 || !/^[A-Za-z0-9\-_]+={0,2}$/.test(s)) {
    throw badRequest(`${field} must be non-empty base64url (max 512 chars)`, [{ field }]);
  }
  return s;
}

function validatePushSubscription(body = {}) {
  const keys = (body && body.keys) || {};
  return {
    endpoint: assertPushUrl(body.endpoint, 'endpoint'),
    p256dh: assertPushKey(keys.p256dh, 'keys.p256dh'),
    auth: assertPushKey(keys.auth, 'keys.auth'),
    label: cleanText(body.label, { field: 'label', max: 60 }) || '',
  };
}

const OPTION_PRICING_MODES = ['replace', 'adjust'];

function validateGroupPricing(value) {
  const mode = String(value === undefined || value === null || value === '' ? 'adjust' : value).trim().toLowerCase();
  if (!OPTION_PRICING_MODES.includes(mode)) {
    throw badRequest('pricing must be one of: replace, adjust', [{ field: 'pricing' }]);
  }
  return mode;
}

function checkGroupBounds({ isRequired, minPicks, maxPicks, pricing }) {
  if (minPicks > maxPicks) throw badRequest('minPicks cannot exceed maxPicks', [{ field: 'minPicks' }]);
  if (isRequired && minPicks < 1) throw badRequest('required groups need minPicks of at least 1', [{ field: 'minPicks' }]);
  if (pricing === 'replace' && maxPicks !== 1) {
    throw badRequest('replace groups allow exactly one pick (maxPicks must be 1)', [{ field: 'maxPicks' }]);
  }
}

function validateOptionGroupCreate(body = {}) {
  const out = {
    menuItemId: assertUuid(body.menuItemId, 'menuItemId'),
    name: requireText(body.name, { field: 'name', min: 1, max: 60 }),
    isRequired: toBool(body.isRequired, 'isRequired', false),
    minPicks: toIntInRange(body.minPicks, 'minPicks', { min: 0, max: 99, fallback: 0 }),
    maxPicks: toIntInRange(body.maxPicks, 'maxPicks', { min: 1, max: 99, fallback: 1 }),
    pricing: validateGroupPricing(body.pricing),
    position:
      body.position === undefined || body.position === null || body.position === ''
        ? undefined
        : toIntInRange(body.position, 'position', { min: 0, max: 99999 }),
  };
  checkGroupBounds(out);
  return out;
}

function validateOptionGroupUpdate(body = {}) {
  const patch = {};
  if (body.name !== undefined) patch.name = requireText(body.name, { field: 'name', min: 1, max: 60 });
  if (body.isRequired !== undefined) patch.isRequired = toBool(body.isRequired, 'isRequired');
  if (body.minPicks !== undefined) patch.minPicks = toIntInRange(body.minPicks, 'minPicks', { min: 0, max: 99 });
  if (body.maxPicks !== undefined) patch.maxPicks = toIntInRange(body.maxPicks, 'maxPicks', { min: 1, max: 99 });
  if (body.pricing !== undefined) patch.pricing = validateGroupPricing(body.pricing);
  if (body.position !== undefined) patch.position = toIntInRange(body.position, 'position', { min: 0, max: 99999 });
  if (Object.keys(patch).length === 0) throw badRequest('No updatable fields provided');
  return patch;
}

function validateOptionChoiceCreate(body = {}) {
  return {
    name: requireText(body.name, { field: 'name', min: 1, max: 60 }),
    priceCents: toIntInRange(body.priceCents, 'priceCents', { min: 0, max: 10000000, fallback: 0 }),
    maxQuantity: toIntInRange(body.maxQuantity, 'maxQuantity', { min: 1, max: 99, fallback: 1 }),
    isAvailable: toBool(body.isAvailable, 'isAvailable', true),
    position:
      body.position === undefined || body.position === null || body.position === ''
        ? undefined
        : toIntInRange(body.position, 'position', { min: 0, max: 99999 }),
  };
}

function validateOptionChoiceUpdate(body = {}) {
  const patch = {};
  if (body.name !== undefined) patch.name = requireText(body.name, { field: 'name', min: 1, max: 60 });
  if (body.priceCents !== undefined) patch.priceCents = toIntInRange(body.priceCents, 'priceCents', { min: 0, max: 10000000 });
  if (body.maxQuantity !== undefined) patch.maxQuantity = toIntInRange(body.maxQuantity, 'maxQuantity', { min: 1, max: 99 });
  if (body.isAvailable !== undefined) patch.isAvailable = toBool(body.isAvailable, 'isAvailable');
  if (body.position !== undefined) patch.position = toIntInRange(body.position, 'position', { min: 0, max: 99999 });
  if (Object.keys(patch).length === 0) throw badRequest('No updatable fields provided');
  return patch;
}

/**
 * Structural shape only (unknown fields dropped, client prices impossible:
 * no price field exists). Tenant scope, rules, and pricing are enforced
 * against trusted definitions at checkout write time.
 */
function validateSelections(selections) {
  if (selections === undefined || selections === null) return [];
  if (!Array.isArray(selections)) throw badRequest('selections must be an array', [{ field: 'selections' }]);
  if (selections.length > 20) throw badRequest('Too many option groups', [{ field: 'selections' }]);
  return selections.map((sel) => {
    if (!Array.isArray(sel && sel.choices) || sel.choices.length === 0 || sel.choices.length > 20) {
      throw badRequest('Each selection needs 1-20 choices', [{ field: 'selections' }]);
    }
    return {
      groupId: assertUuid(sel.groupId, 'selections[].groupId'),
      choices: sel.choices.map((line) => ({
        choiceId: assertUuid(line && line.choiceId, 'selections[].choiceId'),
        quantity: toIntInRange(line && line.quantity, 'selections[].quantity', { min: 1, max: 99 }),
      })),
    };
  });
}

/* --------------------- self-service signup ---------------------- */

/**
 * Business-type choices offered at public signup: six named types plus an
 * `other` fallback (spec 013 clarification 2026-10-02). Raw stored-only
 * values outside this set are rejected here; `resolveSignupType` maps the
 * choice to a value satisfying the restaurants CHECK constraint.
 */
const SIGNUP_TYPES = [
  'restaurant', 'cafe', 'bakery', 'dessert_shop', 'home_kitchen', 'cloud_kitchen', 'other',
];

/** `other` maps to the generic stored bucket for miscellaneous food businesses. */
function resolveSignupType(choice) {
  return choice === 'other' ? 'small_food_business' : choice;
}

function validateSignupType(value) {
  const t = String(value === undefined || value === null ? '' : value).trim().toLowerCase();
  if (!SIGNUP_TYPES.includes(t)) {
    throw badRequest('businessType must be one of: ' + SIGNUP_TYPES.join(', '), [{ field: 'businessType' }]);
  }
  return t;
}

function validateSignup(body = {}) {
  if (typeof body !== 'object' || body === null) throw badRequest('Invalid signup data');
  // Mass-assignment guard: plan/capability/tenant claims are never read.
  for (const f of ['plan', 'capabilities', 'restaurant_id', 'restaurantId', 'owner_id', 'ownerId', 'role']) {
    if (body[f] !== undefined) throw badRequest(`Field not allowed: ${f}`, [{ field: f }]);
  }
  return {
    email: validateEmailOptional(body.email),
    username: validateUsername(body.username),
    password: validatePassword(body.password),
    businessName: requireText(body.businessName, NAME_OPTS),
    businessType: validateSignupType(body.businessType),
    slug: body.slug === undefined || body.slug === '' ? undefined : normalizeSlug(String(body.slug)),
  };
}

function validateSlugAvailability(query = {}) {
  const raw = query.slug !== undefined && query.slug !== '' ? query.slug : query.name;
  if (raw === undefined || raw === '') throw badRequest('slug or name is required', [{ field: 'slug' }]);
  return normalizeSlug(String(raw));
}

const ONBOARDING_STEPS = ['type', 'info', 'setup', 'product', 'fulfillment', 'hours', 'review', 'done'];

function validateOnboardingStep(body = {}) {
  const step = String(body.step === undefined || body.step === null ? '' : body.step).trim().toLowerCase();
  if (!ONBOARDING_STEPS.includes(step) || step === 'done') {
    throw badRequest('step must be one of: type, info, setup, product, fulfillment, hours, review', [{ field: 'step' }]);
  }
  return step;
}

/* --------------------- subscription plans ----------------------- */

function validatePlanKey(value, field = 'planKey') {
  const key = String(value || '').trim().toLowerCase();
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(key) || key.length < 2 || key.length > 40) {
    throw badRequest(`${field} must be 2-40 lowercase letters, digits, or dashes`, [{ field }]);
  }
  return key;
}

function validateEntitlementMap(value) {
  if (value === undefined) return undefined;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw badRequest('entitlements must be an object', [{ field: 'entitlements' }]);
  }
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    const key = String(k).trim();
    if (!/^[a-z_]{2,40}$/.test(key)) throw badRequest(`entitlement key invalid: ${k}`, [{ field: 'entitlements' }]);
    if (typeof v === 'boolean') out[key] = { allowed: v };
    else if (Number.isInteger(v) && v >= 0) out[key] = { allowed: true, limit: v };
    else throw badRequest(`entitlement ${k} must be a boolean or non-negative integer`, [{ field: 'entitlements' }]);
  }
  return out;
}

function validatePlanCreate(body = {}) {
  if (typeof body !== 'object' || body === null) throw badRequest('Invalid plan data');
  const plan = {
    key: validatePlanKey(body.key, 'key'),
    name: requireText(body.name, { field: 'name', min: 2, max: 80 }),
    description: cleanText(body.description, { field: 'description', max: 500 }) || '',
    priceCents: toIntInRange(body.priceCents, 'priceCents', { min: 0, max: 1000000 }),
    currency: String(body.currency || '').trim().toUpperCase(),
    period: String(body.period || '').trim().toLowerCase(),
    trialEligible: toBool(body.trialEligible, 'trialEligible', true),
    entitlements: validateEntitlementMap(body.entitlements) || {},
  };
  if (!/^[A-Z]{3}$/.test(plan.currency)) throw badRequest('currency must be a 3-letter code', [{ field: 'currency' }]);
  if (!['month', 'year'].includes(plan.period)) throw badRequest('period must be month or year', [{ field: 'period' }]);
  return plan;
}

function validatePlanUpdate(body = {}) {
  const patch = {};
  if (body.name !== undefined) patch.name = requireText(body.name, { field: 'name', min: 2, max: 80 });
  if (body.description !== undefined) patch.description = cleanText(body.description, { field: 'description', max: 500 }) || '';
  if (body.priceCents !== undefined) patch.priceCents = toIntInRange(body.priceCents, 'priceCents', { min: 0, max: 1000000 });
  if (body.currency !== undefined) {
    const cur = String(body.currency).trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(cur)) throw badRequest('currency must be a 3-letter code', [{ field: 'currency' }]);
    patch.currency = cur;
  }
  if (body.period !== undefined) {
    const p = String(body.period).trim().toLowerCase();
    if (!['month', 'year'].includes(p)) throw badRequest('period must be month or year', [{ field: 'period' }]);
    patch.period = p;
  }
  if (body.isActive !== undefined) patch.isActive = toBool(body.isActive, 'isActive');
  if (body.trialEligible !== undefined) patch.trialEligible = toBool(body.trialEligible, 'trialEligible');
  if (body.entitlements !== undefined) patch.entitlements = validateEntitlementMap(body.entitlements);
  if (Object.keys(patch).length === 0) throw badRequest('No updatable fields provided');
  return patch;
}

/* ----------------------- subscription actions --------------------- */

function validateSubscriptionActivate(body = {}) {
  const out = { planKey: validatePlanKey(body.planKey), reason: cleanText(body.reason, { field: 'reason', max: 300 }) || '' };
  if (body.periodEndsAt !== undefined && body.periodEndsAt !== null && body.periodEndsAt !== '') {
    const d = new Date(body.periodEndsAt);
    if (Number.isNaN(d.getTime())) throw badRequest('periodEndsAt must be a valid date', [{ field: 'periodEndsAt' }]);
    out.periodEndsAt = d.toISOString();
  }
  return out;
}

function validateSubscriptionExtend(body = {}) {
  const hasDays = body.extendDays !== undefined && body.extendDays !== null && body.extendDays !== '';
  const hasDate = body.newEndsAt !== undefined && body.newEndsAt !== null && body.newEndsAt !== '';
  if (hasDays === hasDate) throw badRequest('Provide exactly one of extendDays or newEndsAt', [{ field: 'extendDays' }]);
  const out = { reason: cleanText(body.reason, { field: 'reason', max: 300 }) || '' };
  if (hasDays) {
    const n = Number(body.extendDays);
    if (!Number.isInteger(n) || n < 1 || n > 3650) throw badRequest('extendDays must be 1-3650', [{ field: 'extendDays' }]);
    out.extendDays = n;
  } else {
    const d = new Date(body.newEndsAt);
    if (Number.isNaN(d.getTime())) throw badRequest('newEndsAt must be a valid date', [{ field: 'newEndsAt' }]);
    out.newEndsAt = d.toISOString();
  }
  return out;
}

function validateSubscriptionCancel(body = {}) {
  const effective = String(body.effective === undefined ? 'period_end' : body.effective).trim().toLowerCase();
  if (!['now', 'period_end'].includes(effective)) throw badRequest('effective must be now or period_end', [{ field: 'effective' }]);
  return { effective, reason: cleanText(body.reason, { field: 'reason', max: 300 }) || '' };
}

function validateSubscriptionSuspend(body = {}) {
  const reason = cleanText(body.reason, { field: 'reason', max: 300 });
  if (!reason) throw badRequest('reason is required', [{ field: 'reason' }]);
  return { reason };
}

function validateSubscriptionReason(body = {}) {
  return { reason: cleanText(body && body.reason, { field: 'reason', max: 300 }) || '' };
}

module.exports = {
  validateLogin,
  validateRestaurantCreate,
  validateTrialWindow,
  validateRestaurantUpdate,
  validateUsername,
  validateEmailOptional,
  validatePassword,
  validateCategoryCreate,
  validateCategoryUpdate,
  validateItemCreate,
  validateItemUpdate,
  validateSettingsUpdate,
  validateHours,
  validateCheckout,
  validateBooking,
  validateBookingStatusChange,
  BOOKING_STATUSES,
  validateStatusChange,
  validateDeliveryGroupCreate,
  validateDeliveryGroupUpdate,
  validateDeliverySelection,
  validatePlatformPricing,
  validateRestaurantRequest,
  validatePagination,
  validateAnalyticsPeriod,
  ANALYTICS_PRESETS,
  validateOptionGroupCreate,
  validateOptionGroupUpdate,
  validateOptionChoiceCreate,
  validateOptionChoiceUpdate,
  validateSelections,
  validatePushSubscription,
  validateSignup,
  validateSignupType,
  resolveSignupType,
  validateSlugAvailability,
  validateOnboardingStep,
  ONBOARDING_STEPS,
  SIGNUP_TYPES,
  validatePlanKey,
  validateEntitlementMap,
  validatePlanCreate,
  validatePlanUpdate,
  validateSubscriptionActivate,
  validateSubscriptionExtend,
  validateSubscriptionCancel,
  validateSubscriptionSuspend,
  validateSubscriptionReason,
  assertUuid,
  validateLocale,
  validateHeroImagePath,
  validateItemImagePath,
};

function validateLocale(value) {
  const locale = String(value || '').trim().toLowerCase();
  if (!['ar', 'en'].includes(locale)) {
    throw badRequest('locale must be "ar" or "en"', [{ field: 'locale' }]);
  }
  return locale;
}

function validateItemImagePath(value) {
  // Product photos are written into the `items` namespace by the existing
  // type=items upload, so that is the only namespace accepted here.
  if (typeof value !== 'string' || !/^\/uploads\/items\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(value)) {
    throw badRequest('imagePath is invalid', [{ field: 'imagePath' }]);
  }
  return value;
}

function validateHeroImagePath(value) {
  // The cover and hero namespaces are both writable to business_hero_images: the
  // cover uploader posts type=covers, the hero uploader posts type=hero. Accepting
  // only one of them rejected every real hero path. logos/items are separate
  // owners and stay rejected.
  if (typeof value !== 'string' || !/^\/uploads\/(covers|hero)\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(value)) {
    throw badRequest('imagePath is invalid', [{ field: 'imagePath' }]);
  }
  return value;
}
