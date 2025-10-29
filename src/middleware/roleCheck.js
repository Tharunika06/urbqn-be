// src/middleware/roleCheck.js
exports.requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required',
      authenticated: false 
    });
  }
  
  if (req.user.role !== 'admin') {
    console.log(`Access denied for ${req.user.email}: Not an admin (Role: ${req.user.role})`);
    return res.status(403).json({ 
      error: 'Access denied. Admin privileges required.',
      requiredRole: 'admin',
      currentRole: req.user.role
    });
  }
  
  console.log(`Admin access granted to: ${req.user.email}`);
  next();
};

// Middleware to check if user is regular user (optional)
exports.requireUser = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required',
      authenticated: false 
    });
  }
  
  // Allow both user and admin to access user routes
  if (req.user.role !== 'user' && req.user.role !== 'admin') {
    return res.status(403).json({ 
      error: 'Invalid user role'
    });
  }
  
  next();
};