const express = require('express');
const { body } = require('express-validator');
const categoryController = require('../controllers/category.controller');
const authMiddleware = require('../middleware/auth');
const uploadMiddleware = require('../middleware/upload');
const validate = require('../middleware/validation');
const cacheMiddleware = require('../middleware/cache');

const router = express.Router();

// Public routes
router.get(
  '/',
  cacheMiddleware.cache(600),
  categoryController.getAllCategories
);

router.get(
  '/featured',
  cacheMiddleware.cache(600),
  categoryController.getFeaturedCategories
);

router.get('/:slug', categoryController.getCategoryBySlug);

// Admin routes
router.post(
  '/',
  authMiddleware.authenticate,
  authMiddleware.authorize('admin'),
  uploadMiddleware.single('image'),
  [
    body('name').trim().notEmpty().withMessage('Category name is required'),
    body('description').optional().trim(),
    body('parent').optional().isMongoId(),
    validate,
  ],
  categoryController.createCategory
);

router.put(
  '/:id',
  authMiddleware.authenticate,
  authMiddleware.authorize('admin'),
  uploadMiddleware.single('image'),
  categoryController.updateCategory
);

router.delete(
  '/:id',
  authMiddleware.authenticate,
  authMiddleware.authorize('admin'),
  categoryController.deleteCategory
);

router.post(
  '/reorder',
  authMiddleware.authenticate,
  authMiddleware.authorize('admin'),
  categoryController.reorderCategories
);

module.exports = router;