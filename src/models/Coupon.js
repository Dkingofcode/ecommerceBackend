const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
  },
  description: {
    type: String,
    maxlength: 500,
  },
  type: {
    type: String,
    enum: ['percentage', 'fixed'],
    required: true,
  },
  value: {
    type: Number,
    required: true,
    min: 0,
  },
  
  // Conditions
  minimumPurchase: {
    type: Number,
    default: 0,
    min: 0,
  },
  maximumDiscount: {
    type: Number,
    min: 0,
  },
  
  // Usage limits
  usageLimit: {
    type: Number,
    min: 1,
  },
  usageLimitPerUser: {
    type: Number,
    min: 1,
    default: 1,
  },
  usageCount: {
    type: Number,
    default: 0,
  },
  
  // Users who have used this coupon
  usedBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    count: {
      type: Number,
      default: 1,
    },
    lastUsedAt: Date,
  }],
  
  // Validity
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    required: true,
  },
  
  // Restrictions
  applicableProducts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
  }],
  applicableCategories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
  }],
  excludedProducts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
  }],
  
  // First-time users only
  firstTimeOnly: {
    type: Boolean,
    default: false,
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true,
  },
  
  // Creator
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

// Indexes
couponSchema.index({ code: 1 });
couponSchema.index({ isActive: 1, startDate: 1, endDate: 1 });

// Check if coupon is valid
couponSchema.methods.isValid = function() {
  const now = new Date();
  
  if (!this.isActive) return false;
  if (now < this.startDate) return false;
  if (now > this.endDate) return false;
  if (this.usageLimit && this.usageCount >= this.usageLimit) return false;
  
  return true;
};

// Check if user can use coupon
couponSchema.methods.canBeUsedBy = function(userId) {
  if (!this.isValid()) return false;
  
  const userUsage = this.usedBy.find(u => u.user.toString() === userId.toString());
  
  if (userUsage && userUsage.count >= this.usageLimitPerUser) {
    return false;
  }
  
  return true;
};

// Calculate discount
couponSchema.methods.calculateDiscount = function(subtotal) {
  if (subtotal < this.minimumPurchase) {
    return 0;
  }
  
  let discount = 0;
  
  if (this.type === 'percentage') {
    discount = (subtotal * this.value) / 100;
    if (this.maximumDiscount) {
      discount = Math.min(discount, this.maximumDiscount);
    }
  } else {
    discount = this.value;
  }
  
  return Math.min(discount, subtotal);
};

// Record usage
couponSchema.methods.recordUsage = async function(userId) {
  const userUsage = this.usedBy.find(u => u.user.toString() === userId.toString());
  
  if (userUsage) {
    userUsage.count += 1;
    userUsage.lastUsedAt = new Date();
  } else {
    this.usedBy.push({
      user: userId,
      count: 1,
      lastUsedAt: new Date(),
    });
  }
  
  this.usageCount += 1;
  return this.save();
};

module.exports = mongoose.model('Coupon', couponSchema);