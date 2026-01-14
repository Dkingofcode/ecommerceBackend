const redis = require('../config/redis');
const logger = require('../utils/logger');

class CacheMiddleware {
  // Cache middleware
  cache = (duration = 3600) => {
    return async (req, res, next) => {
      // Skip caching if Redis is disabled
      if (!redis || process.env.REDIS_ENABLED !== 'true') {
        return next();
      }

      // Skip caching for authenticated requests
      if (req.headers.authorization) {
        return next();
      }

      const key = `cache:${req.originalUrl}`;

      try {
        const cachedData = await redis.get(key);

        if (cachedData) {
          logger.info(`Cache hit: ${key}`);
          return res.json(JSON.parse(cachedData));
        }

        // Store original json method
        const originalJson = res.json.bind(res);

        // Override json method to cache response
        res.json = function (data) {
          redis
            .setex(key, duration, JSON.stringify(data))
            .then(() => {
              logger.info(`Cache set: ${key} (${duration}s)`);
            })
            .catch((error) => {
              logger.error('Cache set error:', error);
            });

          return originalJson(data);
        };

        next();
      } catch (error) {
        logger.error('Cache middleware error:', error);
        next();
      }
    };
  };

  // Clear cache by pattern
  clearCache = async (pattern) => {
    if (!redis || process.env.REDIS_ENABLED !== 'true') {
      return;
    }

    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
        logger.info(`Cache cleared: ${pattern} (${keys.length} keys)`);
      }
    } catch (error) {
      logger.error('Clear cache error:', error);
    }
  };

  // Clear all cache
  clearAllCache = async () => {
    if (!redis || process.env.REDIS_ENABLED !== 'true') {
      return;
    }

    try {
      await redis.flushdb();
      logger.info('All cache cleared');
    } catch (error) {
      logger.error('Clear all cache error:', error);
    }
  };
}

module.exports = new CacheMiddleware();