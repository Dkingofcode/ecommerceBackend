const express = require('express');
const adminController = require('../controllers/admin.controller');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// All routes require admin authentication
router.use(authMiddleware.authenticate);
router.use(authMiddleware.authorize('admin'));

// Dashboard
router.get('/dashboard/stats', adminController.getDashboardStats);
router.get('/sales-report', adminController.getSalesReport);

// Users management
router.get('/users', adminController.getAllUsers);
router.patch('/users/:userId/role', adminController.updateUserRole);
router.patch('/users/:userId/deactivate', adminController.deactivateUser);
router.patch('/users/:userId/activate', adminController.activateUser);

// Orders management
router.get('/orders', adminController.getAllOrders);

// Products management
router.get('/products', adminController.getAllProductsAdmin);
router.patch('/products/:productId/status', adminController.updateProductStatus);

// Reviews management
router.get('/reviews/pending', adminController.getPendingReviews);

// Export data
router.get('/export', adminController.exportData);

module.exports = router;