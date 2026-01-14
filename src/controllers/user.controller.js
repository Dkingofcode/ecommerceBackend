const User = require('../models/User');
const Address = require('../models/Address');
const logger = require('../utils/logger');
const { uploadImage, deleteImage } = require('../config/cloudinary');

class UserController {
  // Get user profile
  async getProfile(req, res) {
    const user = await User.findById(req.user._id)
      .populate('addresses')
      .lean();

    res.json({
      success: true,
      data: { user },
    });
  }

  // Update user profile
  async updateProfile(req, res) {
    const { firstName, lastName, phone } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone) user.phone = phone;

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user },
    });
  }

  // Upload avatar
  async uploadAvatar(req, res) {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    const user = await User.findById(req.user._id);

    // Delete old avatar if exists
    if (user.avatar?.publicId) {
      await deleteImage(user.avatar.publicId);
    }

    const uploaded = await uploadImage(req.file, 'avatars');

    user.avatar = {
      url: uploaded.url,
      publicId: uploaded.publicId,
    };

    await user.save();

    res.json({
      success: true,
      message: 'Avatar uploaded successfully',
      data: { avatar: user.avatar },
    });
  }

  // Delete avatar
  async deleteAvatar(req, res) {
    const user = await User.findById(req.user._id);

    if (user.avatar?.publicId) {
      await deleteImage(user.avatar.publicId);
    }

    user.avatar = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Avatar deleted successfully',
    });
  }

  // Get user addresses
  async getAddresses(req, res) {
    const addresses = await Address.find({ user: req.user._id }).lean();

    res.json({
      success: true,
      data: { addresses },
    });
  }

  // Add address
  async addAddress(req, res) {
    const addressData = {
      ...req.body,
      user: req.user._id,
    };

    const address = await Address.create(addressData);

    res.status(201).json({
      success: true,
      message: 'Address added successfully',
      data: { address },
    });
  }

  // Update address
  async updateAddress(req, res) {
    const { id } = req.params;

    const address = await Address.findById(id);

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found',
      });
    }

    if (address.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }

    const updatedAddress = await Address.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    res.json({
      success: true,
      message: 'Address updated successfully',
      data: { address: updatedAddress },
    });
  }

  // Delete address
  async deleteAddress(req, res) {
    const { id } = req.params;

    const address = await Address.findById(id);

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found',
      });
    }

    if (address.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }

    await address.deleteOne();

    res.json({
      success: true,
      message: 'Address deleted successfully',
    });
  }

  // Set default address
  async setDefaultAddress(req, res) {
    const { id } = req.params;

    const address = await Address.findById(id);

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found',
      });
    }

    if (address.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }

    // Remove default from all user addresses
    await Address.updateMany(
      { user: req.user._id },
      { $set: { isDefault: false } }
    );

    // Set this address as default
    address.isDefault = true;
    await address.save();

    res.json({
      success: true,
      message: 'Default address set',
      data: { address },
    });
  }

  // Get user order history
  async getOrderHistory(req, res) {
    const { page = 1, limit = 10, status } = req.query;

    const query = { user: req.user._id };
    if (status) query.status = status;

    const skip = (page - 1) * limit;

    const orders = await require('../models/Order')
      .find(query)
      .populate('items.product', 'name slug images')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    const total = await require('../models/Order').countDocuments(query);

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

  // Delete account
  async deleteAccount(req, res) {
    const { password } = req.body;

    const user = await User.findById(req.user._id).select('+password');

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid password',
      });
    }

    // Soft delete - deactivate account
    user.isActive = false;
    await user.save();

    res.json({
      success: true,
      message: 'Account deleted successfully',
    });
  }
}

module.exports = new UserController();