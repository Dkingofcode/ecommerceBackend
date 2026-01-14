const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');

// Sanitize data to prevent NoSQL injection
const sanitizeData = mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    console.warn(`Sanitized key: ${key} in ${req.originalUrl}`);
  },
});

// Prevent HTTP Parameter Pollution
const preventHPP = hpp({
  whitelist: [
    'sort',
    'page',
    'limit',
    'fields',
    'rating',
    'price',
    'category',
    'tags',
  ],
});

module.exports = {
  sanitizeData,
  preventHPP,
};