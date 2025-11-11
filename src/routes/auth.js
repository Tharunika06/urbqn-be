// src/routes/auth.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/roleCheck');

// ========== PUBLIC ROUTES (No authentication required) ==========

// User Signup
router.post('/signup', authController.signup);

// Verify OTP after signup
router.post('/verify-code', authController.verifyCode);

// Regular user login (Mobile App)
router.post('/login', authController.login);

// Admin login (Admin Dashboard)
router.post('/admin-login', authController.adminLogin);

// Forgot password
router.post('/forgot-password', authController.forgotPassword);

// Verify reset OTP
router.post('/verify-reset-otp', authController.verifyResetOtp);

// Reset password
router.post('/reset-password', authController.resetPassword);

// ========== AUTHENTICATED ROUTES (Requires valid JWT) ==========

// Get current user profile
router.get('/me', verifyToken, authController.getCurrentUser);

// Update user profile
router.put('/me', verifyToken, authController.updateProfile);

// Change password (authenticated users)
router.put('/change-password', verifyToken, authController.changePassword);

// Logout
router.post('/logout', verifyToken, authController.logout);

// ========== ADMIN ONLY ROUTES (Requires admin role) ==========

// Get all users (Admin only)
router.get('/admin/users', verifyToken, requireAdmin, authController.getAllUsers);

// Get user statistics (Admin only)
router.get('/admin/user-stats', verifyToken, requireAdmin, authController.getUserStats);

// Update user role (Admin only)
router.put('/admin/users/:userId/role', verifyToken, requireAdmin, authController.updateUserRole);

// Delete user (Admin only)
router.delete('/admin/users/:userId', verifyToken, requireAdmin, authController.deleteUser);

module.exports = router;