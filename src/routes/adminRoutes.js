// src/routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { uploadAdminPhoto } = require('../middleware/upload');

// Get admin profile
router.get('/profile', adminController.getProfile);

// Update admin profile with optional photo upload
router.put('/profile', uploadAdminPhoto, adminController.updateProfile);

// Delete admin photo
router.delete('/profile/photo', adminController.deletePhoto);

module.exports = router;
