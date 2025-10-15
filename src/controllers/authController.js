// src/controllers/authController.js
const User = require('../models/User');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { createNotification } = require('./notificationController');

// Email transporter configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Utility: Create JWT token
const createToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    process.env.JWT_SECRET || "secretKey",
    { expiresIn: "24h" }
  );
};

// ========== PUBLIC AUTHENTICATION METHODS ==========

// SIGNUP - Always creates users with 'user' role
exports.signup = async (req, res) => {
  const { email, password, firstName, lastName } = req.body;
  
  try {
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email and password are required' 
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ 
        error: 'Email already exists' 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // SECURITY: Always create as 'user', ignore any role in request body
    const newUser = new User({
      email: email.toLowerCase(),
      password: hashedPassword,
      firstName: firstName?.trim(),
      lastName: lastName?.trim(),
      otp,
      otpExpires: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      role: 'user', // Hardcoded, never trust req.body.role
      isVerified: false
    });
    
    await newUser.save();

    // Send OTP email
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Urban Signup OTP Verification',
      html: `
        <h3>Welcome to Urban!</h3>
        <p>Your OTP for email verification is:</p>
        <h1 style="color: #4CAF50;">${otp}</h1>
        <p>This code will expire in 10 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `
    });

    // Create signup notification for admin
    await createNotification({
      type: 'signup',
      title: 'New User Registration',
      message: `${firstName || 'User'} ${email || ''} registered from mobile app`,
      userName: `${firstName || ''} ${lastName || ''}`.trim() || email,
      userImage: null,
      userId: newUser._id,
      metadata: {
        email: email.toLowerCase(),
        signupTime: new Date(),
        platform: 'mobile',
        status: 'pending_verification'
      }
    });

    console.log(`New user signup: ${email} (Role: user)`);

    res.status(200).json({ 
      ok: true, 
      message: "Signup successful. OTP sent to email for verification." 
    });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ 
      error: 'Signup failed. Please try again.',
      details: err.message 
    });
  }
};

// VERIFY OTP
exports.verifyCode = async (req, res) => {
  const { email, otp } = req.body;
  
  try {
    if (!email || !otp) {
      return res.status(400).json({ 
        error: 'Email and OTP are required' 
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found' 
      });
    }

    // Validate OTP
    const isOtpValid = user.otp === otp && user.otpExpires > Date.now();
    if (!isOtpValid) {
      return res.status(400).json({ 
        error: 'Invalid or expired OTP' 
      });
    }

    // Clear OTP and mark as verified
    user.otp = null;
    user.otpExpires = null;
    user.isVerified = true;
    await user.save();

    // Auto-login: Generate token
    const token = createToken(user);

    console.log(`User verified and logged in: ${user.email}`);

    res.status(200).json({
      ok: true,
      message: 'Email verified successfully',
      user: { 
        id: user._id, 
        email: user.email, 
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        isVerified: true
      },
      token
    });
  } catch (err) {
    console.error("OTP verification error:", err);
    res.status(500).json({ 
      error: 'OTP verification failed',
      details: err.message 
    });
  }
};

// REGULAR LOGIN (for mobile app users)
exports.login = async (req, res) => {
  const { email, password } = req.body;
  
  try {
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email and password are required' 
      });
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ 
        error: 'Invalid email or password' 
      });
    }

    // Verify password
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ 
        error: 'Invalid email or password' 
      });
    }

    // Check if user is verified
    if (!user.isVerified) {
      return res.status(403).json({ 
        error: 'Please verify your email first',
        requiresVerification: true,
        email: user.email
      });
    }

    // Generate token
    const token = createToken(user);

    // Create login notification for admin
    await createNotification({
      type: 'login',
      title: 'User Login',
      message: `${user.firstName || 'User'} ${user.email || ''} logged in from mobile app`,
      userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      userImage: user.profileImage || null,
      userId: user._id,
      metadata: {
        email: user.email,
        loginTime: new Date(),
        platform: 'mobile',
        userAgent: req.headers['user-agent'] || 'Unknown',
        role: user.role
      }
    });

    console.log(`User logged in: ${user.email} (Role: ${user.role})`);

    res.status(200).json({
      ok: true,
      message: 'Login successful',
      user: { 
        id: user._id, 
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        isVerified: user.isVerified
      },
      token
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ 
      error: 'Login failed',
      details: err.message 
    });
  }
};

