const express = require('express');
const { body } = require('express-validator');
const wishlistController = require('../controllers/wishlist.controller');
const authMiddleware = require('../middleware/auth');
const validate = require('../middleware/validation');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware.authenticate);

router.get('/', wishlistController.getWishlist);

router.post(
  '/',
  [
    body('productId').isMongoId(),
    body('note').optional().trim(),
    validate,
  ],
  wishlistController.addToWishlist
);

router.delete('/:productId', wishlistController.removeFromWishlist);

router.delete('/', wishlistController.clearWishlist);

router.get('/check/:productId', wishlistController.checkProduct);

module.exports = router;