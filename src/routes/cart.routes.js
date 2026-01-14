const express = require('express');
const { body } = require('express-validator');
const cartController = require('../controllers/cart.controller');
const authMiddleware = require('../middleware/auth');
const validate = require('../middleware/validation');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware.authenticate);

router.get('/', cartController.getCart);

router.post(
  '/items',
  [
    body('productId').isMongoId(),
    body('quantity').isInt({ min: 1 }),
    validate,
  ],
  cartController.addToCart
);

router.put(
  '/items/:productId',
  [body('quantity').isInt({ min: 0 }), validate],
  cartController.updateCartItem
);

router.delete('/items/:productId', cartController.removeFromCart);

router.delete('/', cartController.clearCart);

router.post(
  '/coupon',
  [body('code').trim().notEmpty(), validate],
  cartController.applyCoupon
);

router.delete('/coupon', cartController.removeCoupon);

module.exports = router;