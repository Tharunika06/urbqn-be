// server/src/routes/index.js
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/roleCheck');
const authController = require('../controllers/authController');

// ===== DIRECT AUTH ROUTES (Backward Compatibility) =====
// Public authentication routes
router.post('/login', authController.login);
router.post('/signup', authController.signup);
router.post('/verify-code', authController.verifyCode);
router.post('/forgot-password', authController.forgotPassword);
router.post('/verify-reset-otp', authController.verifyResetOtp);
router.post('/reset-password', authController.resetPassword);

// Admin login (direct route)
router.post('/admin-login', authController.adminLogin);

// Authenticated routes (direct)
router.get('/me', verifyToken, async (req, res) => {
  try {
    res.status(200).json({
      message: 'Current user retrieved successfully',
      user: {
        id: req.user._id,
        email: req.user.email,
        role: req.user.role,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        isVerified: req.user.isVerified,
        createdAt: req.user.createdAt,
        updatedAt: req.user.updatedAt
      }
    });
  } catch (error) {
    console.error('Error getting current user:', error);
    res.status(500).json({ 
      error: 'Failed to get current user',
      details: error.message 
    });
  }
});

router.put('/me', verifyToken, async (req, res) => {
  try {
    const { firstName, lastName } = req.body;
    
    if (req.body.role) {
      return res.status(403).json({ 
        error: 'Role modification is not allowed through this endpoint' 
      });
    }
    
    const User = require('../models/User');
    
    const updateData = {};
    if (firstName !== undefined) updateData.firstName = firstName.trim();
    if (lastName !== undefined) updateData.lastName = lastName.trim();
    
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        error: 'No valid fields provided for update'
      });
    }
    
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password -otp -otpExpires');
    
    if (!updatedUser) {
      return res.status(404).json({ 
        error: 'User not found' 
      });
    }
    
    console.log(`User profile updated: ${updatedUser.email}`);
    
    res.status(200).json({
      message: 'User profile updated successfully',
      user: {
        id: updatedUser._id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        role: updatedUser.role,
        isVerified: updatedUser.isVerified
      }
    });
    
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ 
      error: 'Failed to update user profile',
      details: error.message 
    });
  }
});

router.put('/change-password', verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'Current password and new password are required'
      });
    }
    
    const User = require('../models/User');
    const bcrypt = require('bcrypt');
    
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }
    
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        error: 'Current password is incorrect'
      });
    }
    
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    
    user.password = hashedNewPassword;
    await user.save();
    
    console.log(`Password changed for user: ${req.user.email}`);
    
    res.status(200).json({
      message: 'Password updated successfully'
    });
    
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ 
      error: 'Failed to change password',
      details: error.message 
    });
  }
});

router.post('/logout', async (req, res) => {
  try {
    if (req.user) {
      console.log(`User logged out: ${req.user.email}`);
    }
    
    res.status(200).json({
      message: 'Logged out successfully'
    });
    
  } catch (error) {
    console.error('Error during logout:', error);
    res.status(500).json({ 
      error: 'Logout failed',
      details: error.message 
    });
  }
});

// ===== FULL AUTH ROUTES (with /auth prefix) =====
router.use('/auth', require('./auth'));

// ===== AUTHENTICATED ROUTES (Token required) =====
router.use('/property', require('./property'));
router.use('/favorites', require('./favorites'));

// ===== REVIEWS ROUTES (UPDATED - No token required for now) =====
// This allows the review functionality to work with temp-user-id
// TODO: Add verifyToken middleware when real authentication is implemented
router.use('/reviews', require('./reviews'));

router.use('/profiles', require('./profileRoutes'));
router.use('/payment', require('./transactionRoutes'));

// NOTIFICATIONS - Mixed auth (some routes need token, some don't)
router.use('/notifications', require('./notification'));

router.use('/owners', require('./ownerRoutes'));

// ===== ADMIN ONLY ROUTES (Admin role required) =====
router.use('/admin', verifyToken, requireAdmin, require('./adminRoutes'));
router.use('/stats', require('./stats'));
router.use('/sales', require('./sales'));

// ===== UTILITY ROUTES =====
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'API is healthy',
    timestamp: new Date().toISOString()
  });
});

router.get('/endpoints', (req, res) => {
  res.status(200).json({
    message: 'Available API Endpoints',
    public: {
      auth: [
        'POST /api/login',
        'POST /api/signup',
        'POST /api/admin-login',
        'POST /api/verify-code',
        'POST /api/forgot-password',
        'POST /api/verify-reset-otp',
        'POST /api/reset-password'
      ],
      alternate: [
        'POST /api/auth/login',
        'POST /api/auth/signup',
        'POST /api/auth/admin/login'
      ]
    },
    authenticated: [
      'GET /api/me',
      'PUT /api/me',
      'PUT /api/change-password',
      'POST /api/logout',
      'GET /api/property/*',
      'GET /api/favorites/*',
      'GET /api/profiles/*',
      'GET /api/payment/*',
      'GET /api/notifications/mobile (requires token)',
      'GET /api/notifications/mobile/unread-count (requires token)'
    ],
    reviews: [
      'POST /api/reviews',
      'POST /api/reviews/pending',
      'GET /api/reviews',
      'GET /api/reviews/property/:propertyId',
      'GET /api/reviews/pending/:propertyId/:userId',
      'DELETE /api/reviews/:id',
      'DELETE /api/reviews/pending/:propertyId/:userId'
    ],
    admin: [
      'GET /api/admin/*',
      'GET /api/notifications (admin)',
      'GET /api/owners/*',
      'GET /api/stats/*',
      'GET /api/sales/*'
    ]
  });
});

module.exports = router