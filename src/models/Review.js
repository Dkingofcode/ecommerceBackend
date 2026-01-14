const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
  },
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: 1,
    max: 5,
  },
  title: {
    type: String,
    trim: true,
    maxlength: 100,
  },
  comment: {
    type: String,
    required: [true, 'Review comment is required'],
    trim: true,
    maxlength: 1000,
  },
  images: [{
    url: String,
    publicId: String,
  }],
  
  // Helpful votes
  helpful: {
    type: Number,
    default: 0,
  },
  helpfulVotes: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    vote: {
      type: String,
      enum: ['up', 'down'],
    },
  }],
  
  // Verification
  isVerifiedPurchase: {
    type: Boolean,
    default: false,
  },
  
  // Status
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  
  // Seller Response
  response: {
    comment: String,
    respondedAt: Date,
    respondedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  
  // Flags
  isFeatured: {
    type: Boolean,
    default: false,
  },
  isEdited: {
    type: Boolean,
    default: false,
  },
  
}, {
  timestamps: true,
});

// Indexes
reviewSchema.index({ product: 1, user: 1 }, { unique: true });
reviewSchema.index({ product: 1, status: 1, rating: -1 });
reviewSchema.index({ user: 1 });

// Update product rating after save
reviewSchema.post('save', async function() {
  await this.updateProductRating();
});

// Update product rating after remove
reviewSchema.post('remove', async function() {
  await this.updateProductRating();
});

// Update product rating
reviewSchema.methods.updateProductRating = async function() {
  const Product = mongoose.model('Product');
  
  const stats = await this.constructor.aggregate([
    {
      $match: {
        product: this.product,
        status: 'approved',
      },
    },
    {
      $group: {
        _id: '$product',
        averageRating: { $avg: '$rating' },
        count: { $sum: 1 },
      },
    },
  ]);
  
  if (stats.length > 0) {
    await Product.findByIdAndUpdate(this.product, {
      'ratings.average': Math.round(stats[0].averageRating * 10) / 10,
      'ratings.count': stats[0].count,
    });
  } else {
    await Product.findByIdAndUpdate(this.product, {
      'ratings.average': 0,
      'ratings.count': 0,
    });
  }
};

// Vote helpful/unhelpful
reviewSchema.methods.addHelpfulVote = async function(userId, vote) {
  const existingVote = this.helpfulVotes.find(v => v.user.toString() === userId.toString());
  
  if (existingVote) {
    if (existingVote.vote === vote) {
      // Remove vote
      this.helpfulVotes = this.helpfulVotes.filter(v => v.user.toString() !== userId.toString());
      this.helpful += vote === 'up' ? -1 : 1;
    } else {
      // Change vote
      existingVote.vote = vote;
      this.helpful += vote === 'up' ? 2 : -2;
    }
  } else {
    // New vote
    this.helpfulVotes.push({ user: userId, vote });
    this.helpful += vote === 'up' ? 1 : -1;
  }
  
  return this.save();
};

module.exports = mongoose.model('Review', reviewSchema);