// src/controllers/authController.js
const User = require('../models/User');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { createNotification } = require('./notificationController');
const { validateAndNormalizeEmail, normalizeEmail } = require('../utils/emailUtils');

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

// Utility: Set httpOnly cookie
const setTokenCookie = (res, token) => {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 'none' for cross-origin in production
    maxAge: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    path: '/'
  };

  res.cookie('authToken', token, cookieOptions);
};

// Utility: Clear token cookie
const clearTokenCookie = (res) => {
  res.clearCookie('authToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/'
  });
};

// Utility: Standardized error response
const sendError = (res, statusCode, message, details = null) => {
  const response = { ok: false, error: message };
  if (details && process.env.NODE_ENV === 'development') {
    response.details = details;
  }
  return res.status(statusCode).json(response);
};

// Utility: Standardized success response
const sendSuccess = (res, statusCode, message, data = {}) => {
  return res.status(statusCode).json({ ok: true, message, ...data });
};

// ========== PUBLIC AUTHENTICATION METHODS ==========

// SIGNUP - Always creates users with 'user' role
exports.signup = async (req, res) => {
  try {
    const { email: rawEmail, password, firstName, lastName } = req.body;
    
    // Validate and normalize email
    const emailValidation = validateAndNormalizeEmail(rawEmail);
    if (!emailValidation.isValid) {
      return sendError(res, 400, emailValidation.error);
    }
    const email = emailValidation.email;

    // Validate password
    if (!password) {
      return sendError(res, 400, 'Password is required');
    }

    if (password.length < 6) {
      return sendError(res, 400, 'Password must be at least 6 characters long');
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return sendError(res, 409, 'Email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Create user with 'user' role
    const newUser = new User({
      email,
      password: hashedPassword,
      firstName: firstName?.trim() || '',
      lastName: lastName?.trim() || '',
      otp,
      otpExpires: new Date(Date.now() + 10 * 60 * 1000),
      role: 'user',
      isVerified: false
    });
    
    await newUser.save();

    // Send OTP email
    try {
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
    } catch (emailError) {
      console.error("Email sending error:", emailError);
      // Delete user if email fails
      await User.findByIdAndDelete(newUser._id);
      return sendError(res, 500, 'Failed to send verification email. Please try again.');
    }

    // Create signup notification
    try {
      await createNotification({
        type: 'signup',
        title: 'New User Registration',
        message: `${firstName || 'User'} (${email}) registered from mobile app`,
        userName: `${firstName || ''} ${lastName || ''}`.trim() || email,
        userImage: null,
        userId: newUser._id,
        metadata: {
          email,
          signupTime: new Date(),
          platform: 'mobile',
          status: 'pending_verification'
        }
      });
    } catch (notifError) {
      console.error("Notification error:", notifError);
      // Don't fail signup if notification fails
    }

    console.log(`✅ New user signup: ${email} (Role: user)`);

    return sendSuccess(res, 201, 'Signup successful. OTP sent to email for verification.', {
      email
    });

  } catch (err) {
    console.error("❌ Signup error:", err);
    if (err.name === 'ValidationError') {
      return sendError(res, 400, 'Invalid user data', err.message);
    }
    return sendError(res, 500, 'Signup failed. Please try again.', err.message);
  }
};

// VERIFY OTP
exports.verifyCode = async (req, res) => {
  try {
    const { email: rawEmail, otp } = req.body;
    
    // Validate inputs
    if (!rawEmail || !otp) {
      return sendError(res, 400, 'Email and OTP are required');
    }

    // Normalize email
    const email = normalizeEmail(rawEmail);
    if (!email) {
      return sendError(res, 400, 'Invalid email format');
    }

    const user = await User.findOne({ email });
    if (!user) {
      return sendError(res, 404, 'User not found');
    }

    if (user.isVerified) {
      return sendError(res, 400, 'Email already verified');
    }

    if (!user.otp || !user.otpExpires) {
      return sendError(res, 400, 'No OTP found. Please request a new one.');
    }

    if (user.otpExpires < Date.now()) {
      return sendError(res, 400, 'OTP has expired. Please request a new one.');
    }

    if (user.otp !== otp.trim()) {
      return sendError(res, 400, 'Invalid OTP');
    }

    // Clear OTP and mark as verified
    user.otp = null;
    user.otpExpires = null;
    user.isVerified = true;
    await user.save();

    // Auto-login: Generate token and set cookie
    const token = createToken(user);
    setTokenCookie(res, token);

    console.log(`✅ User verified and logged in: ${user.email}`);

    return sendSuccess(res, 200, 'Email verified successfully', {
      user: { 
        id: user._id, 
        email: user.email, 
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        isVerified: true
      }
    });

  } catch (err) {
    console.error("❌ OTP verification error:", err);
    return sendError(res, 500, 'OTP verification failed', err.message);
  }
};

// REGULAR LOGIN (for mobile app users)
exports.login = async (req, res) => {
  try {
    const { email: rawEmail, password } = req.body;
    
    // Validate inputs
    if (!rawEmail || !password) {
      return sendError(res, 400, 'Email and password are required');
    }

    // Normalize email
    const email = normalizeEmail(rawEmail);
    if (!email) {
      return sendError(res, 400, 'Invalid email format');
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return sendError(res, 401, 'Invalid email or password');
    }

    // Verify password
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return sendError(res, 401, 'Invalid email or password');
    }

    // Check if user is verified
    if (!user.isVerified) {
      return res.status(403).json({ 
        ok: false,
        error: 'Please verify your email first',
        requiresVerification: true,
        email: user.email
      });
    }

    // Generate token and set cookie
    const token = createToken(user);
    setTokenCookie(res, token);

    // Create login notification
    try {
      await createNotification({
        type: 'login',
        title: 'User Login',
        message: `${user.firstName || 'User'} (${user.email}) logged in from mobile app`,
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
    } catch (notifError) {
      console.error("Notification error:", notifError);
    }

    console.log(`✅ User logged in: ${user.email} (Role: ${user.role})`);

    return sendSuccess(res, 200, 'Login successful', {
      user: { 
        id: user._id, 
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        isVerified: user.isVerified
      }
    });

  } catch (err) {
    console.error("❌ Login error:", err);
    return sendError(res, 500, 'Login failed. Please try again.', err.message);
  }
};

// ADMIN LOGIN (for admin dashboard)
exports.adminLogin = async (req, res) => {
  try {
    const { email: rawEmail, password } = req.body;
    
    // Validate inputs
    if (!rawEmail || !password) {
      return sendError(res, 400, 'Email and password are required');
    }

    // Normalize email
    const email = normalizeEmail(rawEmail);
    if (!email) {
      return sendError(res, 400, 'Invalid email format');
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return sendError(res, 401, 'Invalid credentials');
    }

    // Verify password
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return sendError(res, 401, 'Invalid credentials');
    }

    // Check admin role
    if (user.role !== 'admin') {
      console.log(`⚠️ Unauthorized admin login attempt by: ${user.email} (Role: ${user.role})`);
      return sendError(res, 403, 'Access denied. Admin privileges required.');
    }

    // Generate token and set cookie
    const token = createToken(user);
    setTokenCookie(res, token);

    // Create admin login notification
    try {
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
    } catch (notifError) {
      console.error("Notification error:", notifError);
    }

    console.log(`✅ Admin logged in: ${user.email}`);

    return sendSuccess(res, 200, 'Admin login successful', {
      user: { 
        id: user._id, 
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName
      }
    });

  } catch (err) {
    console.error("❌ Admin login error:", err);
    return sendError(res, 500, 'Login failed. Please try again.', err.message);
  }
};

// FORGOT PASSWORD
exports.forgotPassword = async (req, res) => {
  try {
    const { email: rawEmail } = req.body;
    
    // Validate and normalize email
    const emailValidation = validateAndNormalizeEmail(rawEmail);
    if (!emailValidation.isValid) {
      return sendError(res, 400, emailValidation.error);
    }
    const email = emailValidation.email;

    const user = await User.findOne({ email });
    
    // Always return success to prevent email enumeration
    if (!user) {
      return sendSuccess(res, 200, 'If the email exists, an OTP has been sent.');
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    // Send OTP email
    try {
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
    } catch (emailError) {
      console.error("❌ Email sending error:", emailError);
      return sendError(res, 500, 'Failed to send OTP. Please try again.');
    }

    console.log(`✅ Password reset OTP sent to: ${email}`);

    return sendSuccess(res, 200, 'OTP sent successfully to your email');

  } catch (err) {
    console.error("❌ Forgot Password error:", err);
    return sendError(res, 500, 'Error processing request', err.message);
  }
};

// VERIFY RESET OTP
exports.verifyResetOtp = async (req, res) => {
  try {
    const { email: rawEmail, otp } = req.body;
    
    // Validate inputs
    if (!rawEmail || !otp) {
      return sendError(res, 400, 'Email and OTP are required');
    }

    // Normalize email
    const email = normalizeEmail(rawEmail);
    if (!email) {
      return sendError(res, 400, 'Invalid email format');
    }

    const user = await User.findOne({ email });
    if (!user) {
      return sendError(res, 404, 'User not found');
    }

    if (!user.otp || !user.otpExpires) {
      return sendError(res, 400, 'No OTP found. Please request a new one.');
    }

    if (user.otpExpires < Date.now()) {
      return sendError(res, 400, 'OTP has expired. Please request a new one.');
    }

    if (user.otp !== otp.trim()) {
      return sendError(res, 400, 'Invalid OTP');
    }

    console.log(`✅ Reset OTP verified for: ${email}`);

    return sendSuccess(res, 200, 'OTP verified successfully. You can now reset your password.');

  } catch (err) {
    console.error("❌ Reset OTP verification error:", err);
    return sendError(res, 500, 'OTP verification failed', err.message);
  }
};

// RESET PASSWORD
exports.resetPassword = async (req, res) => {
  try {
    const { email: rawEmail, password, otp } = req.body;
    
    // Validate inputs
    if (!rawEmail || !password || !otp) {
      return sendError(res, 400, 'Email, OTP, and new password are required');
    }

    if (password.length < 6) {
      return sendError(res, 400, 'Password must be at least 6 characters long');
    }

    // Normalize email
    const email = normalizeEmail(rawEmail);
    if (!email) {
      return sendError(res, 400, 'Invalid email format');
    }

    const user = await User.findOne({ email });
    if (!user) {
      return sendError(res, 404, 'User not found');
    }

    if (!user.otp || !user.otpExpires) {
      return sendError(res, 400, 'No OTP found. Please request a new one.');
    }

    if (user.otpExpires < Date.now()) {
      return sendError(res, 400, 'OTP has expired. Please request a new one.');
    }

    if (user.otp !== otp.trim()) {
      return sendError(res, 400, 'Invalid OTP');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    user.otp = null;
    user.otpExpires = null;
    await user.save();

    console.log(`✅ Password reset successful for: ${email}`);

    return sendSuccess(res, 200, 'Password reset successful. You can now login with your new password.');

  } catch (err) {
    console.error("❌ Reset password error:", err);
    return sendError(res, 500, 'Password reset failed', err.message);
  }
};

// ========== AUTHENTICATED USER METHODS ==========

// GET CURRENT USER PROFILE
exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password -otp -otpExpires');
    
    if (!user) {
      return sendError(res, 404, 'User not found');
    }

    return sendSuccess(res, 200, 'Current user retrieved successfully', {
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });

  } catch (error) {
    console.error('❌ Error getting current user:', error);
    return sendError(res, 500, 'Failed to get current user', error.message);
  }
};

// UPDATE USER PROFILE
exports.updateProfile = async (req, res) => {
  try {
    const { firstName, lastName } = req.body;
    
    // Prevent role modification
    if (req.body.role) {
      return sendError(res, 403, 'Role modification is not allowed');
    }
    
    // Whitelist allowed fields
    const updateData = {};
    if (firstName !== undefined) updateData.firstName = firstName.trim();
    if (lastName !== undefined) updateData.lastName = lastName.trim();
    
    if (Object.keys(updateData).length === 0) {
      return sendError(res, 400, 'No valid fields provided for update');
    }
    
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password -otp -otpExpires');
    
    if (!updatedUser) {
      return sendError(res, 404, 'User not found');
    }
    
    console.log(`✅ User profile updated: ${updatedUser.email}`);
    
    return sendSuccess(res, 200, 'User profile updated successfully', {
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
    console.error('❌ Error updating user profile:', error);
    if (error.name === 'ValidationError') {
      return sendError(res, 400, 'Invalid update data', error.message);
    }
    return sendError(res, 500, 'Failed to update user profile', error.message);
  }
};

// CHANGE PASSWORD
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return sendError(res, 400, 'Current password and new password are required');
    }

    if (newPassword.length < 6) {
      return sendError(res, 400, 'New password must be at least 6 characters long');
    }

    if (currentPassword === newPassword) {
      return sendError(res, 400, 'New password must be different from current password');
    }
    
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return sendError(res, 404, 'User not found');
    }
    
    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    
    if (!isCurrentPasswordValid) {
      return sendError(res, 400, 'Current password is incorrect');
    }
    
    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password
    user.password = hashedNewPassword;
    await user.save();
    
    console.log(`✅ Password changed for user: ${req.user.email}`);
    
    return sendSuccess(res, 200, 'Password updated successfully');
    
  } catch (error) {
    console.error('❌ Error changing password:', error);
    return sendError(res, 500, 'Failed to change password', error.message);
  }
};

