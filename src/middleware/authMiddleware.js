// src/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to verify JWT token
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Access denied. No token provided or invalid format.',
        authenticated: false
      });
    }

    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Access denied. No token provided.',
        authenticated: false
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    const user = await User.findById(decoded.id || decoded.userId).select('-password');
    
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found. Token may be invalid.',
        authenticated: false
      });
    }

    // Attach user to request
    req.user = user;
    next();
    
  } catch (error) {
    console.error('Token verification error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Invalid token format.',
        authenticated: false
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token has expired. Please log in again.',
        authenticated: false
      });
    }
    
    res.status(401).json({ 
      error: 'Token verification failed.',
      authenticated: false,
      details: error.message 
    });
  }
};

// Middleware to verify admin role
const verifyAdmin = async (req, res, next) => {
  try {
    // Check if verifyToken was already called
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required. Please use verifyToken middleware first.',
        authenticated: false
      });
    }

    // Check if user has admin role
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Access denied. Admin privileges required.',
        authorized: false
      });
    }

    // User is admin, proceed
    next();
    
  } catch (error) {
    console.error('Admin verification error:', error);
    res.status(403).json({ 
      error: 'Authorization failed.',
      authorized: false,
      details: error.message 
    });
  }
};

// Middleware to verify user role (for regular users)
const verifyUser = async (req, res, next) => {
  try {
    // Check if verifyToken was already called
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required. Please use verifyToken middleware first.',
        authenticated: false
      });
    }

    // Check if user has user role
    if (req.user.role !== 'user') {
      return res.status(403).json({ 
        error: 'Access denied. User privileges required.',
        authorized: false
      });
    }

    // User has correct role, proceed
    next();
    
  } catch (error) {
    console.error('User verification error:', error);
    res.status(403).json({ 
      error: 'Authorization failed.',
      authorized: false,
      details: error.message 
    });
  }
};

// Middleware to verify either admin or the owner of the resource
const verifyOwnerOrAdmin = (resourceIdParam = 'id') => {
  return async (req, res, next) => {
    try {
      // Check if verifyToken was already called
      if (!req.user) {
        return res.status(401).json({ 
          error: 'Authentication required. Please use verifyToken middleware first.',
          authenticated: false
        });
      }

      const userId = req.user._id.toString();
      const resourceUserId = req.params[resourceIdParam];

      // Allow if user is admin or owns the resource
      if (req.user.role === 'admin' || userId === resourceUserId) {
        return next();
      }

      return res.status(403).json({ 
        error: 'Access denied. You can only access your own resources.',
        authorized: false
      });
      
    } catch (error) {
      console.error('Owner/Admin verification error:', error);
      res.status(403).json({ 
        error: 'Authorization failed.',
        authorized: false,
        details: error.message 
      });
    }
  };
};

// Export all middleware functions
module.exports = {
  verifyToken,
  verifyAdmin,
  verifyUser,
  verifyOwnerOrAdmin
};