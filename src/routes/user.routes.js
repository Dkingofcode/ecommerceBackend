const express = require('express');
const { body } = require('express-validator');
const userController = require('../controllers/user.controller');
const authMiddleware = require('../middleware/auth');
const uploadMiddleware = require('../middleware/upload');
const validate = require('../middleware/validation');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware.authenticate);

// Profile
router.get('/profile', userController.getProfile);
router.put(
  '/profile',
  [
    body('firstName').optional().trim().notEmpty(),
    body('lastName').optional().trim().notEmpty(),
    body('phone').optional().trim(),
    validate,
  ],
  userController.updateProfile
);

// Avatar
router.post(
  '/avatar',
  uploadMiddleware.single('avatar'),
  userController.uploadAvatar
);
router.delete('/avatar', userController.deleteAvatar);

// Addresses
router.get('/addresses', userController.getAddresses);
router.post(
  '/addresses',
  [
    body('firstName').trim().notEmpty(),
    body('lastName').trim().notEmpty(),
    body('address').trim().notEmpty(),
    body('city').trim().notEmpty(),
    body('state').trim().notEmpty(),
    body('country').trim().notEmpty(),
    body('zipCode').trim().notEmpty(),
    body('phone').trim().notEmpty(),
    validate,
  ],
  userController.addAddress
);
router.put('/addresses/:id', userController.updateAddress);
router.delete('/addresses/:id', userController.deleteAddress);
router.patch('/addresses/:id/default', userController.setDefaultAddress);

// Order history
router.get('/orders', userController.getOrderHistory);

// Delete account
router.delete(
  '/account',
  [body('password').notEmpty(), validate],
  userController.deleteAccount
);

module.exports = router;