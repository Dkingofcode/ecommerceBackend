const Product = require('../models/Product');
const logger = require('../utils/logger');
const emailService = require('../utils/email.service');

class InventoryService {
  // Check low stock products
  async checkLowStock() {
    const threshold = parseInt(process.env.LOW_STOCK_THRESHOLD) || 10;

    const lowStockProducts = await Product.find({
      'stock.quantity': { $lte: threshold },
      status: 'active',
    });

    if (lowStockProducts.length > 0) {
      logger.warn(`Found ${lowStockProducts.length} low stock products`);

      // Send alert for each low stock product
      for (const product of lowStockProducts) {
        await emailService.sendLowStockAlert(
          process.env.ADMIN_EMAIL,
          product
        );
      }
    }

    return lowStockProducts;
  }

  // Update stock after order
  async updateStockAfterOrder(orderItems) {
    for (const item of orderItems) {
      const product = await Product.findById(item.product);

      if (product) {
        await product.deductStock(item.quantity);
      }
    }
  }

  // Restore stock after cancellation
  async restoreStockAfterCancellation(orderItems) {
    for (const item of orderItems) {
      const product = await Product.findById(item.product);

      if (product) {
        product.stock.quantity += item.quantity;
        product.stock.reserved -= item.quantity;

        if (product.stock.quantity > 0 && product.status === 'out_of_stock') {
          product.status = 'active';
        }

        await product.save();
      }
    }
  }

  // Generate inventory report
  async generateInventoryReport() {
    const totalProducts = await Product.countDocuments();
    const activeProducts = await Product.countDocuments({ status: 'active' });
    const outOfStock = await Product.countDocuments({
      status: 'out_of_stock',
    });

    const totalValue = await Product.aggregate([
      { $match: { status: 'active' } },
      {
        $group: {
          _id: null,
          total: {
            $sum: { $multiply: ['$price', '$stock.quantity'] },
          },
        },
      },
    ]);

    return {
      totalProducts,
      activeProducts,
      outOfStock,
      totalInventoryValue: totalValue[0]?.total || 0,
    };
  }

  // Auto-restock (if enabled)
  async autoRestock(productId, quantity) {
    const product = await Product.findById(productId);

    if (!product) {
      throw new Error('Product not found');
    }

    product.stock.quantity += quantity;

    if (product.status === 'out_of_stock') {
      product.status = 'active';
    }

    await product.save();

    logger.info(`Auto-restocked ${product.name} with ${quantity} units`);

    return product;
  }
}

module.exports = new InventoryService();