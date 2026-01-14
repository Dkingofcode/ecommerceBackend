const mongoose = require('mongoose');
const slugify = require('slugify');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: 200,
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true,
  },
  description: {
    type: String,
    required: [true, 'Product description is required'],
    maxlength: 5000,
  },
  shortDescription: {
    type: String,
    maxlength: 500,
  },
  price: {
    type: Number,
    required: [true, 'Product price is required'],
    min: 0,
  },
  comparePrice: {
    type: Number,
    min: 0,
  },
  costPrice: {
    type: Number,
    min: 0,
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Product category is required'],
  },
  subcategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
  },
  brand: {
    type: String,
    trim: true,
  },
  sku: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
  },
  images: [{
    url: {
      type: String,
      required: true,
    },
    publicId: String,
    alt: String,
    isPrimary: {
      type: Boolean,
      default: false,
    },
  }],
  stock: {
    quantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    reserved: {
      type: Number,
      default: 0,
      min: 0,
    },
    lowStockThreshold: {
      type: Number,
      default: 10,
    },
  },
  variants: [{
    name: String, // e.g., "Color", "Size"
    options: [{
      value: String, // e.g., "Red", "Large"
      price: Number,
      stock: Number,
      sku: String,
      image: String,
    }],
  }],
  specifications: [{
    name: String,
    value: String,
  }],
  tags: [String],
  weight: {
    value: Number,
    unit: {
      type: String,
      enum: ['kg', 'g', 'lb', 'oz'],
      default: 'kg',
    },
  },
  dimensions: {
    length: Number,
    width: Number,
    height: Number,
    unit: {
      type: String,
      enum: ['cm', 'inch', 'm'],
      default: 'cm',
    },
  },
  shipping: {
    isFreeShipping: {
      type: Boolean,
      default: false,
    },
    weight: Number,
    length: Number,
    width: Number,
    height: Number,
  },
  seo: {
    metaTitle: String,
    metaDescription: String,
    metaKeywords: [String],
  },
  ratings: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    count: {
      type: Number,
      default: 0,
    },
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'inactive', 'out_of_stock'],
    default: 'draft',
  },
  isFeatured: {
    type: Boolean,
    default: false,
  },
  isPublished: {
    type: Boolean,
    default: false,
  },
  publishedAt: Date,
  sales: {
    type: Number,
    default: 0,
  },
  views: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Indexes
productSchema.index({ name: 'text', description: 'text', tags: 'text' });
productSchema.index({ category: 1, status: 1 });
productSchema.index({ seller: 1, status: 1 });
productSchema.index({ price: 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ slug: 1 });

// Virtual for available stock
productSchema.virtual('availableStock').get(function() {
  return this.stock.quantity - this.stock.reserved;
});

// Virtual for discount percentage
productSchema.virtual('discountPercentage').get(function() {
  if (this.comparePrice && this.comparePrice > this.price) {
    return Math.round(((this.comparePrice - this.price) / this.comparePrice) * 100);
  }
  return 0;
});

// Virtual populate reviews
productSchema.virtual('reviews', {
  ref: 'Review',
  localField: '_id',
  foreignField: 'product',
});

// Generate slug before save
productSchema.pre('save', async function(next) {
  if (this.isModified('name')) {
    this.slug = slugify(this.name, { lower: true, strict: true });
    
    // Ensure unique slug
    const slugExists = await this.constructor.findOne({ slug: this.slug });
    if (slugExists && slugExists._id.toString() !== this._id.toString()) {
      this.slug = `${this.slug}-${Date.now()}`;
    }
  }
  
  // Set publishedAt when status changes to active
  if (this.isModified('status') && this.status === 'active' && !this.publishedAt) {
    this.publishedAt = new Date();
    this.isPublished = true;
  }
  
  next();
});

// Check if product is in stock
productSchema.methods.isInStock = function(quantity = 1) {
  return this.availableStock >= quantity;
};

// Reserve stock
productSchema.methods.reserveStock = async function(quantity) {
  if (!this.isInStock(quantity)) {
    throw new Error('Insufficient stock');
  }
  this.stock.reserved += quantity;
  return this.save();
};

// Release reserved stock
productSchema.methods.releaseStock = async function(quantity) {
  this.stock.reserved = Math.max(0, this.stock.reserved - quantity);
  return this.save();
};

// Deduct stock (after order confirmation)
productSchema.methods.deductStock = async function(quantity) {
  if (this.stock.reserved < quantity) {
    throw new Error('Cannot deduct more than reserved stock');
  }
  this.stock.quantity -= quantity;
  this.stock.reserved -= quantity;
  this.sales += quantity;
  
  // Update status if out of stock
  if (this.stock.quantity <= 0) {
    this.status = 'out_of_stock';
  }
  
  return this.save();
};

// Increment view count
productSchema.methods.incrementViews = async function() {
  this.views += 1;
  return this.save();
};

module.exports = mongoose.model('Product', productSchema);