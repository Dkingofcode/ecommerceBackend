class Validators {
  // Validate credit card (basic Luhn algorithm)
  validateCreditCard(cardNumber) {
    const digits = cardNumber.replace(/\D/g, '');

    if (digits.length < 13 || digits.length > 19) {
      return false;
    }

    let sum = 0;
    let isEven = false;

    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = parseInt(digits[i]);

      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }

      sum += digit;
      isEven = !isEven;
    }

    return sum % 10 === 0;
  }

  // Validate CVV
  validateCVV(cvv) {
    return /^\d{3,4}$/.test(cvv);
  }

  // Validate expiry date
  validateExpiryDate(month, year) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const expMonth = parseInt(month);
    const expYear = parseInt(year);

    if (expMonth < 1 || expMonth > 12) {
      return false;
    }

    if (expYear < currentYear) {
      return false;
    }

    if (expYear === currentYear && expMonth < currentMonth) {
      return false;
    }

    return true;
  }

  // Validate ZIP code
  validateZipCode(zipCode, country = 'US') {
    const patterns = {
      US: /^\d{5}(-\d{4})?$/,
      UK: /^[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}$/i,
      CA: /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i,
    };

    const pattern = patterns[country] || patterns.US;
    return pattern.test(zipCode);
  }

  // Validate password strength
  validatePasswordStrength(password) {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    const score = [
      password.length >= minLength,
      hasUpperCase,
      hasLowerCase,
      hasNumbers,
      hasSpecialChar,
    ].filter(Boolean).length;

    return {
      isValid: score >= 4,
      score,
      strength: score < 3 ? 'weak' : score < 4 ? 'medium' : 'strong',
      feedback: {
        minLength: password.length >= minLength,
        hasUpperCase,
        hasLowerCase,
        hasNumbers,
        hasSpecialChar,
      },
    };
  }

  // Validate URL
  validateURL(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  // Validate SKU format
  validateSKU(sku) {
    // Format: PREFIX-TIMESTAMP-RANDOM (e.g., PRD-1234567890-ABC12)
    return /^[A-Z]{3}-[A-Z0-9]+-[A-Z0-9]+$/.test(sku);
  }

  // Validate product price
  validatePrice(price, minPrice = 0, maxPrice = 1000000) {
    const numPrice = parseFloat(price);
    return (
      !isNaN(numPrice) &&
      numPrice >= minPrice &&
      numPrice <= maxPrice &&
      numPrice.toFixed(2) === price.toString()
    );
  }

  // Validate stock quantity
  validateStockQuantity(quantity) {
    return Number.isInteger(quantity) && quantity >= 0;
  }

  // Validate date range
  validateDateRange(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return false;
    }

    return start <= end;
  }

  // Validate image dimensions
  validateImageDimensions(width, height, minWidth = 100, minHeight = 100) {
    return width >= minWidth && height >= minHeight;
  }

  // Validate file size
  validateFileSize(fileSize, maxSize = 5242880) {
    // 5MB default
    return fileSize > 0 && fileSize <= maxSize;
  }

  // Validate coordinates (lat/lng)
  validateCoordinates(lat, lng) {
    return (
      typeof lat === 'number' &&
      typeof lng === 'number' &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    );
  }
}

module.exports = new Validators();