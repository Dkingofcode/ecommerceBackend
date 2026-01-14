const morgan = require('morgan');
const logger = require('../utils/logger');

// Custom token for response time in ms
morgan.token('response-time-ms', (req, res) => {
  if (!req._startAt || !res._startAt) {
    return '';
  }
  const ms = (res._startAt[0] - req._startAt[0]) * 1e3 +
    (res._startAt[1] - req._startAt[1]) * 1e-6;
  return ms.toFixed(3);
});

// Stream to Winston logger
const stream = {
  write: (message) => {
    logger.info(message.trim());
  },
};

// Morgan format
const morganFormat = process.env.NODE_ENV === 'production'
  ? ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" :response-time-ms ms'
  : ':method :url :status :response-time-ms ms - :res[content-length]';

const requestLogger = morgan(morganFormat, { stream });

module.exports = requestLogger;