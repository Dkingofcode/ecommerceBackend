const crypto = require('crypto');

class Helpers {
  // Generate random string
  generateRandomString(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  // Generate OTP
  generateOTP(length = 6) {
    return Math.floor(
      Math.pow(10, length - 1) + Math.random() * 9 * Math.pow(10, length - 1)
    ).toString();
  }

  // Hash string (for tokens)
  hashString(string) {
    return crypto.createHash('sha256').update(string).digest('hex');
  }

  // Generate slug from string
  generateSlug(string) {
    return string
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // Calculate discount
  calculateDiscount(price, discountPercentage) {
    return price - (price * discountPercentage) / 100;
  }

  // Calculate tax
  calculateTax(amount, taxRate) {
    return amount * taxRate;
  }

  // Format price
  formatPrice(amount, currency = 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  }

  // Format date
  formatDate(date, locale = 'en-US') {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(date));
  }

  // Truncate text
  truncate(text, maxLength = 100, suffix = '...') {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - suffix.length) + suffix;
  }

  // Pagination helper
  getPagination(page, limit, total) {
    const currentPage = parseInt(page) || 1;
    const itemsPerPage = parseInt(limit) || 20;
    const totalPages = Math.ceil(total / itemsPerPage);
    const skip = (currentPage - 1) * itemsPerPage;

    return {
      page: currentPage,
      limit: itemsPerPage,
      total,
      pages: totalPages,
      hasNext: currentPage < totalPages,
      hasPrev: currentPage > 1,
      skip,
    };
  }

  // Calculate reading time
  calculateReadingTime(text, wordsPerMinute = 200) {
    const wordCount = text.trim().split(/\s+/).length;
    const minutes = Math.ceil(wordCount / wordsPerMinute);
    return minutes;
  }

  // Generate SKU
  generateSKU(prefix = 'PRD') {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }

  // Calculate shipping cost
  calculateShippingCost(weight, distance, method = 'standard') {
    const baseRate = 5;
    const weightRate = 0.5; // per kg
    const distanceRate = 0.01; // per km

    let cost = baseRate + (weight * weightRate) + (distance * distanceRate);

    if (method === 'express') {
      cost *= 2;
    } else if (method === 'overnight') {
      cost *= 3;
    }

    return Math.round(cost * 100) / 100;
  }

  // Validate email
  isValidEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  }

  // Validate phone
  isValidPhone(phone) {
    const regex = /^[\d\s\-\+\(\)]+$/;
    return regex.test(phone) && phone.replace(/\D/g, '').length >= 10;
  }

  // Generate order number
  generateOrderNumber() {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0');
    return `ORD-${timestamp}${random}`;
  }

  // Calculate stock availability
  isInStock(quantity, reserved, requested) {
    return quantity - reserved >= requested;
  }

  // Deep clone object
  deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  // Remove undefined/null values from object
  removeEmpty(obj) {
    return Object.fromEntries(
      Object.entries(obj).filter(([_, v]) => v != null)
    );
  }

  // Sleep/delay function
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Retry async function
  async retry(fn, maxAttempts = 3, delay = 1000) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === maxAttempts) throw error;
        await this.sleep(delay * attempt);
      }
    }
  }

  // Generate color from string (for avatars)
  stringToColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const color = Math.floor(
      Math.abs((Math.sin(hash) * 16777215) % 16777215)
    ).toString(16);
    return '#' + '0'.repeat(6 - color.length) + color;
  }

  // Get initials from name
  getInitials(name) {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }
}

module.exports = new Helpers();