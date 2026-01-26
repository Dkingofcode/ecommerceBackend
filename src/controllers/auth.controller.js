const User = require('../models/User');
const crypto = require('crypto');
const logger = require('../utils/logger');
//const emailService = require('../utils/email.service');
const emailService = require('../utils/email');

class AuthController {
  // Register new user

async register(req, res) {
  const { email, firstName, lastName, password } = req.body;

  const user = await User.create({ email, firstName, lastName, password });

  // Generate raw token
  const verificationToken = crypto.randomBytes(32).toString('hex');

  // Hash token before saving in DB
  user.emailVerificationToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');
  
  user.emailVerificationExpires = Date.now() + 60 * 60 * 1000; // 1 hour
  await user.save();

  // ✅ Send email using the service
  await emailService.sendVerificationEmail(email, firstName, verificationToken);

  res.status(201).json({
    success: true,
    message: 'Registration successful. Check your email to verify your account.',
  });
}

async registerAdmin(req, res) {
  const { email, firstName, lastName, password } = req.body;

  const user = await User.create({
    email,
    firstName,
    lastName,
    password,
    role: 'admin', // ✅ explicitly set
  });

  res.status(201).json({
    success: true,
    message: 'Admin created successfully',
    data: {
      user
    }
  });
}


async registerSeller(req, res) {
  const { email, firstName, lastName, password } = req.body;

  const user = await User.create({
    email,
    firstName,
    lastName,
    password,
    role: 'seller', // ✅ explicitly set
  });

  res.status(201).json({
    success: true,    
    message: 'Seller created successfully',
    data: {
      user
    }
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

  async verifyEmail(req, res) {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Token is required' });
    }

    // Decode token (in case it was URL encoded)
    const decodedToken = decodeURIComponent(token);

    // Hash the token
    const hashedToken = crypto
      .createHash('sha256')
      .update(decodedToken)
      .digest('hex');

    // Find user by hashed token and check expiry
    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token',
      });
    }

    // Mark email as verified
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Email verified successfully',
    });
  } catch (err) {
    console.error('Verify email error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
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