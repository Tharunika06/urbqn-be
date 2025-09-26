const express = require("express");
const router = express.Router();

const { 
  addProfile, 
  getProfileById,
  getProfileByUserId, 
  getAllProfiles,
  updateProfile,
  updateProfileByEmail,
  updateProfilePhotoByEmail, // NEW: Import the photo update function
  deleteProfile,
  checkEmailExists,
  getProfilePhoto
} = require("../controllers/profileController");

// --- Utility Routes (MUST come before parameterized routes) ---

// Get profile statistics
router.get('/stats', async (req, res) => {
  try {
    const Profile = require('../models/Profile');
    
    const totalProfiles = await Profile.countDocuments();
    const profilesWithPhotos = await Profile.countDocuments({ photo: { $exists: true, $ne: null } });
    const profilesWithoutPhotos = totalProfiles - profilesWithPhotos;
    
    // Get highest profile ID if using counter system
    const latestProfile = await Profile.findOne().sort({ profileId: -1 }).select('profileId');
    const highestProfileId = latestProfile ? latestProfile.profileId : 0;
    
    const stats = {
      totalProfiles,
      profilesWithPhotos,
      profilesWithoutPhotos,
      photoPercentage: totalProfiles > 0 ? Math.round((profilesWithPhotos / totalProfiles) * 100) : 0,
      highestProfileId,
      nextProfileId: highestProfileId + 1
    };
    
    console.log('Profile statistics requested:', stats);
    
    res.status(200).json({
      message: 'Profile statistics retrieved successfully',
      stats
    });

  } catch (error) {
    console.error('Error getting profile stats:', error);
    res.status(500).json({
      error: 'Failed to get profile statistics'
    });
  }
});

// Get profiles without photos (for debugging/migration)
router.get('/utils/no-photos', async (req, res) => {
  try {
    const Profile = require('../models/Profile');
    const profilesWithoutPhotos = await Profile.find({
      $or: [
        { photo: { $exists: false } },
        { photo: null },
        { photo: '' }
      ]
    }).select('profileId firstName lastName email').sort({ profileId: 1 });
    
    console.log(`Found ${profilesWithoutPhotos.length} profiles without photos`);
    
    res.status(200).json({
      message: 'Profiles without photos retrieved successfully',
      count: profilesWithoutPhotos.length,
      profiles: profilesWithoutPhotos
    });

  } catch (error) {
    console.error('Error finding profiles without photos:', error);
    res.status(500).json({
      error: 'Failed to find profiles without photos'
    });
  }
});

// Get profile by email - FIXED: Returns single profile (not multiple)
router.get('/by-email/:email', async (req, res) => {
  try {
    const email = req.params.email;
    const decodedEmail = decodeURIComponent(email).toLowerCase();
    console.log(`🔍 Fetching profile for email: ${decodedEmail}`);
    
    const Profile = require('../models/Profile');
    
    const profile = await Profile.findOne({ 
      email: decodedEmail 
    });
    
    if (!profile) {
      console.log(`❌ Profile not found for email: ${decodedEmail}`);
      return res.status(404).json({ 
        error: "Profile not found for this email",
        email: decodedEmail
      });
    }

    console.log(`✅ Profile found: ${profile.firstName} ${profile.lastName}`);
    console.log(`🆔 Profile ID: ${profile.profileId || 'Legacy'}`);
    console.log(`📸 Has photo: ${!!profile.photo}`);

    res.status(200).json({
      message: "Profile found successfully",
      profile: {
        ...profile.toObject(),
        hasPhoto: !!profile.photo
      }
    });
    
  } catch (err) {
    console.error('❌ Error fetching profile by email:', err);
    res.status(500).json({ 
      error: 'Failed to fetch profile by email',
      details: err.message 
    });
  }
});

// Update profile by email - FIXED
router.put('/by-email/:email', updateProfileByEmail);

// FIXED: Update profile photo by email - Now uses the controller function
router.patch('/by-email/:email/photo', updateProfilePhotoByEmail);

// Check if email exists - Enhanced response
router.get('/check-email/:email', checkEmailExists);

// Search profiles by name or email
router.get('/search/:query', async (req, res) => {
  try {
    const searchQuery = req.params.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    console.log(`🔍 Searching profiles for: "${searchQuery}"`);

    const Profile = require('../models/Profile');
    
    // Create search regex (case insensitive)
    const searchRegex = new RegExp(searchQuery, 'i');
    
    const searchFilter = {
      $or: [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex }
      ]
    };

    const profiles = await Profile.find(searchFilter)
      .select('-photo') // Exclude photos for performance
      .skip(skip)
      .limit(limit)
      .sort({ profileId: -1 });

    const total = await Profile.countDocuments(searchFilter);

    console.log(`✅ Found ${profiles.length} matching profiles (total: ${total})`);

    res.status(200).json({
      message: `Search results for "${searchQuery}"`,
      profiles: profiles.map(profile => ({
        ...profile.toObject(),
        hasPhoto: !!profile.photo
      })),
      searchQuery,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalResults: total
    });

  } catch (error) {
    console.error('❌ Error searching profiles:', error);
    res.status(500).json({
      error: 'Failed to search profiles'
    });
  }
});

