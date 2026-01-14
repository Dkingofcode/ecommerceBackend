const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Review = require('../models/Review');
const Coupon = require('../models/Coupon');
const logger = require('../utils/logger');
const dayjs = require('dayjs');

class AdminController {
  // Dashboard statistics
  async getDashboardStats(req, res) {
    const { period = '30d' } = req.query;

    let startDate;
    const endDate = new Date();

    switch (period) {
      case '7d':
        startDate = dayjs().subtract(7, 'day').toDate();
        break;
      case '30d':
        startDate = dayjs().subtract(30, 'day').toDate();
        break;
      case '90d':
        startDate = dayjs().subtract(90, 'day').toDate();
        break;
      case '1y':
        startDate = dayjs().subtract(1, 'year').toDate();
        break;
      default:
        startDate = dayjs().subtract(30, 'day').toDate();
    }

    // Total counts
    const totalUsers = await User.countDocuments({ isActive: true });
    const totalProducts = await Product.countDocuments({ isPublished: true });
    const totalOrders = await Order.countDocuments();

    // Revenue stats
    const revenueStats = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          paymentStatus: 'paid',
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$total' },
          averageOrderValue: { $avg: '$total' },
          orderCount: { $sum: 1 },
        },
      },
    ]);

    // Previous period comparison
    const prevStartDate = dayjs(startDate)
      .subtract(dayjs(endDate).diff(startDate, 'day'), 'day')
      .toDate();

    const previousRevenue = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: prevStartDate, $lt: startDate },
          paymentStatus: 'paid',
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$total' },
        },
      },
    ]);

    const currentRevenue = revenueStats[0]?.totalRevenue || 0;
    const prevRevenue = previousRevenue[0]?.total || 0;
    const revenueGrowth = prevRevenue
      ? ((currentRevenue - prevRevenue) / prevRevenue) * 100
      : 0;

    // Order status breakdown
    const ordersByStatus = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          revenue: { $sum: '$total' },
        },
      },
    ]);

    // Top selling products
    const topProducts = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: { $in: ['confirmed', 'processing', 'shipped', 'delivered'] },
        },
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          totalSold: { $sum: '$items.quantity' },
          revenue: { $sum: '$items.total' },
        },
      },
      { $sort: { totalSold: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: '$product' },
      {
        $project: {
          name: '$product.name',
          slug: '$product.slug',
          image: { $arrayElemAt: ['$product.images.url', 0] },
          totalSold: 1,
          revenue: 1,
        },
      },
    ]);

    // Recent orders
    const recentOrders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('user', 'firstName lastName email')
      .select('orderNumber total status createdAt')
      .lean();

    // Low stock products
    const lowStockProducts = await Product.find({
      'stock.quantity': {
        $lte: parseInt(process.env.LOW_STOCK_THRESHOLD) || 10,
      },
      status: 'active',
    })
      .select('name sku stock.quantity')
      .limit(10)
      .lean();

    // Revenue by day (for chart)
    const revenueByDay = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          paymentStatus: 'paid',
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          revenue: { $sum: '$total' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          totalUsers,
          totalProducts,
          totalOrders,
          totalRevenue: currentRevenue,
          averageOrderValue: revenueStats[0]?.averageOrderValue || 0,
          revenueGrowth: Math.round(revenueGrowth * 100) / 100,
        },
        ordersByStatus,
        topProducts,
        recentOrders,
        lowStockProducts,
        revenueByDay,
      },
    });
  }

  // Get all users (with filters)
  async getAllUsers(req, res) {
    const {
      page = 1,
      limit = 20,
      role,
      isActive,
      search,
      sort = '-createdAt',
    } = req.query;

    const query = {};

    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (search) {
      query.$or = [
        { firstName: new RegExp(search, 'i') },
        { lastName: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') },
      ];
    }

    const skip = (page - 1) * limit;

    const users = await User.find(query)
      .sort(sort)
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  }

  // Update user role
  async updateUserRole(req, res) {
    const { userId } = req.params;
    const { role } = req.body;

    if (!['customer', 'seller', 'admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role',
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    user.role = role;
    await user.save();

    res.json({
      success: true,
      message: 'User role updated',
      data: { user },
    });
  }

  // Deactivate user
  async deactivateUser(req, res) {
    const { userId } = req.params;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    user.isActive = false;
    await user.save();

    res.json({
      success: true,
      message: 'User deactivated',
      data: { user },
    });
  }

  // Activate user
  async activateUser(req, res) {
    const { userId } = req.params;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    user.isActive = true;
    await user.save();

    res.json({
      success: true,
      message: 'User activated',
      data: { user },
    });
  }

  // Get all orders (Admin view)
  async getAllOrders(req, res) {
    const {
      page = 1,
      limit = 20,
      status,
      paymentStatus,
      startDate,
      endDate,
      search,
      sort = '-createdAt',
    } = req.query;

    const query = {};

    if (status) query.status = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    if (search) {
      query.orderNumber = new RegExp(search, 'i');
    }

    const skip = (page - 1) * limit;

    const orders = await Order.find(query)
      .populate('user', 'firstName lastName email')
      .sort(sort)
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

  // Get all products (Admin view)
  async getAllProductsAdmin(req, res) {
    const {
      page = 1,
      limit = 20,
      status,
      category,
      seller,
      search,
      sort = '-createdAt',
    } = req.query;

    const query = {};

    if (status) query.status = status;
    if (category) query.category = category;
    if (seller) query.seller = seller;

    if (search) {
      query.$text = { $search: search };
    }

    const skip = (page - 1) * limit;

    const products = await Product.find(query)
      .populate('category', 'name')
      .populate('seller', 'firstName lastName email')
      .sort(sort)
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    const total = await Product.countDocuments(query);

    res.json({
      success: true,
      data: {
        products,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  }

  // Approve/Reject product
  async updateProductStatus(req, res) {
    const { productId } = req.params;
    const { status } = req.body;

    if (!['draft', 'active', 'inactive', 'out_of_stock'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status',
      });
    }

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    product.status = status;
    if (status === 'active') {
      product.isPublished = true;
      product.publishedAt = new Date();
    }

    await product.save();

    res.json({
      success: true,
      message: 'Product status updated',
      data: { product },
    });
  }

  // Get all reviews (pending approval)
  async getPendingReviews(req, res) {
    const { page = 1, limit = 20 } = req.query;

    const skip = (page - 1) * limit;

    const reviews = await Review.find({ status: 'pending' })
      .populate('user', 'firstName lastName')
      .populate('product', 'name slug')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    const total = await Review.countDocuments({ status: 'pending' });

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

  // Sales report
  async getSalesReport(req, res) {
    const { startDate, endDate, groupBy = 'day' } = req.query;

    const matchStage = {
      paymentStatus: 'paid',
      status: { $in: ['confirmed', 'processing', 'shipped', 'delivered'] },
    };

    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }

    let dateFormat;
    switch (groupBy) {
      case 'day':
        dateFormat = '%Y-%m-%d';
        break;
      case 'week':
        dateFormat = '%Y-W%V';
        break;
      case 'month':
        dateFormat = '%Y-%m';
        break;
      case 'year':
        dateFormat = '%Y';
        break;
      default:
        dateFormat = '%Y-%m-%d';
    }

    const salesData = await Order.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            $dateToString: { format: dateFormat, date: '$createdAt' },
          },
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$total' },
          averageOrderValue: { $avg: '$total' },
          totalItems: { $sum: { $size: '$items' } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Product category breakdown
    const categoryBreakdown = await Order.aggregate([
      { $match: matchStage },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.product',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: '$product' },
      {
        $lookup: {
          from: 'categories',
          localField: 'product.category',
          foreignField: '_id',
          as: 'category',
        },
      },
      { $unwind: '$category' },
      {
        $group: {
          _id: '$category.name',
          totalSales: { $sum: '$items.total' },
          itemsSold: { $sum: '$items.quantity' },
        },
      },
      { $sort: { totalSales: -1 } },
    ]);

    res.json({
      success: true,
      data: {
        salesData,
        categoryBreakdown,
      },
    });
  }

  // Export data
  async exportData(req, res) {
    const { type, format = 'json', startDate, endDate } = req.query;

    let data;

    switch (type) {
      case 'orders':
        const orderQuery = {};
        if (startDate || endDate) {
          orderQuery.createdAt = {};
          if (startDate) orderQuery.createdAt.$gte = new Date(startDate);
          if (endDate) orderQuery.createdAt.$lte = new Date(endDate);
        }
        data = await Order.find(orderQuery)
          .populate('user', 'firstName lastName email')
          .lean();
        break;

      case 'users':
        data = await User.find().lean();
        break;

      case 'products':
        data = await Product.find()
          .populate('category', 'name')
          .populate('seller', 'firstName lastName')
          .lean();
        break;

      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid export type',
        });
    }

    if (format === 'json') {
      res.json({
        success: true,
        data,
      });
    } else if (format === 'csv') {
      // CSV export logic would go here
      // You'd use a library like 'json2csv'
      res.status(501).json({
        success: false,
        message: 'CSV export not implemented yet',
      });
    }
  }
}

module.exports = new AdminController();