'use strict';

const express = require('express');
const config = require('../../config');
const restaurants = require('../services/restaurants.service');
const ordersService = require('../services/orders.service');
const bookingsService = require('../services/bookings.service');
const sse = require('../middleware/sse');
const { orderLimiter } = require('../middleware/ratelimit');
const { notFound } = require('../utils/errors');
const { asyncHandler } = require('../utils/errors');
const v = require('../validators');

const router = express.Router();

/** Public homepage directory of all active restaurants. */
router.get(
  '/restaurants',
  asyncHandler(async (req, res) => {
    res.json({ restaurants: await restaurants.listPublicDirectory() });
  })
);

/** Public storefront data for a restaurant slug. */
router.get(
  '/restaurants/:slug/menu',
  asyncHandler(async (req, res) => {
    const view = await restaurants.getPublicView(String(req.params.slug).toLowerCase());
    if (!view) throw notFound('Restaurant not found');
    res.json(view);
  })
);

/**
 * Customer checkout. No account required.
 * Money/availability/status are computed server-side only.
 */
router.post(
  '/restaurants/:slug/orders',
  orderLimiter,
  asyncHandler(async (req, res) => {
    const payload = v.validateCheckout(req.body);
    const restaurant = await restaurants.getBySlug(String(req.params.slug).toLowerCase());
    // Deliberately identical error when inactive vs missing (no enumeration).
    if (!restaurant || !restaurant.is_active) throw notFound('Restaurant not found');
    // Trial expiry blocks ordering — ponytail: one subscription check covers all public orders
    const sub = await restaurants.getSubscription(restaurant.id);
    if (!sub.active) {
      const { forbidden } = require('../utils/errors');
      throw forbidden('SUBSCRIPTION_EXPIRED', 'Trial finished — this restaurant trial ended. Contact +972567439846');
    }

    const order = await ordersService.createCheckout({ restaurantId: restaurant.id, payload });
    sse.broadcast(restaurant.id, 'order:new', {
      orderId: order.id,
      code: order.code,
      totalCents: order.total_cents,
      orderType: payload.orderType,
    });

    res.status(201).json({
      order: {
        code: order.code,
        status: order.status,
        totalCents: order.total_cents,
        subtotalCents: order.subtotal_cents,
        deliveryFeeCents: order.delivery_fee_cents,
        createdAt: order.created_at,
      },
    });
  })
);

/** Book a table (public, no account). */
router.post(
  '/restaurants/:slug/bookings',
  orderLimiter,
  asyncHandler(async (req, res) => {
    const payload = v.validateBooking(req.body);
    const restaurant = await restaurants.getBySlug(String(req.params.slug).toLowerCase());
    if (!restaurant || !restaurant.is_active) throw notFound('Restaurant not found');
    const sub = await restaurants.getSubscription(restaurant.id);
    if (!sub.active) {
      const { forbidden } = require('../utils/errors');
      throw forbidden('SUBSCRIPTION_EXPIRED', 'Trial finished — this restaurant trial ended. Contact +972567439846');
    }
    const booking = await bookingsService.create({ restaurantId: restaurant.id, payload });
    sse.broadcast(restaurant.id, 'booking:new', { bookingId: booking.id, code: booking.code, tablesCount: booking.tables_count, bookedAt: booking.booked_at });
    res.status(201).json({ booking: { code: booking.code, status: booking.status, bookedAt: booking.booked_at, tablesCount: booking.tables_count } });
  })
);

/** Customer order tracking by public code. */
router.get(
  '/orders/track/:code',
  asyncHandler(async (req, res) => {
    const code = String(req.params.code).trim();
    if (!/^[A-Za-z0-9]{6,12}$/.test(code)) throw notFound('No order found for this tracking code');
    const order = await ordersService.getByCode(code);
    res.json({ order });
  })
);

/** Customer cancels their own order within the grace window. */
router.post(
  '/orders/cancel',
  orderLimiter,
  asyncHandler(async (req, res) => {
    const code = String((req.body && req.body.code) || '').trim().toUpperCase();
    if (!/^[A-Za-z0-9]{6,12}$/.test(code)) throw notFound('No order found for this tracking code');
    const result = await ordersService.cancelByCustomer(code, config.customerCancelGraceMs);
    sse.broadcast(result.restaurantId, 'order:status', {
      orderId: result.id, code: result.code, status: result.status,
    });
    res.json({ ok: true, order: { code: result.code, status: result.status } });
  })
);

router.get('/pricing', asyncHandler(async (req, res) => {
  const platform = require('../services/platform.service');
  const p = await platform.getPricing();
  res.json({ pricing: p });
}));

// Public restaurant request form — rate limited
router.post(
  '/restaurant-requests',
  orderLimiter,
  asyncHandler(async (req, res) => {
    const v = require('../validators');
    const payload = v.validateRestaurantRequest(req.body);
    const svc = require('../services/restaurantRequests.service');
    const row = await svc.create(payload);
    res.status(201).json({ ok: true, request: { id: row.id, code: row.code } });
  })
);

router.get('/healthz', (req, res) => res.json({ ok: true }));

// Public offer preview — shareable without auth (code is unguessable 8 chars)
router.get(
  '/offer/:code',
  asyncHandler(async (req, res) => {
    const leads = require('../services/leads.service');
    const lead = await leads.getByCode(String(req.params.code).trim().toUpperCase());
    // don't expose password hash, only offer_data + public fields
    res.json({
      code: lead.code,
      restaurant_name: lead.restaurant_name,
      city: lead.city,
      score: lead.score,
      score_level: lead.score_level,
      offer: lead.offer_data,
      messages: { whatsapp: (lead.messages||{}).whatsapp, instagram: (lead.messages||{}).instagram },
    });
  })
);

module.exports = router;
