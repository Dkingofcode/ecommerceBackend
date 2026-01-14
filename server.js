require('dotenv').config();
require('express-async-errors');
const http = require('http');
const app = require('./src/app');
const connectDB = require('./src/config/db');
const logger = require('./src/utils/logger');

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Connect to database
    await connectDB();

    // Create HTTP server
    const server = http.createServer(app);

    // Socket.IO (if enabled)
    if (process.env.ENABLE_SOCKET === 'true') {
      const io = require('socket.io')(server, {
        cors: {
          origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
          credentials: true,
        },
      });

      io.on('connection', (socket) => {
        logger.info(`Socket connected: ${socket.id}`);

        socket.on('disconnect', () => {
          logger.info(`Socket disconnected: ${socket.id}`);
        });
      });

      // Attach io to app for use in controllers
      app.set('io', io);
    }

    // Start server
    server.listen(PORT, () => {
      logger.info(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║  🚀 E-COMMERCE BACKEND API IS RUNNING!                       ║
║                                                               ║
║  📍 Server:        http://localhost:${PORT}                       ║
║  📚 API Docs:      http://localhost:${PORT}/api/docs              ║
║  🔧 Environment:   ${process.env.NODE_ENV}                            ║
║  💾 Database:      MongoDB Connected                          ║
║  📦 Version:       ${process.env.API_VERSION || 'v1'}                             ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
      `);
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal) => {
      logger.info(`${signal} received. Starting graceful shutdown...`);

      server.close(async () => {
        logger.info('HTTP server closed');

        try {
          await require('mongoose').connection.close();
          logger.info('MongoDB connection closed');

          if (process.env.REDIS_ENABLED === 'true') {
            const redis = require('./src/config/redis');
            await redis.quit();
            logger.info('Redis connection closed');
          }

          logger.info('Graceful shutdown completed');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown:', error);
          process.exit(1);
        }
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      gracefulShutdown('UNCAUGHT_EXCEPTION');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (error) => {
      logger.error('Unhandled Rejection:', error);
      gracefulShutdown('UNHANDLED_REJECTION');
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();