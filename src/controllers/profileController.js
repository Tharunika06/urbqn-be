const Profile = require("../models/Profile");

// Utility function for processing dates of birth
const processDateOfBirth = (dob) => {
  if (!dob || (typeof dob === 'string' && dob.trim() === '')) {
    return null;
  }
  
  try {
    let dateStr = typeof dob === 'string' ? dob.trim() : dob;
    
    // If it's already in YYYY-MM-DD format, use it directly
    if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }
    
    // Parse the date and extract components to avoid timezone issues
    const dobDate = new Date(dateStr);
    if (!isNaN(dobDate.getTime())) {
      // Extract date components to ensure consistent format
      const year = dobDate.getFullYear();
      const month = String(dobDate.getMonth() + 1).padStart(2, '0');
      const day = String(dobDate.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    // If parsing fails, return as string if it looks like a date
    if (typeof dateStr === 'string' && dateStr.includes('-')) {
      return dateStr;
    }
    
    return null;
    
  } catch (error) {
    console.warn('⚠️ Date parsing error:', error);
    return null;
  }
};

// Add new profile - Checks for existing email and auto-generates profileId
const addProfile = async (req, res) => {
  try {
    const { firstName, lastName, dob, email, phone, gender, photo, userId } = req.body;

    console.log('📝 Adding new profile...');
    console.log('📄 Request body:', { firstName, lastName, email, phone });
    console.log('📸 Has photo base64:', !!photo);

    // Validation
    if (!firstName || !lastName || !email) {
      return res.status(400).json({ error: "First name, last name, and email are required" });
    }

    // Check if profile with this email already exists
    const existingProfile = await Profile.findOne({ email: email.trim().toLowerCase() });
    if (existingProfile) {
      console.log(`❌ Profile already exists for email: ${email}`);
      return res.status(409).json({ 
        error: "A profile with this email already exists",
        existingProfile: {
          id: existingProfile._id,
          name: `${existingProfile.firstName} ${existingProfile.lastName}`,
          email: existingProfile.email
        }
      });
    }

    if (photo) {
      // Log the photo format for debugging
      const photoPrefix = photo.substring(0, 50);
      console.log('📸 Photo format:', photoPrefix + '...');
      console.log('📏 Photo size:', photo.length, 'characters');
      
      // Validate base64 format
      const base64Regex = /^data:image\/(jpeg|jpg|png|gif|webp|bmp|svg\+xml);base64,/i;
      if (!base64Regex.test(photo)) {
        console.error('❌ Invalid photo format:', photoPrefix);
        return res.status(400).json({ 
          error: "Invalid photo format. Expected: data:image/[type];base64,[data]" 
        });
      }
    }

    // Process date of birth with improved function
    const processedDob = processDateOfBirth(dob);
    console.log('📅 Date processing:', { original: dob, processed: processedDob });

    // Generate auto-incrementing profileId
    const lastProfile = await Profile.findOne().sort({ profileId: -1 });
    const nextProfileId = lastProfile && lastProfile.profileId ? lastProfile.profileId + 1 : 1;

    // Create profile data - Auto-generate profileId, exclude problematic fields
    const profileData = {
      profileId: nextProfileId, // Auto-increment starting from 1
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone ? phone.trim() : '',
      dob: processedDob, // Now properly formatted as YYYY-MM-DD string
      gender: gender ? gender.toLowerCase() : '',
      photo: photo || null // Store base64 data URL directly
      // userId removed entirely to prevent unique constraint conflicts
    };

    console.log('✅ Creating profile with processed data:', {
      ...profileData,
      photo: !!profileData.photo ? '[BASE64_DATA]' : null // Don't log the full base64
    });

    const newProfile = new Profile(profileData);
    const savedProfile = await newProfile.save();
    
    console.log(`✅ New profile created with ID: ${savedProfile._id}`);
    console.log(`🆔 Profile ID: ${savedProfile.profileId}`);
    console.log(`📧 Email: ${savedProfile.email}`);
    console.log(`📅 DOB stored as: ${savedProfile.dob}`);
    console.log(`📸 Photo stored as base64: ${!!savedProfile.photo}`);
    
    res.status(201).json({
      message: "Profile created successfully",
      profile: {
        ...savedProfile.toObject(),
        hasPhoto: !!savedProfile.photo
      }
    });
    
  } catch (err) {
    console.error("❌ Error creating profile:", err.message);
    
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      res.status(400).json({ error: errors.join(', ') });
    } else if (err.code === 11000) {
      // Handle duplicate key error (if there are still unique indexes)
      console.error("❌ Duplicate key error:", err.keyPattern);
      res.status(409).json({ 
        error: "A profile with this information already exists",
        duplicateField: Object.keys(err.keyPattern)[0]
      });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
};

// Other controllers (unchanged)
const getProfileById = async (req, res) => {
  try {
    const profileId = req.params.id;
    console.log(`🔍 Fetching profile with ID: ${profileId}`);

    const profile = await Profile.findById(profileId);
    
    if (!profile) {
      console.log(`❌ Profile not found: ${profileId}`);
      return res.status(404).json({ error: "Profile not found" });
    }

    console.log(`✅ Profile found: ${profile.firstName} ${profile.lastName}`);
    console.log(`📸 Has photo: ${!!profile.photo}`);

    res.status(200).json({
      ...profile.toObject(),
      hasPhoto: !!profile.photo
    });
    
  } catch (err) {
    console.error('❌ Error fetching profile:', err);
    res.status(500).json({ error: err.message });
  }
};

const getProfileByUserId = async (req, res) => {
  try {
    const userId = req.params.userId;
    console.log(`🔍 Fetching profile for user ID: ${userId}`);
    
    const profile = await Profile.findOne({ userId: userId });
    
    if (!profile) {
      console.log(`❌ Profile not found for user: ${userId}`);
      return res.status(404).json({ error: "Profile not found for this user" });
    }

    console.log(`✅ Profile found: ${profile.firstName} ${profile.lastName}`);
    console.log(`📸 Has photo: ${!!profile.photo}`);

    res.status(200).json({
      ...profile.toObject(),
      hasPhoto: !!profile.photo
    });
    
  } catch (err) {
    console.error('❌ Error fetching profile:', err);
    res.status(500).json({ error: err.message });
  }
};

const getAllProfiles = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const includePhotos = req.query.includePhotos !== 'false';

    console.log('📋 Fetching all profiles...');
    console.log(`📄 Page: ${page}, Limit: ${limit}`);
    console.log(`📸 Include photos: ${includePhotos}`);

    let query = Profile.find().skip(skip).limit(limit).sort({ createdAt: -1 });
    
    if (!includePhotos) {
      query = query.select('-photo');
      console.log('⚡ Excluding photos for better performance');
    }

    const profiles = await query;
    const total = await Profile.countDocuments();
    
    console.log(`✅ Found ${profiles.length} profiles (total: ${total})`);
    
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
    console.error('❌ Error fetching profiles:', err);
    res.status(500).json({ error: err.message });
  }
};

