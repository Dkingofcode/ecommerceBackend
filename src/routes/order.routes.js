const express = require('express');
const { body } = require('express-validator');
const orderController = require('../controllers/order.controller');
const authMiddleware = require('../middleware/auth');
const validate = require('../middleware/validation');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware.authenticate);

// User routes
router.get('/', orderController.getUserOrders);
router.get('/:id', orderController.getOrder);

router.post(
  '/',
  [
    body('shippingAddress').isObject(),
    body('shippingAddress.firstName').trim().notEmpty(),
    body('shippingAddress.lastName').trim().notEmpty(),
    body('shippingAddress.address').trim().notEmpty(),
    body('shippingAddress.city').trim().notEmpty(),
    body('shippingAddress.state').trim().notEmpty(),
    body('shippingAddress.country').trim().notEmpty(),
    body('shippingAddress.zipCode').trim().notEmpty(),
    body('shippingAddress.phone').trim().notEmpty(),
    body('paymentMethod').isIn(['card', 'paypal', 'cod', 'bank_transfer']),
    validate,
  ],
  orderController.createOrder
);

router.post(
  '/:id/cancel',
  [body('reason').optional().trim(), validate],
  orderController.cancelOrder
);

router.post(
  '/:id/return',
  [body('reason').trim().notEmpty(), validate],
  orderController.requestReturn
);

// Admin routes
router.patch(
  '/:id/status',
  authMiddleware.authorize('admin', 'seller'),
  [body('status').notEmpty(), validate],
  orderController.updateOrderStatus
);

router.get(
  '/admin/stats',
  authMiddleware.authorize('admin'),
  orderController.getOrderStats
);

module.exports = router;