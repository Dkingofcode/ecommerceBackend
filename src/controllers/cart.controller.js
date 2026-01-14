const Cart = require('../models/Cart');
const Product = require('../models/Product');
const logger = require('../utils/logger');

class CartController {
  // Get user's cart
  async getCart(req, res) {
    let cart = await Cart.findOne({ user: req.user._id }).populate({
      path: 'items.product',
      select: 'name slug price images stock status',
    });

    if (!cart) {
      cart = await Cart.create({ user: req.user._id, items: [] });
    }

    res.json({
      success: true,
      data: { cart },
    });
  }

  // Add item to cart
  async addToCart(req, res) {
    const { productId, quantity = 1, variant } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    if (!product.isInStock(quantity)) {
      return res.status(400).json({
        success: false,
        message: 'Product is out of stock',
      });
    }

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      cart = await Cart.create({ user: req.user._id, items: [] });
    }

    await cart.addItem(productId, quantity, variant, product.price);

    await cart.populate({
      path: 'items.product',
      select: 'name slug price images stock',
    });

    res.json({
      success: true,
      message: 'Item added to cart',
      data: { cart },
    });
  }

  // Update cart item quantity
  async updateCartItem(req, res) {
    const { productId } = req.params;
    const { quantity, variant } = req.body;

    if (quantity < 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be positive',
      });
    }

    const product = await Product.findById(productId);
    if (product && !product.isInStock(quantity)) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient stock',
      });
    }

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found',
      });
    }

    await cart.updateItemQuantity(productId, quantity, variant);

    await cart.populate({
      path: 'items.product',
      select: 'name slug price images stock',
    });

    res.json({
      success: true,
      message: 'Cart updated',
      data: { cart },
    });
  }

  // Remove item from cart
  async removeFromCart(req, res) {
    const { productId } = req.params;
    const { variant } = req.body;

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found',
      });
    }

    await cart.removeItem(productId, variant);

    await cart.populate({
      path: 'items.product',
      select: 'name slug price images stock',
    });

    res.json({
      success: true,
      message: 'Item removed from cart',
      data: { cart },
    });
  }

  // Clear cart
  async clearCart(req, res) {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found',
      });
    }

    await cart.clearCart();

    res.json({
      success: true,
      message: 'Cart cleared',
      data: { cart },
    });
  }

  // Apply coupon
  async applyCoupon(req, res) {
    const { code } = req.body;

    const Coupon = require('../models/Coupon');
    const coupon = await Coupon.findOne({ code: code.toUpperCase() });

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Invalid coupon code',
      });
    }

    if (!coupon.isValid()) {
      return res.status(400).json({
        success: false,
        message: 'Coupon is expired or inactive',
      });
    }

    if (!coupon.canBeUsedBy(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: 'You have exceeded the usage limit for this coupon',
      });
    }

    const cart = await Cart.findOne({ user: req.user._id }).populate({
      path: 'items.product',
      select: 'name price',
    });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart is empty',
      });
    }

    if (cart.subtotal < coupon.minimumPurchase) {
      return res.status(400).json({
        success: false,
        message: `Minimum purchase of $${coupon.minimumPurchase} required`,
      });
    }

    await cart.applyCoupon(code.toUpperCase(), coupon.value, coupon.type);

    res.json({
      success: true,
      message: 'Coupon applied successfully',
      data: { cart },
    });
  }

  // Remove coupon
  async removeCoupon(req, res) {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found',
      });
    }

    await cart.removeCoupon();

    await cart.populate({
      path: 'items.product',
      select: 'name slug price images stock',
    });

    res.json({
      success: true,
      message: 'Coupon removed',
      data: { cart },
    });
  }
}

module.exports = new CartController();