// ADMIN LOGIN (for admin dashboard)
exports.adminLogin = async (req, res) => {
  const { email, password } = req.body;
  
  try {
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email and password are required' 
      });
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ 
        error: 'Invalid credentials' 
      });
    }

    // Verify password
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ 
        error: 'Invalid credentials' 
      });
    }

    // CRITICAL: Check if user has admin role
    if (user.role !== 'admin') {
      console.log(`⚠️ Unauthorized admin login attempt by: ${user.email} (Role: ${user.role})`);
      return res.status(403).json({ 
        error: 'Access denied. Admin privileges required.',
        currentRole: user.role
      });
    }

    // Generate token
    const token = createToken(user);

    // Create admin login notification
    await createNotification({
      type: 'admin_action',
      title: 'Admin Login',
      message: `Admin ${user.firstName || 'Administrator'} logged in to dashboard`,
      userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      userImage: user.profileImage || null,
      userId: user._id,
      metadata: {
        email: user.email,
        loginTime: new Date(),
        platform: 'web-dashboard',
        ipAddress: req.ip || req.connection.remoteAddress,
        role: 'admin'
      }
    });

    console.log(`✅ Admin logged in: ${user.email}`);

    res.status(200).json({
      ok: true,
      message: 'Admin login successful',
      user: { 
        id: user._id, 
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName
      },
      token
    });
  } catch (err) {
    console.error("Admin login error:", err);
    res.status(500).json({ 
      error: 'Login failed',
      details: err.message 
    });
  }
};

// FORGOT PASSWORD
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  
  try {
    if (!email) {
      return res.status(400).json({ 
        error: 'Email is required' 
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Don't reveal if user exists or not (security best practice)
      return res.status(200).json({ 
        ok: true, 
        message: 'If the email exists, an OTP has been sent.' 
      });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    // Send OTP email
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Reset Your Password - OTP Verification',
      html: `
        <h3>Password Reset Request</h3>
        <p>Your password reset OTP is:</p>
        <h1 style="color: #f44336;">${otp}</h1>
        <p>This code will expire in 10 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `
    });

    console.log(`Password reset OTP sent to: ${email}`);

    res.status(200).json({ 
      ok: true, 
      message: 'OTP sent successfully to your email' 
    });
  } catch (err) {
    console.error("Forgot Password error:", err);
    res.status(500).json({ 
      error: 'Error sending OTP',
      details: err.message 
    });
  }
};

// VERIFY RESET OTP
exports.verifyResetOtp = async (req, res) => {
  const { email, otp } = req.body;
  
  try {
    if (!email || !otp) {
      return res.status(400).json({ 
        error: 'Email and OTP are required' 
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found' 
      });
    }

    // Validate OTP
    const isOtpValid = user.otp === otp && user.otpExpires > Date.now();
    if (!isOtpValid) {
      return res.status(400).json({ 
        error: 'Invalid or expired OTP' 
      });
    }

    // Don't clear OTP yet - wait for password reset
    console.log(`Reset OTP verified for: ${email}`);

    res.status(200).json({ 
      ok: true,
      message: 'OTP verified successfully. You can now reset your password.' 
    });
  } catch (err) {
    console.error("Reset OTP verification error:", err);
    res.status(500).json({ 
      error: 'OTP verification failed',
      details: err.message 
    });
  }
};

