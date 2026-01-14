const User = require('../models/User');
const crypto = require('crypto');
const logger = require('../utils/logger');
const emailService = require('../utils/email.service');

class AuthController {
  // Register new user
  async register(req, res) {
    const { firstName, lastName, email, password, phone } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered',
      });
    }

    // Create user
    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      phone,
    });

    // Generate email verification token
    const verificationToken = user.generateEmailVerificationToken();
    await user.save();

    // Send verification email
    if (process.env.ENABLE_EMAIL === 'true') {
      try {
        await emailService.sendVerificationEmail(
          email,
          firstName,
          verificationToken
        );
      } catch (error) {
        logger.error('Email sending failed:', error);
      }
    }

    // Generate tokens
    const accessToken = user.generateAuthToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save();

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please verify your email.',
      data: {
        user,
        accessToken,
        refreshToken,
      },
    });
  }

  // Login user
  async login(req, res) {
    const { email, password } = req.body;

    // Find user with password field
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Check if account is locked
    if (user.isLocked) {
      return res.status(423).json({
        success: false,
        message: 'Account is locked due to multiple failed login attempts. Try again later.',
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is inactive. Please contact support.',
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      await user.incLoginAttempts();
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Reset login attempts on successful login
    await user.resetLoginAttempts();

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate tokens
    const accessToken = user.generateAuthToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save();

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user,
        accessToken,
        refreshToken,
      },
    });
  }

  // Verify email
  async verifyEmail(req, res) {
    const { token } = req.body;

    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token',
      });
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Email verified successfully',
    });
  }

  // Resend verification email
  async resendVerification(req, res) {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email already verified',
      });
    }

    const verificationToken = user.generateEmailVerificationToken();
    await user.save();

    if (process.env.ENABLE_EMAIL === 'true') {
      await emailService.sendVerificationEmail(
        email,
        user.firstName,
        verificationToken
      );
    }

    res.json({
      success: true,
      message: 'Verification email sent',
    });
  }

  // Forgot password
  async forgotPassword(req, res) {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if user exists
      return res.json({
        success: true,
        message: 'If the email exists, a reset link has been sent',
      });
    }

    const resetToken = user.generatePasswordResetToken();
    await user.save();

    if (process.env.ENABLE_EMAIL === 'true') {
      await emailService.sendPasswordResetEmail(
        email,
        user.firstName,
        resetToken
      );
    }

    res.json({
      success: true,
      message: 'If the email exists, a reset link has been sent',
    });
  }

  // Reset password
  async resetPassword(req, res) {
    const { token, newPassword } = req.body;

    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token',
      });
    }

    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.refreshToken = undefined; // Invalidate all sessions
    await user.save();

    res.json({
      success: true,
      message: 'Password reset successful',
    });
  }

  // Refresh token
  async refreshToken(req, res) {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token required',
      });
    }

    try {
      const decoded = require('jsonwebtoken').verify(
        refreshToken,
        process.env.JWT_REFRESH_SECRET
      );

      const user = await User.findById(decoded.id);
      if (!user || user.refreshToken !== refreshToken) {
        return res.status(401).json({
          success: false,
          message: 'Invalid refresh token',
        });
      }

      const newAccessToken = user.generateAuthToken();
      const newRefreshToken = user.generateRefreshToken();

      user.refreshToken = newRefreshToken;
      await user.save();

      res.json({
        success: true,
        data: {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
        },
      });
    } catch (error) {
      res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token',
      });
    }
  }

  // Logout
  async logout(req, res) {
    const user = req.user;

    user.refreshToken = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Logout successful',
    });
  }

  // Get current user
  async getMe(req, res) {
    const user = await User.findById(req.user._id)
      .populate('addresses')
      .populate({
        path: 'orders',
        options: { limit: 5, sort: { createdAt: -1 } },
      });

    res.json({
      success: true,
      data: { user },
    });
  }

  // Change password
  async changePassword(req, res) {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select('+password');

    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    user.password = newPassword;
    user.refreshToken = undefined; // Invalidate all sessions
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  }
}

module.exports = new AuthController();