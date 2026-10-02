'use strict';

/**
 * Primitive validation / sanitization helpers.
 * All user input flows through these before reaching SQL or storage.
 */

const { badRequest } = require('./errors');

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/**
 * Trim, strip control characters (NUL included), cap length.
 * Returns null when the result is empty and optional, throws when required.
 */
function cleanText(value, { field, min = 0, max = 255, required = false }) {
  if (value === undefined || value === null) value = '';
  if (typeof value !== 'string') throw badRequest(`${field} must be a string`);
  const cleaned = value.replace(CONTROL_CHARS, '').trim();
  if (cleaned.length < min) {
    if (required) throw badRequest(`${field} is required`);
    if (cleaned.length > 0) throw badRequest(`${field} must be at least ${min} characters`, [{ field, rule: 'minLength', min }]);
    return required ? null : cleaned.length === 0 ? '' : null;
  }
  if (cleaned.length > max) throw badRequest(`${field} must be at most ${max} characters`, [{ field, rule: 'maxLength', max }]);
  return cleaned;
}

function requireText(value, opts) {
  const out = cleanText(value, { ...opts, required: true });
  if (out === null || out === '') throw badRequest(`${opts.field} is required`);
  return out;
}

/** Digits-only phone/WhatsApp numbers (international format without +). */
function cleanPhone(value, { field, required = false }) {
  if (value === undefined || value === null || value === '') {
    if (required) throw badRequest(`${field} is required`);
    return null;
  }
  if (typeof value !== 'string') throw badRequest(`${field} must be a string`);
  const digits = value.replace(/[^0-9]/g, '');
  if (digits.length < 8 || digits.length > 15) {
    throw badRequest(`${field} must contain 8-15 digits`, [{ field, rule: 'phone' }]);
  }
  return digits;
}

const HEX_COLOR = /^#([0-9a-f]{6})$/i;
function normalizeHexColor(value, field) {
  if (typeof value !== 'string' || !HEX_COLOR.test(value.trim())) {
    throw badRequest(`${field} must be a hex color like #1a2b3c`, [{ field, rule: 'hexColor' }]);
  }
  return `#${value.trim().slice(1).toLowerCase()}`;
}

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const RESERVED_SLUGS = new Set([
  'www', 'api', 'admin', 'owner', 'login', 'logout', 'track', 'restaurant', 'restaurants',
  'uploads', 'static', 'assets', 'healthz', 'public', 'app', 'dashboard', 'account',
]);

function normalizeSlug(value, field = 'slug') {
  if (typeof value !== 'string') throw badRequest(`${field} must be a string`);
  const slug = value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!slug || slug.length < 2 || slug.length > 63) {
    throw badRequest(`${field} must be 2-63 characters (letters, digits, dashes)`, [{ field, rule: 'slug' }]);
  }
  if (!SLUG_RE.test(slug)) throw badRequest(`${field} has an invalid format`, [{ field, rule: 'slug' }]);
  if (RESERVED_SLUGS.has(slug)) throw badRequest(`"${slug}" is reserved`, [{ field, rule: 'reservedSlug' }]);
  return slug;
}

function toIntInRange(value, field, { min, max, fallback }) {
  if (value === undefined || value === null || value === '') {
    if (fallback !== undefined) return fallback;
    throw badRequest(`${field} is required`);
  }
  const n = typeof value === 'number' ? value : Number.parseInt(String(value).trim(), 10);
  if (!Number.isInteger(n)) throw badRequest(`${field} must be a whole number`, [{ field, rule: 'integer' }]);
  if (n < min || n > max) throw badRequest(`${field} must be between ${min} and ${max}`, [{ field, rule: 'range', min, max }]);
  return n;
}

function toBool(value, field, fallback = undefined) {
  if (value === undefined || value === null || value === '') {
    if (fallback !== undefined) return fallback;
    throw badRequest(`${field} is required`);
  }
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw badRequest(`${field} must be true or false`);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function assertUuid(value, field = 'id') {
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    throw badRequest(`${field} is invalid`);
  }
  return value.toLowerCase();
}

const TIME_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
function assertTime(value, field) {
  if (typeof value !== 'string' || !TIME_RE.test(value.trim())) {
    throw badRequest(`${field} must be in HH:MM format`, [{ field, rule: 'time' }]);
  }
  return value.trim();
}

/**
 * Numeric-suffix slug variant: attempt 0 → base, then base-2, base-3, …
 * Kept within the 63-char slug limit by trimming the base. The DB UNIQUE
 * constraint stays the final arbiter; callers loop with slugExists().
 */
function withSlugSuffix(base, attempt) {
  if (!attempt) return base;
  const suffix = `-${attempt + 1}`;
  return `${base.slice(0, 63 - suffix.length)}${suffix}`;
}

module.exports = {
  cleanText,
  requireText,
  cleanPhone,
  normalizeHexColor,
  normalizeSlug,
  withSlugSuffix,
  toIntInRange,
  toBool,
  assertUuid,
  assertTime,
};
