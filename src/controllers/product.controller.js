const Product = require('../models/Product');
const Category = require('../models/Category');
const logger = require('../utils/logger');
const { uploadMultipleImages, deleteImage } = require('../config/cloudinary');

class ProductController {
  // Get all products with filters, search, pagination
  async getAllProducts(req, res) {
    const {
      page = 1,
      limit = 20,
      sort = '-createdAt',
      category,
      minPrice,
      maxPrice,
      rating,
      search,
      inStock,
      isFeatured,
      brand,
      tags,
    } = req.query;

    const query = { isPublished: true, status: 'active' };

    // Category filter
    if (category) {
      query.category = category;
    }

    // Price filter
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }

    // Rating filter
    if (rating) {
      query['ratings.average'] = { $gte: parseFloat(rating) };
    }

    // In stock filter
    if (inStock === 'true') {
      query['stock.quantity'] = { $gt: 0 };
      query.status = 'active';
    }

    // Featured filter
    if (isFeatured === 'true') {
      query.isFeatured = true;
    }

    // Brand filter
    if (brand) {
      query.brand = brand;
    }

    // Tags filter
    if (tags) {
      query.tags = { $in: tags.split(',') };
    }

    // Search
    if (search) {
      query.$text = { $search: search };
    }

    const skip = (page - 1) * limit;

    const products = await Product.find(query)
      .populate('category', 'name slug')
      .populate('seller', 'firstName lastName')
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

  // Get single product by slug
  async getProductBySlug(req, res) {
    const { slug } = req.params;

    const product = await Product.findOne({ slug, isPublished: true })
      .populate('category', 'name slug')
      .populate('subcategory', 'name slug')
      .populate('seller', 'firstName lastName avatar')
      .populate({
        path: 'reviews',
        match: { status: 'approved' },
        options: { limit: 10, sort: { createdAt: -1 } },
        populate: { path: 'user', select: 'firstName lastName avatar' },
      });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    // Increment view count
    await product.incrementViews();

    res.json({
      success: true,
      data: { product },
    });
  }

  // Get product by ID
  async getProductById(req, res) {
    const { id } = req.params;

    const product = await Product.findById(id)
      .populate('category', 'name slug')
      .populate('seller', 'firstName lastName');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    res.json({
      success: true,
      data: { product },
    });
  }

  // Create product (seller/admin)
  async createProduct(req, res) {
    const productData = {
      ...req.body,
      seller: req.user._id,
    };

    // Handle image uploads
    if (req.files && req.files.length > 0) {
      const uploadedImages = await uploadMultipleImages(req.files, 'products');
      productData.images = uploadedImages.map((img, index) => ({
        url: img.url,
        publicId: img.publicId,
        isPrimary: index === 0,
      }));
    }

    const product = await Product.create(productData);

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: { product },
    });
  }

  // Update product
  async updateProduct(req, res) {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    // Check ownership (seller can only update their own products)
    if (
      req.user.role !== 'admin' &&
      product.seller.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this product',
      });
    }

    // Handle new image uploads
    if (req.files && req.files.length > 0) {
      const uploadedImages = await uploadMultipleImages(req.files, 'products');
      const newImages = uploadedImages.map((img) => ({
        url: img.url,
        publicId: img.publicId,
      }));
      req.body.images = [...(product.images || []), ...newImages];
    }

    const updatedProduct = await Product.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    res.json({
      success: true,
      message: 'Product updated successfully',
      data: { product: updatedProduct },
    });
  }

  // Delete product
  async deleteProduct(req, res) {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    // Check ownership
    if (
      req.user.role !== 'admin' &&
      product.seller.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this product',
      });
    }

    // Delete images from cloudinary
    if (product.images && product.images.length > 0) {
      for (const image of product.images) {
        if (image.publicId) {
          await deleteImage(image.publicId);
        }
      }
    }

    await product.deleteOne();

    res.json({
      success: true,
      message: 'Product deleted successfully',
    });
  }

  // Get featured products
  async getFeaturedProducts(req, res) {
    const { limit = 10 } = req.query;

    const products = await Product.find({
      isFeatured: true,
      isPublished: true,
      status: 'active',
    })
      .populate('category', 'name slug')
      .limit(parseInt(limit))
      .lean();

    res.json({
      success: true,
      data: { products },
    });
  }

  // Get related products
  async getRelatedProducts(req, res) {
    const { id } = req.params;
    const { limit = 6 } = req.query;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    const relatedProducts = await Product.find({
      _id: { $ne: product._id },
      category: product.category,
      isPublished: true,
      status: 'active',
    })
      .limit(parseInt(limit))
      .lean();

    res.json({
      success: true,
      data: { products: relatedProducts },
    });
  }

  // Get products by category
  async getProductsByCategory(req, res) {
    const { categorySlug } = req.params;
    const { page = 1, limit = 20, sort = '-createdAt' } = req.query;

    const category = await Category.findOne({ slug: categorySlug });
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    const skip = (page - 1) * limit;

    const products = await Product.find({
      category: category._id,
      isPublished: true,
      status: 'active',
    })
      .populate('category', 'name slug')
      .sort(sort)
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    const total = await Product.countDocuments({
      category: category._id,
      isPublished: true,
      status: 'active',
    });

    res.json({
      success: true,
      data: {
        products,
        category,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  }

  // Search products
  async searchProducts(req, res) {
    const { q, page = 1, limit = 20 } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required',
      });
    }

    const skip = (page - 1) * limit;

    const products = await Product.find({
      $text: { $search: q },
      isPublished: true,
      status: 'active',
    })
      .populate('category', 'name slug')
      .sort({ score: { $meta: 'textScore' } })
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    const total = await Product.countDocuments({
      $text: { $search: q },
      isPublished: true,
      status: 'active',
    });

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
}

module.exports = new ProductController();