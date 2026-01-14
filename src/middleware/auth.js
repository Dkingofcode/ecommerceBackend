const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

class AuthMiddleware {
  // Authenticate user
  authenticate = async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          message: 'Access token required',
        });
      }

      const token = authHeader.split(' ')[1];

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findById(decoded.id);

        if (!user) {
          return res.status(401).json({
            success: false,
            message: 'User not found',
          });
        }

        if (!user.isActive) {
          return res.status(403).json({
            success: false,
            message: 'Account is inactive',
          });
        }

        req.user = user;
        next();
      } catch (error) {
        if (error.name === 'TokenExpiredError') {
          return res.status(401).json({
            success: false,
            message: 'Token expired',
          });
        }

        return res.status(401).json({
          success: false,
          message: 'Invalid token',
        });
      }
    } catch (error) {
      logger.error('Auth middleware error:', error);
      return res.status(500).json({
        success: false,
        message: 'Authentication error',
      });
    }
  };

  // Authorize by role
  authorize = (...roles) => {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      if (!roles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions',
        });
      }

      next();
    };
  };

  // Optional authentication (doesn't fail if no token)
  optionalAuth = async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;

      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];

        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          const user = await User.findById(decoded.id);

          if (user && user.isActive) {
            req.user = user;
          }
        } catch (error) {
          // Silent fail for optional auth
        }
      }

      next();
    } catch (error) {
      next();
    }
  };
}

module.exports = new AuthMiddleware();