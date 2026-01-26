const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middleware/auth');
const validate = require('../middleware/validation');

const router = express.Router();

// Register
router.post(
  '/register',
  [
    body('firstName').trim().notEmpty().withMessage('First name is required'),
    body('lastName').trim().notEmpty().withMessage('Last name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters'),
    body('phone').optional().trim(),
    validate,
  ],
  authController.register
);


// Register  Admin
router.post(
  '/register-admin',
  [
    body('firstName').trim().notEmpty().withMessage('First name is required'),
    body('lastName').trim().notEmpty().withMessage('Last name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters'),
    body('phone').optional().trim(),
    validate,
  ],
  authController.registerAdmin
);


// Register
router.post(
  '/register-seller',
  [
    body('firstName').trim().notEmpty().withMessage('First name is required'),
    body('lastName').trim().notEmpty().withMessage('Last name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters'),
    body('phone').optional().trim(),
    validate,
  ],
  authController.registerSeller
);

// Login
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
    validate,
  ],
  authController.login
);

// Verify email
router.post(
  '/verify-email',
  [body('token').notEmpty(), validate],
  authController.verifyEmail
);

// Resend verification email
router.post(
  '/resend-verification',
  [body('email').isEmail().normalizeEmail(), validate],
  authController.resendVerification
);

// Forgot password
router.post(
  '/forgot-password',
  [body('email').isEmail().normalizeEmail(), validate],
  authController.forgotPassword
);

// Reset password
router.post(
  '/reset-password',
  [
    body('token').notEmpty(),
    body('newPassword').isLength({ min: 8 }),
    validate,
  ],
  authController.resetPassword
);

// Refresh token
router.post(
  '/refresh-token',
  [body('refreshToken').notEmpty(), validate],
  authController.refreshToken
);

// Logout (Protected)
router.post('/logout', authMiddleware.authenticate, authController.logout);

// Get current user (Protected)
router.get('/me', authMiddleware.authenticate, authController.getMe);

// Change password (Protected)
router.post(
  '/change-password',
  authMiddleware.authenticate,
  [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 8 }),
    validate,
  ],
  authController.changePassword
);

module.exports = router;