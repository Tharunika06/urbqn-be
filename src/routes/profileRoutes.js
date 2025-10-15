const express = require("express");
const router = express.Router();

const { 
  addProfile, 
  getProfileById,
  getProfileByUserId, 
  getAllProfiles,
  updateProfile,
  updateProfileByEmail,
  updateProfilePhotoByEmail,
  updateProfilePhotoById,
  deleteProfile,
  checkEmailExists,
  getProfilePhoto,
  removeProfilePhoto,
  getProfileByEmail,
  getProfileStats,
  getProfilesWithoutPhotos,
  searchProfiles,
  bulkDeleteProfiles
} = require("../controllers/profileController");

// --- Utility Routes (MUST come before parameterized routes) ---

// Get profile statistics
router.get('/stats', getProfileStats);

// Get profiles without photos (for debugging/migration)
router.get('/utils/no-photos', getProfilesWithoutPhotos);

// Get profile by email
router.get('/by-email/:email', getProfileByEmail);

// Update profile by email
router.put('/by-email/:email', updateProfileByEmail);

// Update profile photo by email
router.patch('/by-email/:email/photo', updateProfilePhotoByEmail);

// Check if email exists
router.get('/check-email/:email', checkEmailExists);

// Search profiles by name or email
router.get('/search/:query', searchProfiles);

// --- Main Profile Routes ---

// Get all profiles (with optional photo exclusion for performance)
// Usage: GET /profiles OR GET /profiles?includePhotos=false
router.get('/', getAllProfiles);

// Add new profile with duplicate email check
router.post('/', addProfile);

// Alternative route for compatibility (if frontend uses /add-profile)
router.post('/add-profile', addProfile);

// Get profile by user ID (if using authentication)
router.get('/user/:userId', getProfileByUserId);

// Get single profile by ID with photo
router.get('/:id', getProfileById);

// Update profile with duplicate email check
router.put('/:id', updateProfile);

// Delete profile
router.delete('/:id', deleteProfile);

// --- Photo-specific Routes ---

// Get only profile photo (separate endpoint for performance)
router.get('/:id/photo', getProfilePhoto);

// Update only profile photo with proper validation
router.patch('/:id/photo', updateProfilePhotoById);

// Remove profile photo
router.delete('/:id/photo', removeProfilePhoto);

// Bulk operations
router.post('/bulk/delete', bulkDeleteProfiles);

module.exports = router;