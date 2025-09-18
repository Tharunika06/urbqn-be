// routes/adminProfile.js
const express = require('express');
const router = express.Router();
const AdminProfile = require('../models/AdminProfile');
const auth = require('../middleware/auth'); // Your auth middleware
// Helper function to validate base64 image
const isValidBase64Image = (base64String) => {
  if (!base64String || typeof base64String !== 'string') {
    return false;
  }
  
  // Check if it's a valid base64 image format
  const base64Regex = /^data:image\/(jpeg|jpg|png|gif|webp);base64,/;
  return base64Regex.test(base64String);
};

// Helper function to get base64 size in MB
const getBase64SizeInMB = (base64String) => {
  const base64Data = base64String.split(',')[1] || base64String;
  const sizeInBytes = (base64Data.length * 3) / 4;
  return sizeInBytes / (1024 * 1024);
};

// @route   GET /api/admin/profile
// @desc    Get admin profile
// @access  Private
router.get('/profile', auth, async (req, res) => {
  try {
    // Find admin profile by user ID from auth token
    let profile = await AdminProfile.findOne({ userId: req.user.id });
    
    // If no profile exists, create default one
    if (!profile) {
      profile = new AdminProfile({
        userId: req.user.id,
        name: req.user.name || 'Admin',
        email: req.user.email || '',
        phone: '',
        photo: null
      });
      await profile.save();
    }

    res.json({
      success: true,
      profile: {
        id: profile._id,
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        photo: profile.photo,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt
      }
    });
  } catch (error) {
    console.error('Error fetching admin profile:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching profile'
    });
  }
});

// @route   PUT /api/admin/profile
// @desc    Update admin profile
// @access  Private
router.put('/profile', auth, async (req, res) => {
  try {
    const { name, phone, photo } = req.body;

    // Validation
    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Name is required'
      });
    }

    // Validate base64 image if provided
    if (photo && !isValidBase64Image(photo)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid image format. Please provide a valid base64 image.'
      });
    }

    // Check base64 image size (limit to 5MB)
    if (photo && getBase64SizeInMB(photo) > 5) {
      return res.status(400).json({
        success: false,
        error: 'Image size too large. Maximum size is 5MB.'
      });
    }

    // Find and update profile
    let profile = await AdminProfile.findOneAndUpdate(
      { userId: req.user.id },
      {
        name: name.trim(),
        phone: phone || '',
        photo: photo || null,
        updatedAt: new Date()
      },
      { 
        new: true, // Return updated document
        upsert: true // Create if doesn't exist
      }
    );

    res.json({
      success: true,
      message: 'Profile updated successfully',
      profile: {
        id: profile._id,
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        photo: profile.photo,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt
      }
    });
  } catch (error) {
    console.error('Error updating admin profile:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while updating profile'
    });
  }
});

// @route   POST /api/admin/profile/photo
// @desc    Update profile photo (base64)
// @access  Private
router.post('/profile/photo', auth, async (req, res) => {
  try {
    const { photo } = req.body;

    if (!photo) {
      return res.status(400).json({
        success: false,
        error: 'No photo data provided'
      });
    }

    // Validate base64 image
    if (!isValidBase64Image(photo)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid image format. Please provide a valid base64 image.'
      });
    }

    // Check base64 image size (limit to 5MB)
    if (getBase64SizeInMB(photo) > 5) {
      return res.status(400).json({
        success: false,
        error: 'Image size too large. Maximum size is 5MB.'
      });
    }

    // Update profile with new photo
    const profile = await AdminProfile.findOneAndUpdate(
      { userId: req.user.id },
      { 
        photo: photo,
        updatedAt: new Date()
      },
      { 
        new: true,
        upsert: true 
      }
    );

    res.json({
      success: true,
      message: 'Photo updated successfully',
      photo: profile.photo
    });
  } catch (error) {
    console.error('Error updating profile photo:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while updating photo'
    });
  }
});

// @route   DELETE /api/admin/profile/photo
// @desc    Delete profile photo
// @access  Private
router.delete('/profile/photo', auth, async (req, res) => {
  try {
    await AdminProfile.findOneAndUpdate(
      { userId: req.user.id },
      { 
        photo: null,
        updatedAt: new Date()
      }
    );

    res.json({
      success: true,
      message: 'Photo deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting profile photo:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while deleting photo'
    });
  }
});

module.exports = router;