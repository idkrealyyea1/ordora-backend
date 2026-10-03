'use strict';

const express = require('express');
const owner = require('../controllers/owner.controller');
const { requireAuth, requireOwner, requireOwnerOrStaff } = require('../middleware/auth');
const { handleImageUpload } = require('../middleware/upload');

const router = express.Router();

router.use(requireAuth);

// Staff can only add restaurants — every other platform operation is owner-only.
router.get('/overview', requireOwner, owner.overview);
router.get('/reports/restaurants.csv', requireOwner, owner.restaurantsReportCsv);

router.get('/restaurants', requireOwner, owner.listRestaurants);
router.post('/restaurants', requireOwnerOrStaff, owner.createRestaurant);
router.get('/restaurants/:id', requireOwner, owner.getRestaurant);
router.patch('/restaurants/:id', requireOwner, owner.updateRestaurant);
router.delete('/restaurants/:id', requireOwner, owner.deleteRestaurant);

// Staff management — owner only (see all users/passwords)
router.get('/staff', requireOwner, owner.listStaff);
router.post('/staff', requireOwner, owner.createStaff);
router.patch('/staff/:id', requireOwner, owner.toggleStaffActive);
router.delete('/staff/:id', requireOwner, owner.deleteStaff);
router.post('/staff/:id/reset-password', requireOwner, owner.resetStaffPassword);

router.post('/restaurants/:id/admins', requireOwner, owner.createAdminUser);
router.post('/restaurants/:id/admins/:userId/reset-password', requireOwner, owner.resetAdminPassword);
router.patch('/restaurants/:id/admins/:userId', requireOwner, owner.toggleAdminActive);
router.delete('/restaurants/:id/admins/:userId', requireOwner, owner.deleteAdminUser);

router.get('/restaurants/:id/orders', requireOwner, owner.listOrdersForRestaurant);

router.get('/delivery-groups', requireOwner, owner.listDeliveryGroups);
router.post('/delivery-groups', requireOwner, owner.createDeliveryGroup);
router.patch('/delivery-groups/:id', requireOwner, owner.updateDeliveryGroup);
router.delete('/delivery-groups/:id', requireOwner, owner.deleteDeliveryGroup);

// SaaS plans + subscription lifecycle (Task 14) — platform owner only.
router.get('/plans', requireOwner, owner.listPlans);
router.post('/plans', requireOwner, owner.createPlan);
router.get('/plans/:key', requireOwner, owner.getPlan);
router.patch('/plans/:key', requireOwner, owner.updatePlan);

router.get('/restaurants/:id/subscription', requireOwner, owner.getSubscription);
router.post('/restaurants/:id/subscription/activate', requireOwner, owner.activateSubscription);
router.post('/restaurants/:id/subscription/extend', requireOwner, owner.extendSubscription);
router.post('/restaurants/:id/subscription/cancel', requireOwner, owner.cancelSubscription);
router.post('/restaurants/:id/subscription/suspend', requireOwner, owner.suspendSubscription);
router.post('/restaurants/:id/subscription/reactivate', requireOwner, owner.reactivateSubscription);
router.get('/restaurants/:id/subscription/events', requireOwner, owner.listSubscriptionEvents);

// Platform pricing — Restivo $19.99 editable.
router.get('/platform-pricing', requireOwner, owner.getPlatformPricing);
router.patch('/platform-pricing', requireOwner, owner.updatePlatformPricing);

// Restaurant requests — owner inbox for "get your own page" form.
router.get('/restaurant-requests', requireOwner, owner.listRestaurantRequests);
router.patch('/restaurant-requests/:id', requireOwner, owner.updateRestaurantRequestStatus);
router.delete('/restaurant-requests/:id', requireOwner, owner.deleteRestaurantRequest);

// Hero image management
router.get('/restaurants/:id/hero-images', requireOwner, owner.listHeroImages);
// The hero route has no ?type= of its own, so the namespace is pinned to "hero"
// and the resulting path is validated in the controller — never taken raw from
// the body. handleImageUpload must keep arity 3 (see the note in upload.js).
router.post('/restaurants/:id/hero-images', requireOwner,
  (req, res, next) => { req.uploadSubdir = 'hero'; next(); },
  handleImageUpload,
  owner.addHeroImage);
router.patch('/restaurants/:id/hero-images/:imageId', requireOwner, owner.updateHeroImage);
router.put('/restaurants/:id/hero-images/order', requireOwner, owner.reorderHeroImages);
router.delete('/restaurants/:id/hero-images/:imageId', requireOwner, owner.removeHeroImage);

// Translation management
router.get('/translations', requireOwner, owner.listTranslations);
router.put('/translations/:key', requireOwner, owner.updateTranslation);

module.exports = router;
