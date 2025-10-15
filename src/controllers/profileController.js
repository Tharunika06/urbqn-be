const Profile = require("../models/Profile");

// ✅ SINGLE utility function for processing dates of birth
const processDateOfBirth = (dob) => {
  if (!dob || (typeof dob === 'string' && dob.trim() === '')) {
    return null;
  }
  
  try {
    let dateStr = typeof dob === 'string' ? dob.trim() : String(dob);
    
    // If already in YYYY-MM-DD format, return as-is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }
    
    // Handle DD/MM/YYYY or DD-MM-YYYY
    const ddmmyyyyMatch = dateStr.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
    if (ddmmyyyyMatch) {
      const [, day, month, year] = ddmmyyyyMatch;
      return `${year}-${month}-${day}`;
    }
    
    // Handle MM/DD/YYYY or MM-DD-YYYY
    const mmddyyyyMatch = dateStr.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
    if (mmddyyyyMatch) {
      const [, month, day, year] = mmddyyyyMatch;
      return `${year}-${month}-${day}`;
    }
    
    // If ISO string with time, extract date portion
    if (dateStr.includes('T') || dateStr.includes(':')) {
      const dateOnlyMatch = dateStr.match(/^(\d{4}-\d{2}-\d{2})/);
      if (dateOnlyMatch) {
        return dateOnlyMatch[1];
      }
    }
    
    // Last resort: parse with Date object using UTC
    const dobDate = new Date(dateStr);
    if (!isNaN(dobDate.getTime())) {
      const year = dobDate.getUTCFullYear();
      const month = String(dobDate.getUTCMonth() + 1).padStart(2, '0');
      const day = String(dobDate.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    console.warn('Unable to parse date:', dateStr);
    return null;
    
  } catch (error) {
    console.warn('Date parsing error:', error);
    return null;
  }
};

// Add new profile
const addProfile = async (req, res) => {
  try {
    const { firstName, lastName, dob, email, phone, gender, photo, userId } = req.body;

    console.log('Adding new profile...');
    console.log('Request body:', { firstName, lastName, email, phone, dob });
    console.log('Has photo base64:', !!photo);

    // Validation
    if (!firstName || !lastName || !email) {
      return res.status(400).json({ 
        error: "First name, last name, and email are required" 
      });
    }

    // Check if profile exists
    const existingProfile = await Profile.findOne({ 
      email: email.trim().toLowerCase() 
    });
    
    if (existingProfile) {
      console.log(`Profile already exists for email: ${email}`);
      return res.status(409).json({ 
        error: "A profile with this email already exists",
        existingProfile: {
          id: existingProfile._id,
          name: `${existingProfile.firstName} ${existingProfile.lastName}`,
          email: existingProfile.email
        }
      });
    }

    // Validate photo format
    if (photo) {
      const photoPrefix = photo.substring(0, 50);
      console.log('Photo format:', photoPrefix + '...');
      console.log('Photo size:', photo.length, 'characters');
      
      const base64Regex = /^data:image\/(jpeg|jpg|png|gif|webp|bmp|svg\+xml);base64,/i;
      if (!base64Regex.test(photo)) {
        console.error('Invalid photo format:', photoPrefix);
        return res.status(400).json({ 
          error: "Invalid photo format. Expected: data:image/[type];base64,[data]" 
        });
      }
    }

    // Process date of birth
    const processedDob = processDateOfBirth(dob);
    console.log('Date processing:', { 
      original: dob, 
      processed: processedDob 
    });

    // Create profile data
    const profileData = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone ? phone.trim() : '',
      dob: processedDob,
      gender: gender ? gender.toLowerCase() : '',
      photo: photo || null,
      userId: userId || null
    };

    console.log('Creating profile with processed data:', {
      ...profileData,
      photo: !!profileData.photo ? '[BASE64_DATA]' : null,
      dob: profileData.dob
    });

    const newProfile = new Profile(profileData);
    const savedProfile = await newProfile.save();
    
    console.log(`New profile created with ID: ${savedProfile._id}`);
    console.log(`Email: ${savedProfile.email}`);
    console.log(`DOB stored as: ${savedProfile.dob} (type: ${typeof savedProfile.dob})`);
    console.log(`Photo stored as base64: ${!!savedProfile.photo}`);
    
    res.status(201).json({
      message: "Profile created successfully",
      profile: {
        ...savedProfile.toObject(),
        hasPhoto: !!savedProfile.photo
      }
    });
    
  } catch (err) {
    console.error("Error creating profile:", err.message);
    
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      res.status(400).json({ error: errors.join(', ') });
    } else if (err.code === 11000) {
      console.error("Duplicate key error:", err.keyPattern);
      res.status(409).json({ 
        error: "A profile with this information already exists",
        duplicateField: Object.keys(err.keyPattern)[0]
      });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
};

// Get profile by ID
const getProfileById = async (req, res) => {
  try {
    const profileId = req.params.id;
    console.log(`Fetching profile with ID: ${profileId}`);

    const profile = await Profile.findById(profileId);
    
    if (!profile) {
      console.log(`Profile not found: ${profileId}`);
      return res.status(404).json({ error: "Profile not found" });
    }

    console.log(`Profile found: ${profile.firstName} ${profile.lastName}`);
    console.log(`DOB: ${profile.dob} (type: ${typeof profile.dob})`);
    console.log(`Has photo: ${!!profile.photo}`);

    res.status(200).json({
      ...profile.toObject(),
      hasPhoto: !!profile.photo
    });
    
  } catch (err) {
    console.error('Error fetching profile:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get profile by user ID
const getProfileByUserId = async (req, res) => {
  try {
    const userId = req.params.userId;
    console.log(`Fetching profile for user ID: ${userId}`);
    
    const profile = await Profile.findOne({ userId: userId });
    
    if (!profile) {
      console.log(`Profile not found for user: ${userId}`);
      return res.status(404).json({ error: "Profile not found for this user" });
    }

    console.log(`Profile found: ${profile.firstName} ${profile.lastName}`);
    console.log(`DOB: ${profile.dob}`);
    console.log(`Has photo: ${!!profile.photo}`);

    res.status(200).json({
      ...profile.toObject(),
      hasPhoto: !!profile.photo
    });
    
  } catch (err) {
    console.error('Error fetching profile:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get all profiles
const getAllProfiles = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const includePhotos = req.query.includePhotos !== 'false';

    console.log('Fetching all profiles...');
    console.log(`Page: ${page}, Limit: ${limit}`);
    console.log(`Include photos: ${includePhotos}`);

    let query = Profile.find().skip(skip).limit(limit).sort({ createdAt: -1 });
    
    if (!includePhotos) {
      query = query.select('-photo');
      console.log('Excluding photos for better performance');
    }

    const profiles = await query;
    const total = await Profile.countDocuments();
    
    console.log(`Found ${profiles.length} profiles (total: ${total})`);
    
    res.status(200).json({
      profiles: profiles.map(profile => ({
        ...profile.toObject(),
        hasPhoto: !!profile.photo
      })),
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalProfiles: total,
      includePhotos
    });
    
  } catch (err) {
    console.error('Error fetching profiles:', err);
    res.status(500).json({ error: err.message });
  }
};

// Update profile by email
const updateProfileByEmail = async (req, res) => {
  try {
    const { email } = req.params;
    const { firstName, lastName, dob, phone, gender, photo } = req.body;

    const decodedEmail = decodeURIComponent(email).toLowerCase();
    console.log(`Updating profile with email: ${decodedEmail}`);

    const existingProfile = await Profile.findOne({ email: decodedEmail });
    
    if (!existingProfile) {
      console.log(`Profile not found for email: ${decodedEmail}`);
      return res.status(404).json({ 
        error: "Profile not found",
        email: decodedEmail
      });
    }

    // Validate photo
    if (photo) {
      const base64Regex = /^data:image\/(jpeg|jpg|png|gif|webp|bmp|svg\+xml);base64,/i;
      if (!base64Regex.test(photo)) {
        return res.status(400).json({ 
          error: "Invalid photo format. Expected: data:image/[type];base64,[data]" 
        });
      }
      console.log(`New photo provided (${photo.length} characters)`);
    }

    // Process date of birth
    let processedDob = existingProfile.dob;
    if (dob !== undefined) {
      processedDob = processDateOfBirth(dob);
      console.log('Date update:', { 
        original: dob, 
        processed: processedDob,
        type: typeof processedDob
      });
    }

    // Build update data
    const updateData = {};
    if (firstName !== undefined && firstName !== null) {
      updateData.firstName = firstName.trim();
    }
    if (lastName !== undefined && lastName !== null) {
      updateData.lastName = lastName.trim();
    }
    if (phone !== undefined && phone !== null) {
      updateData.phone = phone.trim();
    }
    if (gender !== undefined && gender !== null) {
      updateData.gender = gender.toLowerCase();
    }
    if (photo !== undefined && photo !== null) {
      updateData.photo = photo;
    }
    if (dob !== undefined) {
      updateData.dob = processedDob;
    }

    console.log('Update data keys:', Object.keys(updateData));
    console.log('DOB value:', updateData.dob);

    const updatedProfile = await Profile.findOneAndUpdate(
      { email: decodedEmail },
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedProfile) {
      console.log(`Failed to update profile for email: ${decodedEmail}`);
      return res.status(404).json({ error: "Profile not found during update" });
    }

    console.log(`Profile updated for email: ${decodedEmail}`);
    console.log(`Updated DOB: ${updatedProfile.dob} (type: ${typeof updatedProfile.dob})`);
    console.log(`Has photo: ${!!updatedProfile.photo}`);
    
    res.status(200).json({
      message: "Profile updated successfully",
      profile: {
        ...updatedProfile.toObject(),
        hasPhoto: !!updatedProfile.photo
      }
    });

  } catch (err) {
    console.error("Error updating profile by email:", err);
    
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ error: errors.join(', ') });
    }
    
    res.status(500).json({ 
      error: "Internal server error",
      message: err.message 
    });
  }
};

// Update profile photo by email
const updateProfilePhotoByEmail = async (req, res) => {
  try {
    const { email } = req.params;
    const { photo } = req.body;

    const decodedEmail = decodeURIComponent(email).toLowerCase();
    console.log(`Updating photo for email: ${decodedEmail}`);

    if (!photo) {
      return res.status(400).json({ error: "Photo data is required" });
    }

    // Validate photo format
    const base64Regex = /^data:image\/(jpeg|jpg|png|gif|webp|bmp|svg\+xml);base64,/i;
    if (!base64Regex.test(photo)) {
      return res.status(400).json({ 
        error: "Invalid photo format. Expected: data:image/[type];base64,[data]" 
      });
    }

    console.log(`Valid photo format detected (${photo.length} characters)`);

    const updatedProfile = await Profile.findOneAndUpdate(
      { email: decodedEmail },
      { photo: photo },
      { new: true, runValidators: true }
    );

    if (!updatedProfile) {
      return res.status(404).json({ 
        error: "Profile not found for this email",
        email: decodedEmail
      });
    }

    console.log(`Photo updated for profile: ${updatedProfile._id}`);
    
    res.status(200).json({
      message: "Profile photo updated successfully",
      profile: {
        id: updatedProfile._id,
        name: `${updatedProfile.firstName} ${updatedProfile.lastName}`,
        email: updatedProfile.email,
        hasPhoto: !!updatedProfile.photo
      }
    });

  } catch (err) {
    console.error("Error updating profile photo:", err);
    res.status(500).json({ 
      error: "Internal server error",
      message: err.message 
    });
  }
};

// Update profile by ID (backward compatibility)
const updateProfile = async (req, res) => {
  try {
    const profileId = req.params.id;
    const { firstName, lastName, dob, email, phone, gender, photo } = req.body;

    console.log(`Updating profile with ID: ${profileId}`);

    const existingProfile = await Profile.findById(profileId);
    if (!existingProfile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    // Check email uniqueness if changing
    if (email && email.trim().toLowerCase() !== existingProfile.email) {
      const emailExists = await Profile.findOne({ 
        email: email.trim().toLowerCase(),
        _id: { $ne: profileId }
      });
      
      if (emailExists) {
        return res.status(409).json({ 
          error: "A profile with this email already exists",
          existingEmail: email.trim().toLowerCase()
        });
      }
    }

    // Validate photo
    if (photo) {
      const base64Regex = /^data:image\/(jpeg|jpg|png|gif|webp|bmp|svg\+xml);base64,/i;
      if (!base64Regex.test(photo)) {
        return res.status(400).json({ 
          error: "Invalid photo format. Expected: data:image/[type];base64,[data]" 
        });
      }
      console.log(`New photo provided (${photo.length} characters)`);
    }

    // Process date of birth
    let processedDob = existingProfile.dob;
    if (dob !== undefined) {
      processedDob = processDateOfBirth(dob);
      console.log('Date update:', { 
        original: dob, 
        processed: processedDob 
      });
    }

    const updateData = {
      ...(firstName && { firstName: firstName.trim() }),
      ...(lastName && { lastName: lastName.trim() }),
      ...(email && { email: email.trim().toLowerCase() }),
      ...(phone !== undefined && { phone: phone ? phone.trim() : '' }),
      ...(dob !== undefined && { dob: processedDob }),
      ...(gender !== undefined && { gender: gender ? gender.toLowerCase() : '' }),
      ...(photo !== undefined && { photo: photo })
    };

    const updatedProfile = await Profile.findByIdAndUpdate(
      profileId,
      updateData,
      { new: true, runValidators: true }
    );

    console.log(`Profile updated: ${profileId}`);
    console.log(`Updated DOB: ${updatedProfile.dob}`);
    console.log(`Has photo: ${!!updatedProfile.photo}`);
    
    res.status(200).json({
      message: "Profile updated successfully",
      profile: {
        ...updatedProfile.toObject(),
        hasPhoto: !!updatedProfile.photo
      }
    });

  } catch (err) {
    console.error("Error updating profile:", err);
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ error: errors.join(', ') });
    }
    res.status(500).json({ error: err.message });
  }
};

// Delete profile
const deleteProfile = async (req, res) => {
  try {
    const profileId = req.params.id;
    console.log('Attempting to delete profile with ID:', profileId);

    const deletedProfile = await Profile.findByIdAndDelete(profileId);
    
    if (!deletedProfile) {
      console.log('Profile not found with ID:', profileId);
      return res.status(404).json({ error: "Profile not found" });
    }
    
    console.log('Profile deleted successfully:', profileId);
    
    res.status(200).json({ 
      message: "Profile deleted successfully",
      deletedProfile: {
        id: deletedProfile._id,
        name: `${deletedProfile.firstName} ${deletedProfile.lastName}`
      }
    });
    
  } catch (err) {
    console.error('Error deleting profile:', err);
    res.status(500).json({ error: err.message });
  }
};

// Check if email exists
const checkEmailExists = async (req, res) => {
  try {
    const { email } = req.params;
    const decodedEmail = decodeURIComponent(email).toLowerCase();
    console.log(`Checking if email exists: ${decodedEmail}`);
    
    const profile = await Profile.findOne({ email: decodedEmail });
    
    console.log(`Email exists: ${!!profile}`);
    
    res.status(200).json({ 
      exists: !!profile,
      email: decodedEmail,
      profile: profile ? {
        id: profile._id,
        name: `${profile.firstName} ${profile.lastName}`,
        dob: profile.dob,
        hasPhoto: !!profile.photo
      } : null
    });
    
  } catch (err) {
    console.error('Error checking email:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get profile photo
const getProfilePhoto = async (req, res) => {
  try {
    const profileId = req.params.id;
    console.log(`Fetching photo for profile: ${profileId}`);

    const profile = await Profile.findById(profileId).select('photo firstName lastName');

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    if (!profile.photo) {
      return res.status(404).json({ error: 'Profile has no photo' });
    }

    console.log(`Photo found for profile: ${profileId}`);

    res.status(200).json({
      id: profile._id,
      name: `${profile.firstName} ${profile.lastName}`,
      photo: profile.photo
    });

  } catch (error) {
    console.error('Error fetching profile photo:', error);
    res.status(500).json({ error: 'Failed to fetch profile photo' });
  }
};

// Update profile photo by ID
const updateProfilePhotoById = async (req, res) => {
  try {
    const profileId = req.params.id;
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

    console.log(`Updating photo for profile: ${profileId} (${photo.length} characters)`);

    const updatedProfile = await Profile.findByIdAndUpdate(
      profileId,
      { photo: photo },
      { new: true, runValidators: true }
    );

    if (!updatedProfile) {
      return res.status(404).json({
        error: 'Profile not found'
      });
    }

    console.log(`Photo updated for profile: ${profileId}`);

    res.status(200).json({
      message: 'Profile photo updated successfully',
      profileId: updatedProfile.profileId || updatedProfile._id,
      mongoId: updatedProfile._id,
      name: `${updatedProfile.firstName} ${updatedProfile.lastName}`,
      hasPhoto: !!updatedProfile.photo
    });

  } catch (error) {
    console.error('Error updating profile photo:', error);
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ error: errors.join(', ') });
    }
    res.status(500).json({
      error: 'Failed to update profile photo'
    });
  }
};

// Remove profile photo
const removeProfilePhoto = async (req, res) => {
  try {
    const profileId = req.params.id;
    
    const updatedProfile = await Profile.findByIdAndUpdate(
      profileId,
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

    console.log(`Removed photo for profile: ${profileId}`);

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
};

// Get profile by email
const getProfileByEmail = async (req, res) => {
  try {
    const email = req.params.email;
    const decodedEmail = decodeURIComponent(email).toLowerCase();
    console.log(`Fetching profile for email: ${decodedEmail}`);
    
    const profile = await Profile.findOne({ 
      email: decodedEmail 
    });
    
    if (!profile) {
      console.log(`Profile not found for email: ${decodedEmail}`);
      return res.status(404).json({ 
        error: "Profile not found for this email",
        email: decodedEmail
      });
    }

    console.log(`Profile found: ${profile.firstName} ${profile.lastName}`);
    console.log(`Profile ID: ${profile.profileId || 'Legacy'}`);
    console.log(`Has photo: ${!!profile.photo}`);

    res.status(200).json({
      message: "Profile found successfully",
      profile: {
        ...profile.toObject(),
        hasPhoto: !!profile.photo
      }
    });
    
  } catch (err) {
    console.error('Error fetching profile by email:', err);
    res.status(500).json({ 
      error: 'Failed to fetch profile by email',
      details: err.message 
    });
  }
};

// Get profile statistics
const getProfileStats = async (req, res) => {
  try {
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
};

// Get profiles without photos
const getProfilesWithoutPhotos = async (req, res) => {
  try {
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
};

// Search profiles by name or email
const searchProfiles = async (req, res) => {
  try {
    const searchQuery = req.params.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    console.log(`Searching profiles for: "${searchQuery}"`);

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

    console.log(`Found ${profiles.length} matching profiles (total: ${total})`);

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
    console.error('Error searching profiles:', error);
    res.status(500).json({
      error: 'Failed to search profiles'
    });
  }
};

// Bulk delete profiles
const bulkDeleteProfiles = async (req, res) => {
  try {
    const { profileIds } = req.body; // Array of profile IDs
    
    if (!Array.isArray(profileIds) || profileIds.length === 0) {
      return res.status(400).json({
        error: 'profileIds must be a non-empty array'
      });
    }

    console.log(`Bulk deleting ${profileIds.length} profiles:`, profileIds);
    
    // Delete by MongoDB ObjectId
    const result = await Profile.deleteMany({
      _id: { $in: profileIds }
    });

    console.log(`Bulk delete completed. Deleted: ${result.deletedCount} profiles`);

    res.status(200).json({
      message: `Bulk delete completed`,
      requested: profileIds.length,
      deleted: result.deletedCount,
      profileIds: profileIds
    });

  } catch (error) {
    console.error('Error in bulk delete:', error);
    res.status(500).json({
      error: 'Failed to perform bulk delete: ' + error.message
    });
  }
};

module.exports = { 
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
};