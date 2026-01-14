const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const logger = require('../utils/logger');
const paymentService = require('../utils/payment.service');
const emailService = require('../utils/email.service');

class OrderController {
  // Create order from cart
  async createOrder(req, res) {
    const {
      shippingAddress,
      billingAddress,
      paymentMethod,
      shippingMethod = 'standard',
      customerNote,
    } = req.body;

    // Get user's cart
    const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart is empty',
      });
    }

    // Validate stock for all items
    for (const item of cart.items) {
      if (!item.product.isInStock(item.quantity)) {
        return res.status(400).json({
          success: false,
          message: `${item.product.name} is out of stock`,
        });
      }
    }

    // Calculate pricing
    const subtotal = cart.subtotal;
    const taxRate = parseFloat(process.env.TAX_RATE) || 0.08;
    const tax = subtotal * taxRate;

    let shippingCost = 0;
    const freeShippingThreshold = parseFloat(process.env.FREE_SHIPPING_THRESHOLD) || 50;
    
    if (subtotal < freeShippingThreshold) {
      if (shippingMethod === 'express') {
        shippingCost = parseFloat(process.env.EXPRESS_SHIPPING_COST) || 14.99;
      } else {
        shippingCost = parseFloat(process.env.DEFAULT_SHIPPING_COST) || 5.99;
      }
    }

    const discount = cart.discountAmount || 0;
    const total = subtotal + tax + shippingCost - discount;

    // Prepare order items
    const orderItems = cart.items.map(item => ({
      product: item.product._id,
      name: item.product.name,
      image: item.product.images[0]?.url,
      sku: item.product.sku,
      variant: item.variant,
      quantity: item.quantity,
      price: item.price,
      total: item.price * item.quantity,
    }));

    // Create order
    const order = await Order.create({
      user: req.user._id,
      items: orderItems,
      subtotal,
      tax,
      taxRate,
      shippingCost,
      discount,
      total,
      coupon: cart.coupon,
      shippingAddress,
      billingAddress: billingAddress || shippingAddress,
      paymentMethod,
      shippingMethod,
      customerNote,
      status: 'pending',
      paymentStatus: 'pending',
    });

    // Reserve stock for all items
    for (const item of cart.items) {
      await item.product.reserveStock(item.quantity);
    }

    // Record coupon usage if applied
    if (cart.coupon) {
      const coupon = await Coupon.findOne({ code: cart.coupon.code });
      if (coupon) {
        await coupon.recordUsage(req.user._id);
      }
    }

    // Clear cart
    await cart.clearCart();

    // Process payment based on method
    if (paymentMethod === 'card') {
      // Stripe payment will be handled separately
      // For now, just return the order with payment intent
    } else if (paymentMethod === 'cod') {
      // Cash on delivery - order confirmed immediately
      order.status = 'confirmed';
      await order.save();
    }

    // Send order confirmation email
    if (process.env.ENABLE_EMAIL === 'true') {
      try {
        await emailService.sendOrderConfirmation(req.user.email, order);
      } catch (error) {
        logger.error('Order confirmation email failed:', error);
      }
    }

    await order.populate([
      { path: 'items.product', select: 'name slug images' },
      { path: 'user', select: 'firstName lastName email' },
    ]);

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: { order },
    });
  }

  // Get all orders for user
  async getUserOrders(req, res) {
    const { page = 1, limit = 10, status } = req.query;

    const query = { user: req.user._id };
    if (status) {
      query.status = status;
    }

    const skip = (page - 1) * limit;

    const orders = await Order.find(query)
      .populate('items.product', 'name slug images')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    const total = await Order.countDocuments(query);

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  }

  // Get single order
  async getOrder(req, res) {
    const { id } = req.params;

    const order = await Order.findById(id)
      .populate('items.product', 'name slug images')
      .populate('user', 'firstName lastName email phone');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // Check if user owns this order (or is admin)
    if (
      req.user.role !== 'admin' &&
      order.user._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this order',
      });
    }

    res.json({
      success: true,
      data: { order },
    });
  }

  // Cancel order
  async cancelOrder(req, res) {
    const { id } = req.params;
    const { reason } = req.body;

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // Check ownership
    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this order',
      });
    }

    if (!order.canBeCancelled()) {
      return res.status(400).json({
        success: false,
        message: 'Order cannot be cancelled at this stage',
      });
    }

    // Release reserved stock
    for (const item of order.items) {
      const product = await Product.findById(item.product);
      if (product) {
        await product.releaseStock(item.quantity);
      }
    }

    order.status = 'cancelled';
    order.cancelledAt = new Date();
    order.cancellationReason = reason;
    await order.save();

    // Send cancellation email
    if (process.env.ENABLE_EMAIL === 'true') {
      await emailService.sendOrderCancellation(req.user.email, order);
    }

    res.json({
      success: true,
      message: 'Order cancelled successfully',
      data: { order },
    });
  }

  // Request return
  async requestReturn(req, res) {
    const { id } = req.params;
    const { reason } = req.body;

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }

    if (!order.canBeReturned()) {
      return res.status(400).json({
        success: false,
        message: 'Return period has expired or order is not eligible for return',
      });
    }

    order.returnRequested = true;
    order.returnReason = reason;
    order.returnStatus = 'requested';
    await order.save();

    res.json({
      success: true,
      message: 'Return request submitted successfully',
      data: { order },
    });
  }

  // Update order status (Admin/Seller)
  async updateOrderStatus(req, res) {
    const { id } = req.params;
    const { status, trackingNumber, carrier, note } = req.body;

    const order = await Order.findById(id).populate('user', 'email firstName');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    const oldStatus = order.status;
    order.status = status;

    if (trackingNumber) order.trackingNumber = trackingNumber;
    if (carrier) order.carrier = carrier;

    // Add note to timeline
    if (note) {
      order.timeline.push({
        status,
        note,
        updatedBy: req.user._id,
      });
    }

    // If status is confirmed, deduct stock
    if (status === 'confirmed' && oldStatus === 'pending') {
      for (const item of order.items) {
        const product = await Product.findById(item.product);
        if (product) {
          await product.deductStock(item.quantity);
        }
      }
    }

    await order.save();

    // Send status update email
    if (process.env.ENABLE_EMAIL === 'true') {
      await emailService.sendOrderStatusUpdate(order.user.email, order);
    }

    res.json({
      success: true,
      message: 'Order status updated',
      data: { order },
    });
  }

  // Get order statistics (Admin)
  async getOrderStats(req, res) {
    const { startDate, endDate } = req.query;

    const matchStage = {};
    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }

    const stats = await Order.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$total' },
          averageOrderValue: { $avg: '$total' },
          pendingOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] },
          },
          completedOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] },
          },
          cancelledOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] },
          },
        },
      },
    ]);

    const statusBreakdown = await Order.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          revenue: { $sum: '$total' },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        stats: stats[0] || {},
        statusBreakdown,
      },
    });
  }
}

module.exports = new OrderController();