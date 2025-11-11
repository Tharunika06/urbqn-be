// backend/src/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/User'); // ✅ Use User model (where admin login happens)

/**
 * ✅ Verify JWT Token and Authenticate Admin
 */
const verifyToken = async (req, res, next) => {
  try {
    console.log('\n=== AUTH MIDDLEWARE ===');
    console.log('🍪 Cookies:', req.cookies);
    console.log('🔑 Auth header:', req.headers.authorization);

    // ✅ Try to get token from cookie first
    let token = req.cookies?.authToken;

    // ✅ If no cookie, try Authorization header
    if (!token && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      }
    }

    if (!token) {
      console.log('❌ No token found in cookies or headers');
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    console.log('🔍 Token found, verifying...');

    // ✅ Verify the JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ Token decoded:', { id: decoded.id, email: decoded.email, role: decoded.role });

    // ✅ Find user in database (admin is stored in User collection)
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      console.log('❌ User not found in database');
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    // ✅ Check if user is verified
    if (!user.isVerified) {
      console.log('❌ User not verified');
      return res.status(401).json({
        success: false,
        message: 'Account not verified'
      });
    }

    // ✅ Attach user to request (call it 'admin' for admin routes compatibility)
    req.admin = {
      id: user._id,
      email: user.email,
      role: user.role
    };
    
    // Also attach as 'user' for backward compatibility
    req.user = req.admin;

    console.log('✅ User authenticated:', user.email, '(Role:', user.role, ')');
    console.log('===================\n');

    next();

  } catch (error) {
    console.error('❌ Auth middleware error:', error.message);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please login again.'
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Authentication error',
      error: error.message
    });
  }
};

/**
 * ✅ Require Admin Role
 */
const requireAdmin = async (req, res, next) => {
  try {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (req.admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Authorization error',
      error: error.message
    });
  }
};

// ✅ Export both functions
module.exports = {
  verifyToken,
  requireAdmin
};