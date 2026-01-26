const express = require('express');
const { body, query } = require('express-validator');
const productController = require('../controllers/product.controller');
const authMiddleware = require('../middleware/auth');
const uploadMiddleware = require('../middleware/upload');
const validate = require('../middleware/validation');
const cacheMiddleware = require('../middleware/cache');

const router = express.Router();

// Public routes
router.get(
  '/',
  cacheMiddleware.cache(300), // Cache for 5 minutes
  productController.getAllProducts
);

router.get(
  '/featured',
  cacheMiddleware.cache(600),
  productController.getFeaturedProducts
);

router.get(
  '/search',
  [query('q').notEmpty(), validate],
  productController.searchProducts
);

router.get(
  '/category/:categorySlug',
  cacheMiddleware.cache(300),
  productController.getProductsByCategory
);

router.get('/:slug', productController.getProductBySlug);

router.get('/:id/related', productController.getRelatedProducts);

// Protected routes (Seller/Admin)
router.post(
  '/',
  authMiddleware.authenticate,
  authMiddleware.authorize('seller', 'admin'),
  uploadMiddleware.array('images', 10),
  [
    body('name').trim().notEmpty().withMessage('Product name is required'),
    body('description').trim().notEmpty(),
    body('price').isFloat({ min: 0 }),
    body('category').notEmpty(),
    body('sku').trim().notEmpty(),
    body('stockQuantity').isInt({ min: 0 }),
    validate,
  ],
  productController.createProduct
);

router.put(
  '/:id',
  authMiddleware.authenticate,
  authMiddleware.authorize('seller', 'admin'),
  uploadMiddleware.array('images', 10),
  productController.updateProduct
);

router.delete(
  '/:id',
  authMiddleware.authenticate,
  authMiddleware.authorize('seller', 'admin'),
  productController.deleteProduct
);

module.exports = router;