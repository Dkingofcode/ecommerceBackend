const Wishlist = require('../models/Wishlist');
const Product = require('../models/Product');
const logger = require('../utils/logger');

class WishlistController {
  // Get user's wishlist
  async getWishlist(req, res) {
    let wishlist = await Wishlist.findOne({ user: req.user._id }).populate({
      path: 'items.product',
      select: 'name slug price comparePrice images ratings stock status',
    });

    if (!wishlist) {
      wishlist = await Wishlist.create({ user: req.user._id, items: [] });
    }

    res.json({
      success: true,
      data: { wishlist },
    });
  }

  // Add to wishlist
  async addToWishlist(req, res) {
    const { productId, note } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    let wishlist = await Wishlist.findOne({ user: req.user._id });
    if (!wishlist) {
      wishlist = await Wishlist.create({ user: req.user._id, items: [] });
    }

    try {
      await wishlist.addItem(productId, note);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    await wishlist.populate({
      path: 'items.product',
      select: 'name slug price images',
    });

    res.json({
      success: true,
      message: 'Product added to wishlist',
      data: { wishlist },
    });
  }

  // Remove from wishlist
  async removeFromWishlist(req, res) {
    const { productId } = req.params;

    const wishlist = await Wishlist.findOne({ user: req.user._id });
    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: 'Wishlist not found',
      });
    }

    await wishlist.removeItem(productId);

    await wishlist.populate({
      path: 'items.product',
      select: 'name slug price images',
    });

    res.json({
      success: true,
      message: 'Product removed from wishlist',
      data: { wishlist },
    });
  }

  // Clear wishlist
  async clearWishlist(req, res) {
    const wishlist = await Wishlist.findOne({ user: req.user._id });
    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: 'Wishlist not found',
      });
    }

    await wishlist.clearWishlist();

    res.json({
      success: true,
      message: 'Wishlist cleared',
      data: { wishlist },
    });
  }

  // Check if product is in wishlist
  async checkProduct(req, res) {
    const { productId } = req.params;

    const wishlist = await Wishlist.findOne({ user: req.user._id });

    const inWishlist = wishlist ? wishlist.hasProduct(productId) : false;

    res.json({
      success: true,
      data: { inWishlist },
    });
  }
}

module.exports = new WishlistController();