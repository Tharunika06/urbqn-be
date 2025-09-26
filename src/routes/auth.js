// routes/auth.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const authController = require('../controllers/authController');
const Notification = require('../models/Notification'); // Import Notification model

// Helper to emit and save notification after successful response
function emitAfterSuccess(req, res, payloadBuilder) {
  const io = req.app.get('io');
  res.once('finish', async () => {
    // 2xx only
    if (res.statusCode >= 200 && res.statusCode < 300) {
      try {
        const payload = payloadBuilder();
        if (payload) {
          // Emit real-time notification
          io.emit('new-notification', payload);

          // Save to DB
          await Notification.create({
            userId: req.user ? req.user.id : null, // optional: depends if you attach user
            type: payload.type,
            message: payload.message,
            time: new Date(),
            isRead: false,
          });
        }
      } catch (e) {
        console.error('Notification emit/save error:', e.message);
      }
    }
  });
}

// Middleware to verify JWT token
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Access denied. No token provided or invalid format.' 
      });
    }

    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Access denied. No token provided.' 
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    const User = require('../models/User');
    const user = await User.findById(decoded.userId || decoded.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found. Token may be invalid.' 
      });
    }

    // Attach user to request
    req.user = user;
    next();
    
  } catch (error) {
    console.error('Token verification error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Invalid token format.' 
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token has expired. Please log in again.' 
      });
    }
    
    res.status(401).json({ 
      error: 'Token verification failed.',
      details: error.message 
    });
  }
};

// Public routes (no authentication required)
router.post('/signup', (req, res, next) => {
  emitAfterSuccess(req, res, () => ({
    type: 'signup',
    message: `New user signed up: ${req.body?.email || 'Unknown email'}`,
    time: new Date().toISOString(),
  }));
  return authController.signup(req, res, next);
});

router.post('/verify-code', authController.verifyCode);

router.post('/login', (req, res, next) => {
  emitAfterSuccess(req, res, () => ({
    type: 'login',
    message: `User logged in: ${req.body?.email || 'Unknown email'}`,
    time: new Date().toISOString(),
  }));
  return authController.login(req, res, next);
});

router.post('/forgot-password', authController.forgotPassword);
router.post('/verify-reset-otp', authController.verifyResetOtp);
router.post('/reset-password', authController.resetPassword);

// Verify JWT token - NEW ROUTE FOR FRONTEND AUTHENTICATION
router.get('/verify-token', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'No token provided or invalid format',
        authenticated: false
      });
    }

    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        error: 'No token provided',
        authenticated: false
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    const User = require('../models/User');
    const user = await User.findById(decoded.userId || decoded.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found',
        authenticated: false
      });
    }

    console.log(`Token verified for user: ${user.email}`);
    
    res.status(200).json({
      message: 'Token is valid',
      authenticated: true,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
    
  } catch (error) {
    console.error('Token verification error:', error);
    
    let errorMessage = 'Invalid token';
    
    if (error.name === 'JsonWebTokenError') {
      errorMessage = 'Invalid token format';
    } else if (error.name === 'TokenExpiredError') {
      errorMessage = 'Token has expired';
    }
    
    res.status(401).json({ 
      error: errorMessage,
      authenticated: false,
      details: error.message 
    });
  }
});

// Get current user profile (requires authentication)
router.get('/me', verifyToken, async (req, res) => {
  try {
    console.log(`Getting current user profile: ${req.user.email}`);
    
    res.status(200).json({
      message: 'Current user retrieved successfully',
      user: {
        id: req.user._id,
        email: req.user.email,
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

// Update current user profile (requires authentication)
router.put('/me', verifyToken, async (req, res) => {
  try {
    const { firstName, lastName } = req.body;
    
    console.log(`Updating user profile: ${req.user.email}`);
    
    const User = require('../models/User');
    
    const updateData = {};
    if (firstName) updateData.firstName = firstName.trim();
    if (lastName) updateData.lastName = lastName.trim();
    
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        error: 'No valid fields provided for update'
      });
    }
    
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');
    
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
        isVerified: updatedUser.isVerified,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt
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

// Change password (requires authentication)
router.put('/change-password', verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'Current password and new password are required'
      });
    }
    
    console.log(`Password change request for user: ${req.user.email}`);
    
    const User = require('../models/User');
    const bcrypt = require('bcryptjs');
    
    // Get user with password field
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }
    
    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        error: 'Current password is incorrect'
      });
    }
    
    // Hash new password
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);
    
    // Update password
    await User.findByIdAndUpdate(req.user._id, {
      password: hashedNewPassword,
      updatedAt: new Date()
    });
    
    console.log(`Password updated successfully for user: ${req.user.email}`);
    
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

// Logout (invalidate token - client-side implementation)
router.post('/logout', verifyToken, async (req, res) => {
  try {
    console.log(`User logged out: ${req.user.email}`);
    
    // In a more advanced implementation, you might maintain a blacklist of tokens
    // For now, we'll just return success and let the client remove the token
    
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

// Refresh token (optional - if you implement refresh token logic)
router.post('/refresh-token', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(401).json({
        error: 'Refresh token is required'
      });
    }
    
    // Verify refresh token (implement your refresh token logic here)
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    
    const User = require('../models/User');
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }
    
    // Generate new access token
    const newToken = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    console.log(`Token refreshed for user: ${user.email}`);
    
    res.status(200).json({
      message: 'Token refreshed successfully',
      token: newToken,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isVerified: user.isVerified
      }
    });
    
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({ 
      error: 'Invalid refresh token',
      details: error.message 
    });
  }
});

// Get user statistics (admin route)
router.get('/stats', verifyToken, async (req, res) => {
  try {
    // You might want to add admin role check here
    
    const User = require('../models/User');
    
    const totalUsers = await User.countDocuments();
    const verifiedUsers = await User.countDocuments({ isVerified: true });
    const unverifiedUsers = totalUsers - verifiedUsers;
    
    const stats = {
      totalUsers,
      verifiedUsers,
      unverifiedUsers,
      verificationRate: totalUsers > 0 ? Math.round((verifiedUsers / totalUsers) * 100) : 0
    };
    
    console.log('User statistics requested by:', req.user.email);
    
    res.status(200).json({
      message: 'User statistics retrieved successfully',
      stats
    });
    
  } catch (error) {
    console.error('Error getting user stats:', error);
    res.status(500).json({
      error: 'Failed to get user statistics'
    });
  }
});

module.exports = router;