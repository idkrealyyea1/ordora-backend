'use strict';

/**
 * Authentication + authorization middleware.
 *
 * The session stores ONLY the user id; every request re-loads the user from
 * PostgreSQL so deactivation / role changes apply immediately. Restaurant
 * identity is ALWAYS derived from the database record of the authenticated
 * user — never from request parameters.
 */

const { query } = require('../db/pool');
const { unauthorized, forbidden } = require('../utils/errors');

async function attachUser(req, res, next) {
  req.user = null;
  try {
    const userId = req.session && req.session.userId;
    if (userId) {
      const { rows } = await query(
        `SELECT u.id, u.role, u.username, u.restaurant_id, u.delivery_group_id, u.platform_language,
                r.is_active AS restaurant_is_active, r.slug AS restaurant_slug,
                g.is_active AS delivery_group_is_active
         FROM users u
         LEFT JOIN restaurants r ON r.id = u.restaurant_id
         LEFT JOIN delivery_groups g ON g.id = u.delivery_group_id
         WHERE u.id = $1 AND u.is_active = TRUE`,
        [userId]
      );
      if (rows[0]) {
        req.user = rows[0];
      } else {
        // Stale session pointing to a deleted/deactivated user.
        req.session.destroy(() => {});
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}

function requireAuth(req, res, next) {
  if (!req.user) return next(unauthorized());
  next();
}

function requireOwner(req, res, next) {
  if (!req.user) return next(unauthorized());
  if (req.user.role !== 'owner') return next(forbidden());
  next();
}

function requireOwnerOrStaff(req, res, next) {
  if (!req.user) return next(unauthorized());
  if (req.user.role !== 'owner' && req.user.role !== 'staff') return next(forbidden());
  next();
}

async function requireRestaurantAdmin(req, res, next) {
  if (!req.user) return next(unauthorized());
  if (req.user.role !== 'owner' && req.user.role !== 'admin' && req.user.role !== 'staff') return next(forbidden());
  if (req.user.role === 'admin') {
    if (!req.user.restaurant_id) return next(forbidden('NO_RESTAURANT', 'Account is not linked to a restaurant'));
    if (req.user.restaurant_is_active === false) {
      return next(forbidden('RESTAURANT_DISABLED', 'This restaurant has been deactivated by the platform owner'));
    }
    // Trial/subscription gate (Task 14): one joined read resolves the derived
    // state; mutations stay blocked once access lapses, reads stay reachable.
    try {
      const { getSubscription } = require('../services/restaurants.service');
      const sub = await getSubscription(req.user.restaurant_id);
      if (!sub.active && req.method !== 'GET') {
        return next(forbidden('SUBSCRIPTION_EXPIRED', 'انتهت فترة التجربة 7 أيام — تواصل +972567439846 ($19.99/شهر) | 7-day trial finished — contact +972567439846'));
      }
    } catch (e) { return next(e); }
  }
  next();
}

function forbidStaffDelete(req, res, next) {
  if (req.user && req.user.role === 'staff' && req.method === 'DELETE') {
    return next(forbidden('STAFF_NO_DELETE', 'Staff cannot delete'));
  }
  next();
}

/** Staff role is excluded from owner alert surfaces (e.g. push subscriptions). */
function forbidStaff(req, res, next) {
  if (req.user && req.user.role === 'staff') {
    return next(forbidden('STAFF_NO_PUSH', 'Staff accounts cannot manage notifications'));
  }
  next();
}

function requireDelivery(req, res, next) {
  if (!req.user) return next(unauthorized());
  if (req.user.role !== 'delivery') return next(forbidden());
  if (!req.user.delivery_group_id) return next(forbidden('NO_DELIVERY_GROUP', 'Account is not linked to a delivery company'));
  if (req.user.delivery_group_is_active === false) {
    return next(forbidden('DELIVERY_DISABLED', 'This delivery company has been deactivated by the platform owner'));
  }
  next();
}

/** Resolve the tenant id strictly from the authenticated user (multi-tenant guard). */
function tenantIdOf(req) {
  if (req.user.role === 'owner' || req.user.role === 'staff') return null; // platform roles act across tenants explicitly
  return req.user.restaurant_id;
}

/**
 * Capability gate (spec 013). Composed AFTER requireRestaurantAdmin:
 * tenant comes only from the session; the matrix in
 * capabilities.service.js is evaluated live (type AND entitlement AND
 * configuration). Hidden UI is never the enforcement — this is.
 */
function requireCapability(key) {
  return async function capabilityGate(req, res, next) {
    try {
      const { query } = require('../db/pool');
      const { can } = require('../services/capabilities.service');
      const tenantId = req.user && req.user.role !== 'owner' && req.user.role !== 'staff'
        ? req.user.restaurant_id
        : req.query.restaurantId || null;
      if (!tenantId) return next(forbidden('NO_RESTAURANT', 'Account is not linked to a restaurant'));
      const { rows } = await query(
        `SELECT r.business_type, r.subscription_ends_at, s.delivery_enabled
         FROM restaurants r LEFT JOIN restaurant_settings s ON s.restaurant_id = r.id
         WHERE r.id = $1`,
        [tenantId]
      );
      if (!rows[0]) return next(forbidden('NO_RESTAURANT', 'Account is not linked to a restaurant'));
      const ok = can(
        {
          businessType: rows[0].business_type || 'restaurant',
          subscriptionEndsAt: rows[0].subscription_ends_at,
          settings: { delivery_enabled: rows[0].delivery_enabled },
        },
        key
      );
      if (!ok) return next(forbidden('CAPABILITY_UNAVAILABLE', 'This feature is not available for your business'));
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { attachUser, requireAuth, requireOwner, requireOwnerOrStaff, requireRestaurantAdmin, requireDelivery, forbidStaffDelete, forbidStaff, tenantIdOf, requireCapability };