// LOGOUT
exports.logout = async (req, res) => {
  try {
    // Clear the authentication cookie
    clearTokenCookie(res);
    
    console.log(`✅ User logged out: ${req.user.email}`);
    return sendSuccess(res, 200, 'Logged out successfully');
  } catch (error) {
    console.error('❌ Error during logout:', error);
    return sendError(res, 500, 'Logout failed', error.message);
  }
};

// ========== ADMIN ONLY METHODS ==========

// GET ALL USERS (Admin only)
exports.getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    if (page < 1 || limit < 1 || limit > 100) {
      return sendError(res, 400, 'Invalid pagination parameters');
    }
    
    const users = await User.find()
      .select('-password -otp -otpExpires')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const totalUsers = await User.countDocuments();
    
    console.log(`✅ Admin ${req.user.email} fetched user list (Page ${page})`);
    
    return sendSuccess(res, 200, 'Users retrieved successfully', {
      count: users.length,
      totalUsers,
      page,
      totalPages: Math.ceil(totalUsers / limit),
      users
    });

  } catch (error) {
    console.error('❌ Error getting users:', error);
    return sendError(res, 500, 'Failed to get users', error.message);
  }
};

// GET USER STATISTICS (Admin only)
exports.getUserStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const verifiedUsers = await User.countDocuments({ isVerified: true });
    const adminCount = await User.countDocuments({ role: 'admin' });
    const userCount = await User.countDocuments({ role: 'user' });
    
    console.log(`✅ Admin ${req.user.email} fetched user statistics`);
    
    return sendSuccess(res, 200, 'User statistics retrieved successfully', {
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
    console.error('❌ Error getting user stats:', error);
    return sendError(res, 500, 'Failed to get user statistics', error.message);
  }
};

