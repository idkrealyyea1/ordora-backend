'use strict';

const express = require('express');
const admin = require('../controllers/admin.controller');
const { requireAuth, requireRestaurantAdmin, forbidStaffDelete } = require('../middleware/auth');

const router = express.Router();

// Platform owners may inspect tenant data through the same endpoints
// (admin.tenantId allows ?restaurantId= for role='owner').
router.use(requireAuth, requireRestaurantAdmin);

router.get('/restaurant', admin.myRestaurant);
router.patch('/status', admin.setStatus);
router.get('/dashboard', admin.dashboard);
router.get('/analytics', admin.analytics);
router.get('/reports/orders.csv', admin.ordersReportCsv);
router.get('/qr', admin.qrCode);

// Live new-order notifications (Server-Sent Events)
router.get('/events', admin.events);

// Categories
router.get('/categories', admin.listCategories);
router.post('/categories', admin.createCategory);
router.patch('/categories/:id', admin.updateCategory);
router.delete('/categories/:id', forbidStaffDelete, admin.deleteCategory);

// Menu items
router.get('/items', admin.listItems);
router.post('/items', admin.createItem);
router.patch('/items/:id', admin.updateItem);
router.delete('/items/:id', forbidStaffDelete, admin.deleteItem);

// Product option groups (tenant-scoped; ?menuItemId= required for listing)
router.get('/option-groups', admin.listOptionGroups);
router.post('/option-groups', admin.createOptionGroup);
router.patch('/option-groups/:id', admin.updateOptionGroup);
router.delete('/option-groups/:id', forbidStaffDelete, admin.deleteOptionGroup);

// Choices within a group
router.get('/option-groups/:id/choices', admin.listOptionChoices);
router.post('/option-groups/:id/choices', admin.createOptionChoice);
router.patch('/option-groups/:groupId/choices/:choiceId', admin.updateOptionChoice);
router.delete('/option-groups/:groupId/choices/:choiceId', forbidStaffDelete, admin.deleteOptionChoice);

// Orders
router.get('/orders', admin.listOrders);
router.get('/orders/:id', admin.getOrder);
router.patch('/orders/:id/status', admin.changeOrderStatus);
router.delete('/orders/:id', forbidStaffDelete, admin.deleteOrder);

// Bookings
router.get('/bookings', admin.listBookings);
router.get('/bookings/:id', admin.getBooking);
router.patch('/bookings/:id/status', admin.changeBookingStatus);
router.delete('/bookings/:id', forbidStaffDelete, admin.deleteBooking);

// Settings + opening hours
router.get('/settings', admin.getSettings);
router.patch('/settings', admin.updateSettings);
router.get('/hours', admin.getHours);
router.put('/hours', admin.updateHours);

// Delivery companies available on the platform (owner-managed);
// the restaurant chooses which ones deliver for it.
router.get('/delivery-groups', admin.listMyDeliveryGroups);
router.put('/delivery-groups', admin.saveMyDeliveryGroups);

// Image uploads (?type=logos|covers|items[&itemId=...])
router.post('/images', ...admin.uploadImage);

module.exports = router;
