// backend/src/routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const adminController = require('../controllers/adminController');
const { verifyToken, requireAdmin } = require('../middleware/authMiddleware');

// ✅ Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// ✅ IMPORTANT: Don't apply middleware here - it's already applied in index.js
// The routes are already protected by verifyToken + requireAdmin

/**
 * ✅ Get admin profile
 */
router.get('/profile', adminController.getProfile);

/**
 * ✅ Update admin profile (with file upload support)
 */
router.put('/profile', upload.single('profilePhoto'), adminController.updateProfile);

/**
 * ✅ Delete admin photo
 */
router.delete('/profile/photo', adminController.deletePhoto);

/**
 * ✅ Logout admin
 */
router.post('/logout', adminController.logout);

module.exports = router;