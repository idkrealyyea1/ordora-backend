'use strict';

/**
 * Authentication controller. Sessions are regenerated on login to prevent
 * session fixation; identifiers and errors are generic (no user enumeration).
 */

const users = require('../services/users.service');
const restaurants = require('../services/restaurants.service');
const config = require('../../config');
const { unauthorized } = require('../utils/errors');
const { validateLogin } = require('../validators');
const { asyncHandler } = require('../utils/errors');
const observe = require('../utils/observe');

async function login(req, res) {
  const { identifier, password } = validateLogin(req.body);

  const user = await users.findByIdentifier(identifier);
  const ok = user && user.is_active ? await users.verifyPassword(password, user.password_hash) : false;

  // Failed attempts are traced without the identifier (no PII, no enumeration signal).
  if (!ok || !user.is_active) {
    observe.warn('auth.login_failed', {});
    throw unauthorized('Invalid credentials');
  }
  if (user.role === 'admin') {
    // Deactivated tenant blocks login even if the account itself is active.
    const rest = await restaurants.getById(user.restaurant_id);
    if (!rest || !rest.is_active) throw unauthorized('Invalid credentials');
    // Task 14: login is identity, not access — expired/suspended owners still
    // authenticate so they can reach status and recovery; gates enforce the rest.
  }
  if (user.role === 'delivery') {
    const group = (
      await require('../services/delivery.service').getById(user.delivery_group_id)
    );
    if (!group || !group.is_active) throw unauthorized('Invalid credentials');
  }

  await new Promise((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });
  req.session.userId = user.id;
  observe.info('auth.login', { userId: user.id, role: user.role });

  res.json({
    user: {
      id: user.id,
      role: user.role,
      username: user.username,
      restaurantId: user.restaurant_id,
      deliveryGroupId: user.delivery_group_id,
    },
  });
}

async function logout(req, res) {
  const userId = req.session.userId || null;
  if (!req.session.userId) return res.json({ ok: true });
  await new Promise((resolve) => {
    req.session.destroy(() => resolve());
  });
  observe.info('auth.logout', { userId });
  res.clearCookie(config.cookieName);
  res.json({ ok: true });
}

function me(req, res) {
  if (!req.user) return res.json({ user: null });
  res.json({
    user: {
      id: req.user.id,
      role: req.user.role,
      username: req.user.username,
      restaurantId: req.user.restaurant_id,
      restaurantName: req.user.restaurant_name,
      restaurantSlug: req.user.restaurant_slug,
      deliveryGroupId: req.user.delivery_group_id,
      platformLanguage: req.user.platform_language || 'ar',
    },
  });
}

async function setLanguage(req, res) {
  const locale = String((req.body && req.body.locale) || '').toLowerCase();
  if (locale !== 'ar' && locale !== 'en') {
    return res.status(400).json({ error: 'locale must be "ar" or "en"' });
  }
  if (req.user) await users.setPlatformLanguage(req.user.id, locale);
  res.json({ ok: true, locale });
}

module.exports = { login: asyncHandler(login), logout: asyncHandler(logout), me, setLanguage: asyncHandler(setLanguage) };
