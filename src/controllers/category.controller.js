const Category = require('../models/Category');
const Product = require('../models/Product');
const logger = require('../utils/logger');
const { uploadImage, deleteImage } = require('../config/cloudinary');

class CategoryController {
  // Get all categories (tree structure)
  async getAllCategories(req, res) {
    const { includeInactive = false } = req.query;

    const query = {};
    if (!includeInactive) {
      query.isActive = true;
    }

    const categories = await Category.find(query)
      .populate('children')
      .sort({ order: 1, name: 1 })
      .lean();

    // Build tree structure (only root categories)
    const rootCategories = categories.filter(cat => !cat.parent);

    res.json({
      success: true,
      data: { categories: rootCategories },
    });
  }

  // Get category by slug
  async getCategoryBySlug(req, res) {
    const { slug } = req.params;

    const category = await Category.findOne({ slug, isActive: true })
      .populate('children')
      .populate('parent', 'name slug')
      .lean();

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    // Get product count
    const productCount = await Product.countDocuments({
      category: category._id,
      isPublished: true,
      status: 'active',
    });

    res.json({
      success: true,
      data: { category, productCount },
    });
  }

  // Create category (Admin)
  async createCategory(req, res) {
    const categoryData = req.body;

    // Handle image upload
    if (req.file) {
      const uploaded = await uploadImage(req.file, 'categories');
      categoryData.image = {
        url: uploaded.url,
        publicId: uploaded.publicId,
      };
    }

    const category = await Category.create(categoryData);

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: { category },
    });
  }

  // Update category (Admin)
  async updateCategory(req, res) {
    const { id } = req.params;

    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    // Handle new image upload
    if (req.file) {
      // Delete old image
      if (category.image?.publicId) {
        await deleteImage(category.image.publicId);
      }

      const uploaded = await uploadImage(req.file, 'categories');
      req.body.image = {
        url: uploaded.url,
        publicId: uploaded.publicId,
      };
    }

    const updatedCategory = await Category.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    res.json({
      success: true,
      message: 'Category updated successfully',
      data: { category: updatedCategory },
    });
  }

  // Delete category (Admin)
  async deleteCategory(req, res) {
    const { id } = req.params;

    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    // Check if category has products
    const productCount = await Product.countDocuments({ category: id });

    if (productCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete category with existing products',
      });
    }

    // Check if category has children
    const childrenCount = await Category.countDocuments({ parent: id });

    if (childrenCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete category with subcategories',
      });
    }

    // Delete image
    if (category.image?.publicId) {
      await deleteImage(category.image.publicId);
    }

    await category.deleteOne();

    res.json({
      success: true,
      message: 'Category deleted successfully',
    });
  }

  // Get featured categories
  async getFeaturedCategories(req, res) {
    const { limit = 8 } = req.query;

    const categories = await Category.find({
      isFeatured: true,
      isActive: true,
    })
      .sort({ order: 1 })
      .limit(parseInt(limit))
      .lean();

    res.json({
      success: true,
      data: { categories },
    });
  }

  // Reorder categories (Admin)
  async reorderCategories(req, res) {
    const { categoryOrders } = req.body; // Array of { id, order }

    const updatePromises = categoryOrders.map(({ id, order }) =>
      Category.findByIdAndUpdate(id, { order })
    );

    await Promise.all(updatePromises);

    res.json({
      success: true,
      message: 'Categories reordered successfully',
    });
  }
}

module.exports = new CategoryController();