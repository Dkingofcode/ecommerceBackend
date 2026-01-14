const mongoose = require('mongoose');

const wishlistSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
    note: {
      type: String,
      maxlength: 200,
    },
  }],
}, {
  timestamps: true,
});

// Index
wishlistSchema.index({ user: 1 });
wishlistSchema.index({ 'items.product': 1 });

// Add item to wishlist
wishlistSchema.methods.addItem = async function(productId, note = '') {
  const exists = this.items.some(item => item.product.toString() === productId.toString());
  
  if (exists) {
    throw new Error('Product already in wishlist');
  }
  
  this.items.push({ product: productId, note });
  return this.save();
};

// Remove item from wishlist
wishlistSchema.methods.removeItem = async function(productId) {
  this.items = this.items.filter(item => item.product.toString() !== productId.toString());
  return this.save();
};

// Check if product is in wishlist
wishlistSchema.methods.hasProduct = function(productId) {
  return this.items.some(item => item.product.toString() === productId.toString());
};

// Clear wishlist
wishlistSchema.methods.clearWishlist = async function() {
  this.items = [];
  return this.save();
};

module.exports = mongoose.model('Wishlist', wishlistSchema);