// RESET PASSWORD
exports.resetPassword = async (req, res) => {
  const { email, password, otp } = req.body;
  
  try {
    if (!email || !password || !otp) {
      return res.status(400).json({ 
        error: 'Email, OTP, and new password are required' 
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found' 
      });
    }

    // Verify OTP one more time
    const isOtpValid = user.otp === otp && user.otpExpires > Date.now();
    if (!isOtpValid) {
      return res.status(400).json({ 
        error: 'Invalid or expired OTP' 
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    user.otp = null;
    user.otpExpires = null;
    await user.save();

    console.log(`Password reset successful for: ${email}`);

    res.status(200).json({ 
      ok: true, 
      message: 'Password reset successful. You can now login with your new password.' 
    });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ 
      error: 'Password reset failed',
      details: err.message 
    });
  }
};

// ========== AUTHENTICATED USER METHODS ==========

// GET CURRENT USER PROFILE
exports.getCurrentUser = async (req, res) => {
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
};

// UPDATE USER PROFILE
exports.updateProfile = async (req, res) => {
  try {
    const { firstName, lastName } = req.body;
    
    // SECURITY: Prevent role modification
    if (req.body.role) {
      return res.status(403).json({ 
        error: 'Role modification is not allowed through this endpoint' 
      });
    }
    
    // Whitelist allowed fields
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
};

// CHANGE PASSWORD
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'Current password and new password are required'
      });
    }
    
    // Get user with password
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
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password
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
};

// LOGOUT
exports.logout = async (req, res) => {
  try {
    console.log(`User logged out: ${req.user.email}`);
    
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
};

// ========== ADMIN ONLY METHODS ==========

// GET ALL USERS (Admin only)
exports.getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const users = await User.find()
      .select('-password -otp -otpExpires')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const totalUsers = await User.countDocuments();
    
    console.log(`Admin ${req.user.email} fetched user list (Page ${page})`);
    
    res.status(200).json({
      message: 'Users retrieved successfully',
      count: users.length,
      totalUsers,
      page,
      totalPages: Math.ceil(totalUsers / limit),
      users
    });
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).json({ 
      error: 'Failed to get users',
      details: error.message 
    });
  }
};

// GET USER STATISTICS (Admin only)
exports.getUserStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const verifiedUsers = await User.countDocuments({ isVerified: true });
    const adminCount = await User.countDocuments({ role: 'admin' });
    const userCount = await User.countDocuments({ role: 'user' });
    
    console.log(`Admin ${req.user.email} fetched user statistics`);
    
    res.status(200).json({
      message: 'User statistics retrieved successfully',
      stats: {
        totalUsers,
        verifiedUsers,
        unverifiedUsers: totalUsers - verifiedUsers,
        adminCount,
        userCount,
        verificationRate: totalUsers > 0 ? Math.round((verifiedUsers / totalUsers) * 100) : 0
      }
    });
  } catch (error) {
    console.error('Error getting user stats:', error);
    res.status(500).json({ 
      error: 'Failed to get user statistics',
      details: error.message 
    });
  }
};

// UPDATE USER ROLE (Admin only)
exports.updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    
    if (!role || !['user', 'admin'].includes(role)) {
      return res.status(400).json({ 
        error: 'Invalid role. Must be "user" or "admin"' 
      });
    }
    
    const user = await User.findByIdAndUpdate(
      userId,
      { role },
      { new: true }
    ).select('-password -otp -otpExpires');
    
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found' 
      });
    }
    
    console.log(`✅ Admin ${req.user.email} changed role of ${user.email} to ${role}`);
    
    res.status(200).json({
      message: 'User role updated successfully',
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName
      }
    });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({ 
      error: 'Failed to update user role',
      details: error.message 
    });
  }
};

// DELETE USER (Admin only)
exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Prevent admin from deleting themselves
    if (userId === req.user._id.toString()) {
      return res.status(400).json({
        error: 'You cannot delete your own account'
      });
    }
    
    const user = await User.findByIdAndDelete(userId);
    
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found' 
      });
    }
    
    console.log(`⚠️ Admin ${req.user.email} deleted user: ${user.email}`);
    
    res.status(200).json({
      message: 'User deleted successfully',
      deletedUser: {
        id: user._id,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ 
      error: 'Failed to delete user',
      details: error.message 
    });
  }
};