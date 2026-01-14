const express = require('express');
const compression = require('compression');
const cookieParser = require('cookie-parser');
require('express-async-errors');

// Middleware
const corsMiddleware = require('./middleware/cors');
const securityHeaders = require('./middleware/security');
const requestLogger = require('./middleware/logger');
const { sanitizeData, preventHPP } = require('./middleware/sanitize');
const { generalLimiter } = require('./middleware/rateLimit');
const { notFound, errorHandler } = require('./middleware/error');

// Routes
const routes = require('./routes');

const app = express();

// Trust proxy
app.set('trust proxy', 1);

// Security middleware
app.use(securityHeaders);
app.use(corsMiddleware);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser(process.env.COOKIE_SECRET));

// Compression
app.use(compression());

// Request logging
if (process.env.NODE_ENV !== 'test') {
  app.use(requestLogger);
}

// Sanitize data
app.use(sanitizeData);
app.use(preventHPP);

// Rate limiting
if (process.env.ENABLE_RATE_LIMITING === 'true') {
  app.use('/api/', generalLimiter);
}

// API routes
app.use('/api/v1', routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'E-Commerce API',
    version: '1.0.0',
    documentation: `${process.env.BASE_URL}/api/docs`,
    endpoints: {
      auth: '/api/v1/auth',
      users: '/api/v1/users',
      products: '/api/v1/products',
      categories: '/api/v1/categories',
      cart: '/api/v1/cart',
      orders: '/api/v1/orders',
      reviews: '/api/v1/reviews',
      wishlist: '/api/v1/wishlist',
      payments: '/api/v1/payments',
      admin: '/api/v1/admin',
    },
  });
});

// Swagger documentation (if enabled)
if (process.env.ENABLE_SWAGGER === 'true') {
  const swaggerUi = require('swagger-ui-express');
  const swaggerDocument = require('./docs/swagger.json');

  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'E-Commerce API Documentation',
  }));
}

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

module.exports = app;