// FIXED: Update profile by email with improved date handling
const updateProfileByEmail = async (req, res) => {
  try {
    const { email } = req.params;
    const { firstName, lastName, dob, phone, gender, photo } = req.body;

    // Decode the email from URL encoding
    const decodedEmail = decodeURIComponent(email).toLowerCase();
    console.log(`✏️ Updating profile with email: ${decodedEmail}`);

    // Find profile by email, not by ObjectId
    const existingProfile = await Profile.findOne({ email: decodedEmail });
    
    if (!existingProfile) {
      console.log(`❌ Profile not found for email: ${decodedEmail}`);
      return res.status(404).json({ 
        error: "Profile not found",
        email: decodedEmail
      });
    }

    // Validate photo if provided
    if (photo) {
      const base64Regex = /^data:image\/(jpeg|jpg|png|gif|webp|bmp|svg\+xml);base64,/i;
      if (!base64Regex.test(photo)) {
        return res.status(400).json({ 
          error: "Invalid photo format. Expected: data:image/[type];base64,[data]" 
        });
      }
      console.log(`📸 New photo provided (${photo.length} characters)`);
    }

    // Process date of birth with improved function
    let processedDob = existingProfile.dob; // Keep existing value by default
    if (dob !== undefined) {
      processedDob = processDateOfBirth(dob);
      console.log('📅 Date update:', { original: dob, processed: processedDob });
    }

    // Build update data - only include fields that are provided
    const updateData = {};
    if (firstName !== undefined && firstName !== null) updateData.firstName = firstName.trim();
    if (lastName !== undefined && lastName !== null) updateData.lastName = lastName.trim();
    if (phone !== undefined && phone !== null) updateData.phone = phone.trim();
    if (gender !== undefined && gender !== null) updateData.gender = gender.toLowerCase();
    if (photo !== undefined && photo !== null) updateData.photo = photo;
    if (dob !== undefined) updateData.dob = processedDob; // Use processed date

    console.log('📝 Update data:', Object.keys(updateData));

    // Update the profile using email as the identifier
    const updatedProfile = await Profile.findOneAndUpdate(
      { email: decodedEmail },
      updateData,
      { 
        new: true, 
        runValidators: true 
      }
    );

    if (!updatedProfile) {
      console.log(`❌ Failed to update profile for email: ${decodedEmail}`);
      return res.status(404).json({ error: "Profile not found during update" });
    }

    console.log(`✅ Profile updated for email: ${decodedEmail}`);
    console.log(`📅 Updated DOB: ${updatedProfile.dob}`);
    console.log(`📸 Has photo: ${!!updatedProfile.photo}`);
    
    res.status(200).json({
      message: "Profile updated successfully",
      profile: {
        ...updatedProfile.toObject(),
        hasPhoto: !!updatedProfile.photo
      }
    });

  } catch (err) {
    console.error("❌ Error updating profile by email:", err);
    
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

// NEW: Update profile photo by email with proper validation
const updateProfilePhotoByEmail = async (req, res) => {
  try {
    const { email } = req.params;
    const { photo } = req.body;

    const decodedEmail = decodeURIComponent(email).toLowerCase();
    console.log(`📸 Updating photo for email: ${decodedEmail}`);

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

    console.log(`📸 Valid photo format detected (${photo.length} characters)`);

    // Find and update profile by email
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

    console.log(`✅ Photo updated for profile: ${updatedProfile._id}`);
    
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
    console.error("❌ Error updating profile photo:", err);
    res.status(500).json({ 
      error: "Internal server error",
      message: err.message 
    });
  }
};

// Original updateProfile function (kept for backward compatibility) - FIXED with improved date handling
const updateProfile = async (req, res) => {
  try {
    const profileId = req.params.id;
    const { firstName, lastName, dob, email, phone, gender, photo } = req.body;

    console.log(`✏️ Updating profile with ID: ${profileId}`);

    const existingProfile = await Profile.findById(profileId);
    if (!existingProfile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    // If email is being changed, check for duplicates
    if (email && email.trim().toLowerCase() !== existingProfile.email) {
      const emailExists = await Profile.findOne({ 
        email: email.trim().toLowerCase(),
        _id: { $ne: profileId } // Exclude current profile from check
      });
      
      if (emailExists) {
        return res.status(409).json({ 
          error: "A profile with this email already exists",
          existingEmail: email.trim().toLowerCase()
        });
      }
    }

    if (photo) {
      const base64Regex = /^data:image\/(jpeg|jpg|png|gif|webp|bmp|svg\+xml);base64,/i;
      if (!base64Regex.test(photo)) {
        return res.status(400).json({ 
          error: "Invalid photo format. Expected: data:image/[type];base64,[data]" 
        });
      }
      console.log(`📸 New photo provided (${photo.length} characters)`);
    }

    // Process date of birth with improved function
    let processedDob = existingProfile.dob;
    if (dob !== undefined) {
      processedDob = processDateOfBirth(dob);
      console.log('📅 Date update:', { original: dob, processed: processedDob });
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
      { 
        new: true, 
        runValidators: true 
      }
    );

    console.log(`✅ Profile updated: ${profileId}`);
    console.log(`📅 Updated DOB: ${updatedProfile.dob}`);
    console.log(`📸 Has photo: ${!!updatedProfile.photo}`);
    
    res.status(200).json({
      message: "Profile updated successfully",
      profile: {
        ...updatedProfile.toObject(),
        hasPhoto: !!updatedProfile.photo
      }
    });

  } catch (err) {
    console.error("❌ Error updating profile:", err);
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ error: errors.join(', ') });
    }
    res.status(500).json({ error: err.message });
  }
};

