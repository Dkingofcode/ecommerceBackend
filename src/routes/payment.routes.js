const express = require('express');
const { body } = require('express-validator');
const paymentController = require('../controllers/payment.controller');
const authMiddleware = require('../middleware/auth');
const validate = require('../middleware/validation');

const router = express.Router();

// Stripe webhook (no auth required)
router.post(
  '/webhook/stripe',
  express.raw({ type: 'application/json' }),
  paymentController.stripeWebhook
);

// Protected routes
router.use(authMiddleware.authenticate);

router.post(
  '/intent',
  [body('orderId').isMongoId(), validate],
  paymentController.createPaymentIntent
);

router.post(
  '/confirm',
  [
    body('orderId').isMongoId(),
    body('paymentIntentId').notEmpty(),
    validate,
  ],
  paymentController.confirmPayment
);

router.post(
  '/refund',
  authMiddleware.authorize('admin'),
  [
    body('orderId').isMongoId(),
    body('amount').optional().isFloat({ min: 0 }),
    body('reason').optional().trim(),
    validate,
  ],
  paymentController.refundPayment
);

module.exports = router;