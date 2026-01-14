const express = require('express');
const { body } = require('express-validator');
const reviewController = require('../controllers/review.controller');
const authMiddleware = require('../middleware/auth');
const uploadMiddleware = require('../middleware/upload');
const validate = require('../middleware/validation');

const router = express.Router();

// Public routes
router.get('/product/:productId', reviewController.getProductReviews);

// Protected routes
router.use(authMiddleware.authenticate);

router.get('/my-reviews', reviewController.getUserReviews);

router.post(
  '/',
  uploadMiddleware.array('images', 5),
  [
    body('productId').isMongoId(),
    body('rating').isInt({ min: 1, max: 5 }),
    body('comment').trim().notEmpty(),
    validate,
  ],
  reviewController.createReview
);

router.put(
  '/:id',
  [
    body('rating').isInt({ min: 1, max: 5 }),
    body('comment').trim().notEmpty(),
    validate,
  ],
  reviewController.updateReview
);

router.delete('/:id', reviewController.deleteReview);

router.post(
  '/:id/vote',
  [body('vote').isIn(['up', 'down']), validate],
  reviewController.voteReview
);

// Seller/Admin routes
router.post(
  '/:id/respond',
  authMiddleware.authorize('seller', 'admin'),
  [body('comment').trim().notEmpty(), validate],
  reviewController.respondToReview
);

router.patch(
  '/:id/approve',
  authMiddleware.authorize('admin'),
  reviewController.approveReview
);

router.patch(
  '/:id/reject',
  authMiddleware.authorize('admin'),
  reviewController.rejectReview
);

module.exports = router;