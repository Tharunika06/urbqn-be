// src/middleware/roleCheck.js

// Admin authorization middleware
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      ok: false,
      error: 'Authentication required' 
    });
  }

  if (req.user.role !== 'admin') {
    console.log(`⚠️ Unauthorized admin access attempt by: ${req.user.email} (Role: ${req.user.role})`);
    return res.status(403).json({ 
      ok: false,
      error: 'Admin privileges required. Access denied.',
      currentRole: req.user.role
    });
  }

  next();
};

// Owner authorization middleware
const requireOwner = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      ok: false,
      error: 'Authentication required' 
    });
  }

  if (req.user.role !== 'owner' && req.user.role !== 'admin') {
    console.log(`⚠️ Unauthorized owner access attempt by: ${req.user.email} (Role: ${req.user.role})`);
    return res.status(403).json({ 
      ok: false,
      error: 'Owner privileges required. Access denied.',
      currentRole: req.user.role
    });
  }

  next();
};

// User authorization middleware (verified users only)
const requireVerifiedUser = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      ok: false,
      error: 'Authentication required' 
    });
  }

  if (!req.user.isVerified) {
    return res.status(403).json({ 
      ok: false,
      error: 'Email verification required. Please verify your email first.',
      requiresVerification: true
    });
  }

  next();
};

// Check if user owns the resource
const requireResourceOwner = (resourceUserIdField = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        ok: false,
        error: 'Authentication required' 
      });
    }

    // Admin can access any resource
    if (req.user.role === 'admin') {
      return next();
    }

    // Check if user owns the resource
    const resourceUserId = req.params[resourceUserIdField] || req.body[resourceUserIdField];
    
    if (!resourceUserId) {
      return res.status(400).json({ 
        ok: false,
        error: 'Resource owner information missing' 
      });
    }

    if (resourceUserId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ 
        ok: false,
        error: 'Access denied. You can only access your own resources.' 
      });
    }

    next();
  };
};

module.exports = {
  requireAdmin,
  requireOwner,
  requireVerifiedUser,
  requireResourceOwner
};