// UPDATE USER ROLE (Admin only)
exports.updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    
    if (!role || !['user', 'admin'].includes(role)) {
      return sendError(res, 400, 'Invalid role. Must be "user" or "admin"');
    }

    if (userId === req.user.id) {
      return sendError(res, 400, 'You cannot change your own role');
    }
    
    const user = await User.findByIdAndUpdate(
      userId,
      { role },
      { new: true }
    ).select('-password -otp -otpExpires');
    
    if (!user) {
      return sendError(res, 404, 'User not found');
    }
    
    console.log(`✅ Admin ${req.user.email} changed role of ${user.email} to ${role}`);
    
    return sendSuccess(res, 200, 'User role updated successfully', {
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName
      }
    });

  } catch (error) {
    console.error('❌ Error updating user role:', error);
    if (error.name === 'CastError') {
      return sendError(res, 400, 'Invalid user ID');
    }
    return sendError(res, 500, 'Failed to update user role', error.message);
  }
};

// DELETE USER (Admin only)
exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (userId === req.user.id) {
      return sendError(res, 400, 'You cannot delete your own account');
    }
    
    const user = await User.findByIdAndDelete(userId);
    
    if (!user) {
      return sendError(res, 404, 'User not found');
    }
    
    console.log(`⚠️ Admin ${req.user.email} deleted user: ${user.email}`);
    
    return sendSuccess(res, 200, 'User deleted successfully', {
      deletedUser: {
        id: user._id,
        email: user.email
      }
    });

  } catch (error) {
    console.error('❌ Error deleting user:', error);
    if (error.name === 'CastError') {
      return sendError(res, 400, 'Invalid user ID');
    }
    return sendError(res, 500, 'Failed to delete user', error.message);
  }
};