// --- Main Profile Routes ---

// Get all profiles (with optional photo exclusion for performance)
// Usage: GET /profiles OR GET /profiles?includePhotos=false
router.get('/', getAllProfiles);

// FIXED: Add new profile with duplicate email check
router.post('/', addProfile);

// Alternative route for compatibility (if frontend uses /add-profile)
router.post('/add-profile', addProfile);

// Get profile by user ID (if using authentication)
router.get('/user/:userId', getProfileByUserId);

// Get single profile by ID with photo
router.get('/:id', getProfileById);

// FIXED: Update profile with duplicate email check
router.put('/:id', updateProfile);

// Delete profile
router.delete('/:id', deleteProfile);

// --- Photo-specific Routes ---

// Get only profile photo (separate endpoint for performance)
router.get('/:id/photo', getProfilePhoto);

// FIXED: Update only profile photo with proper validation
router.patch('/:id/photo', async (req, res) => {
  try {
    const { photo } = req.body;
    
    if (!photo) {
      return res.status(400).json({
        error: 'No photo provided'
      });
    }

    // Validate base64 format
    const base64Regex = /^data:image\/(jpeg|jpg|png|gif|webp|bmp|svg\+xml);base64,/i;
    if (!base64Regex.test(photo)) {
      return res.status(400).json({
        error: 'Invalid photo format. Must be a valid base64 data URL.'
      });
    }

    console.log(`📸 Updating photo for profile: ${req.params.id} (${photo.length} characters)`);

    const Profile = require('../models/Profile');
    const updatedProfile = await Profile.findByIdAndUpdate(
      req.params.id,
      { photo: photo },
      { new: true, runValidators: true }
    );

    if (!updatedProfile) {
      return res.status(404).json({
        error: 'Profile not found'
      });
    }

    console.log(`✅ Photo updated for profile: ${req.params.id}`);

    res.status(200).json({
      message: 'Profile photo updated successfully',
      profileId: updatedProfile.profileId || updatedProfile._id,
      mongoId: updatedProfile._id,
      name: `${updatedProfile.firstName} ${updatedProfile.lastName}`,
      hasPhoto: !!updatedProfile.photo
    });

  } catch (error) {
    console.error('❌ Error updating profile photo:', error);
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ error: errors.join(', ') });
    }
    res.status(500).json({
      error: 'Failed to update profile photo'
    });
  }
});

// Remove profile photo
router.delete('/:id/photo', async (req, res) => {
  try {
    const Profile = require('../models/Profile');
    
    const updatedProfile = await Profile.findByIdAndUpdate(
      req.params.id,
      { 
        $unset: { photo: 1 }
      },
      { new: true, runValidators: false }
    );

    if (!updatedProfile) {
      return res.status(404).json({
        error: 'Profile not found'
      });
    }

    console.log(`Removed photo for profile: ${req.params.id}`);

    res.status(200).json({
      message: 'Profile photo removed successfully',
      profileId: updatedProfile.profileId || updatedProfile._id,
      mongoId: updatedProfile._id,
      name: `${updatedProfile.firstName} ${updatedProfile.lastName}`,
      hasPhoto: false
    });

  } catch (error) {
    console.error('Error removing profile photo:', error);
    res.status(500).json({
      error: 'Failed to remove profile photo'
    });
  }
});

// Bulk operations
router.post('/bulk/delete', async (req, res) => {
  try {
    const { profileIds } = req.body; // Array of profile IDs
    
    if (!Array.isArray(profileIds) || profileIds.length === 0) {
      return res.status(400).json({
        error: 'profileIds must be a non-empty array'
      });
    }

    console.log(`🗑️ Bulk deleting ${profileIds.length} profiles:`, profileIds);

    const Profile = require('../models/Profile');
    
    // Delete by MongoDB ObjectId
    const result = await Profile.deleteMany({
      _id: { $in: profileIds }
    });

    console.log(`✅ Bulk delete completed. Deleted: ${result.deletedCount} profiles`);

    res.status(200).json({
      message: `Bulk delete completed`,
      requested: profileIds.length,
      deleted: result.deletedCount,
      profileIds: profileIds
    });

  } catch (error) {
    console.error('❌ Error in bulk delete:', error);
    res.status(500).json({
      error: 'Failed to perform bulk delete: ' + error.message
    });
  }
});

module.exports = router;