const deleteProfile = async (req, res) => {
  try {
    const profileId = req.params.id;
    console.log('🗑️ Attempting to delete profile with ID:', profileId);

    const deletedProfile = await Profile.findByIdAndDelete(profileId);
    
    if (!deletedProfile) {
      console.log('❌ Profile not found with ID:', profileId);
      return res.status(404).json({ error: "Profile not found" });
    }
    
    console.log('✅ Profile deleted successfully:', profileId);
    console.log('🗑️ Base64 photo data deleted from database');
    
    res.status(200).json({ 
      message: "Profile deleted successfully",
      deletedProfile: {
        id: deletedProfile._id,
        name: `${deletedProfile.firstName} ${deletedProfile.lastName}`
      }
    });
    
  } catch (err) {
    console.error('❌ Error deleting profile:', err);
    res.status(500).json({ error: err.message });
  }
};

const checkEmailExists = async (req, res) => {
  try {
    const { email } = req.params;
    const decodedEmail = decodeURIComponent(email).toLowerCase();
    console.log(`🔍 Checking if email exists: ${decodedEmail}`);
    
    const profile = await Profile.findOne({ email: decodedEmail });
    
    console.log(`📧 Email exists: ${!!profile}`);
    
    res.status(200).json({ 
      exists: !!profile,
      email: decodedEmail,
      profile: profile ? {
        id: profile._id,
        name: `${profile.firstName} ${profile.lastName}`,
        hasPhoto: !!profile.photo
      } : null
    });
    
  } catch (err) {
    console.error('❌ Error checking email:', err);
    res.status(500).json({ error: err.message });
  }
};

const getProfilePhoto = async (req, res) => {
  try {
    const profileId = req.params.id;
    console.log(`📸 Fetching photo for profile: ${profileId}`);

    const profile = await Profile.findById(profileId).select('photo firstName lastName');

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    if (!profile.photo) {
      return res.status(404).json({ error: 'Profile has no photo' });
    }

    console.log(`✅ Photo found for profile: ${profileId}`);

    res.status(200).json({
      id: profile._id,
      name: `${profile.firstName} ${profile.lastName}`,
      photo: profile.photo
    });

  } catch (error) {
    console.error('❌ Error fetching profile photo:', error);
    res.status(500).json({ error: 'Failed to fetch profile photo' });
  }
};

module.exports = { 
  addProfile, 
  getProfileById,
  getProfileByUserId,
  getAllProfiles,
  updateProfile,
  updateProfileByEmail,
  updateProfilePhotoByEmail, // NEW: Export photo update function
  deleteProfile,
  checkEmailExists,
  getProfilePhoto
};