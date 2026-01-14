const Review = require('../models/Review');
const Product = require('../models/Product');
const Order = require('../models/Order');
const logger = require('../utils/logger');
const { uploadMultipleImages } = require('../config/cloudinary');

class ReviewController {
  // Create review
  async createReview(req, res) {
    const { productId, rating, title, comment, orderId } = req.body;

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    // Check if user already reviewed this product
    const existingReview = await Review.findOne({
      product: productId,
      user: req.user._id,
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this product',
      });
    }

    // Verify purchase if orderId provided
    let isVerifiedPurchase = false;
    if (orderId) {
      const order = await Order.findOne({
        _id: orderId,
        user: req.user._id,
        status: 'delivered',
        'items.product': productId,
      });

      if (order) {
        isVerifiedPurchase = true;
      }
    }

    const reviewData = {
      product: productId,
      user: req.user._id,
      rating,
      title,
      comment,
      order: orderId,
      isVerifiedPurchase,
    };

    // Handle image uploads
    if (req.files && req.files.length > 0) {
      const uploadedImages = await uploadMultipleImages(req.files, 'reviews');
      reviewData.images = uploadedImages.map(img => ({
        url: img.url,
        publicId: img.publicId,
      }));
    }

    const review = await Review.create(reviewData);

    await review.populate([
      { path: 'user', select: 'firstName lastName avatar' },
      { path: 'product', select: 'name slug' },
    ]);

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      data: { review },
    });
  }

  // Get reviews for a product
  async getProductReviews(req, res) {
    const { productId } = req.params;
    const { page = 1, limit = 10, sort = '-createdAt', rating } = req.query;

    const query = {
      product: productId,
      status: 'approved',
    };

    if (rating) {
      query.rating = parseInt(rating);
    }

    const skip = (page - 1) * limit;

    const reviews = await Review.find(query)
      .populate('user', 'firstName lastName avatar')
      .sort(sort)
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    const total = await Review.countDocuments(query);

    // Get rating distribution
    const ratingStats = await Review.aggregate([
      { $match: { product: productId, status: 'approved' } },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } },
    ]);

    res.json({
      success: true,
      data: {
        reviews,
        ratingStats,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  }

  // Get user's reviews
  async getUserReviews(req, res) {
    const { page = 1, limit = 10 } = req.query;

    const skip = (page - 1) * limit;

    const reviews = await Review.find({ user: req.user._id })
      .populate('product', 'name slug images')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    const total = await Review.countDocuments({ user: req.user._id });

    res.json({
      success: true,
      data: {
        reviews,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  }

  // Update review
  async updateReview(req, res) {
    const { id } = req.params;
    const { rating, title, comment } = req.body;

    const review = await Review.findById(id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found',
      });
    }

    if (review.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this review',
      });
    }

    review.rating = rating;
    review.title = title;
    review.comment = comment;
    review.isEdited = true;
    review.status = 'pending'; // Re-submit for approval

    await review.save();

    res.json({
      success: true,
      message: 'Review updated successfully',
      data: { review },
    });
  }

  // Delete review
  async deleteReview(req, res) {
    const { id } = req.params;

    const review = await Review.findById(id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found',
      });
    }

    if (
      review.user.toString() !== req.user._id.toString() &&
      req.user.role !== 'admin'
    ) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this review',
      });
    }

    await review.deleteOne();

    res.json({
      success: true,
      message: 'Review deleted successfully',
    });
  }

  // Vote helpful/unhelpful
  async voteReview(req, res) {
    const { id } = req.params;
    const { vote } = req.body; // 'up' or 'down'

    if (!['up', 'down'].includes(vote)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid vote type',
      });
    }

    const review = await Review.findById(id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found',
      });
    }

    await review.addHelpfulVote(req.user._id, vote);

    res.json({
      success: true,
      message: 'Vote recorded',
      data: { helpful: review.helpful },
    });
  }

  // Respond to review (Seller/Admin)
  async respondToReview(req, res) {
    const { id } = req.params;
    const { comment } = req.body;

    const review = await Review.findById(id).populate('product');

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found',
      });
    }

    // Check if user is seller of the product or admin
    if (
      req.user.role !== 'admin' &&
      review.product.seller.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to respond to this review',
      });
    }

    review.response = {
      comment,
      respondedAt: new Date(),
      respondedBy: req.user._id,
    };

    await review.save();

    res.json({
      success: true,
      message: 'Response added successfully',
      data: { review },
    });
  }

  // Approve review (Admin)
  async approveReview(req, res) {
    const { id } = req.params;

    const review = await Review.findById(id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found',
      });
    }

    review.status = 'approved';
    await review.save();

    res.json({
      success: true,
      message: 'Review approved',
      data: { review },
    });
  }

  // Reject review (Admin)
  async rejectReview(req, res) {
    const { id } = req.params;

    const review = await Review.findById(id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found',
      });
    }

    review.status = 'rejected';
    await review.save();

    res.json({
      success: true,
      message: 'Review rejected',
      data: { review },
    });
  }
}

module.exports = new ReviewController();