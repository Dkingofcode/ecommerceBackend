const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1,
  },
  variant: {
    name: String,
    value: String,
  },
  price: {
    type: Number,
    required: true,
  },
  addedAt: {
    type: Date,
    default: Date.now,
  },
});

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  items: [cartItemSchema],
  
  // Session cart for guests (optional)
  sessionId: {
    type: String,
    sparse: true,
  },
  
  // Applied coupon
  coupon: {
    code: String,
    discount: Number,
    type: {
      type: String,
      enum: ['percentage', 'fixed'],
    },
  },
  
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Index
cartSchema.index({ user: 1 });
cartSchema.index({ sessionId: 1 }, { sparse: true });
cartSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

// Virtual for subtotal
cartSchema.virtual('subtotal').get(function() {
  return this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
});

// Virtual for total items
cartSchema.virtual('totalItems').get(function() {
  return this.items.reduce((sum, item) => sum + item.quantity, 0);
});

// Virtual for discount amount
cartSchema.virtual('discountAmount').get(function() {
  if (!this.coupon) return 0;
  
  if (this.coupon.type === 'percentage') {
    return (this.subtotal * this.coupon.discount) / 100;
  }
  return this.coupon.discount;
});

// Virtual for total
cartSchema.virtual('total').get(function() {
  return Math.max(0, this.subtotal - this.discountAmount);
});

// Add item to cart
cartSchema.methods.addItem = async function(productId, quantity = 1, variant = null, price) {
  const existingItem = this.items.find(item => {
    if (variant) {
      return item.product.toString() === productId.toString() &&
             item.variant?.value === variant.value;
    }
    return item.product.toString() === productId.toString();
  });
  
  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    this.items.push({
      product: productId,
      quantity,
      variant,
      price,
    });
  }
  
  return this.save();
};

// Update item quantity
cartSchema.methods.updateItemQuantity = async function(productId, quantity, variant = null) {
  const item = this.items.find(item => {
    if (variant) {
      return item.product.toString() === productId.toString() &&
             item.variant?.value === variant.value;
    }
    return item.product.toString() === productId.toString();
  });
  
  if (!item) {
    throw new Error('Item not found in cart');
  }
  
  if (quantity <= 0) {
    this.items = this.items.filter(i => i !== item);
  } else {
    item.quantity = quantity;
  }
  
  return this.save();
};

// Remove item from cart
cartSchema.methods.removeItem = async function(productId, variant = null) {
  this.items = this.items.filter(item => {
    if (variant) {
      return !(item.product.toString() === productId.toString() &&
               item.variant?.value === variant.value);
    }
    return item.product.toString() !== productId.toString();
  });
  
  return this.save();
};

// Clear cart
cartSchema.methods.clearCart = async function() {
  this.items = [];
  this.coupon = undefined;
  return this.save();
};

// Apply coupon
cartSchema.methods.applyCoupon = async function(code, discount, type) {
  this.coupon = { code, discount, type };
  return this.save();
};

// Remove coupon
cartSchema.methods.removeCoupon = async function() {
  this.coupon = undefined;
  return this.save();
};

module.exports = mongoose.model('Cart', cartSchema);