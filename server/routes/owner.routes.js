'use strict';

const express = require('express');
const owner = require('../controllers/owner.controller');
const { requireAuth, requireOwner, requireOwnerOrStaff } = require('../middleware/auth');

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

// Platform pricing — Restivo $19.99 editable.
router.get('/platform-pricing', requireOwner, owner.getPlatformPricing);
router.patch('/platform-pricing', requireOwner, owner.updatePlatformPricing);

// Restaurant requests — owner inbox for "get your own page" form.
router.get('/restaurant-requests', requireOwner, owner.listRestaurantRequests);
router.patch('/restaurant-requests/:id', requireOwner, owner.updateRestaurantRequestStatus);
router.delete('/restaurant-requests/:id', requireOwner, owner.deleteRestaurantRequest);

module.exports = router;
