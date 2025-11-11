// backend/src/controllers/adminController.js
const Admin = require('../models/Admin');

/**
 * ✅ GET Admin Profile
 * GET /api/admin/profile
 */
exports.getProfile = async (req, res) => {
  try {
    console.log('\n=== GET ADMIN PROFILE ===');
    console.log('📍 Admin email from token:', req.admin?.email);
    
    if (!req.admin || !req.admin.email) {
      console.log('❌ No admin in request');
      return res.status(401).json({ 
        success: false,
        error: 'Authentication required'
      });
    }
    
    // ✅ Find or create admin profile by email
    let admin = await Admin.findOne({ email: req.admin.email });
    
    if (!admin) {
      console.log('ℹ️ Admin profile not found, creating new one...');
      // Create admin profile automatically
      admin = new Admin({
        email: req.admin.email,
        name: '',
        phone: '',
        photo: '',
        role: req.admin.role || 'admin',
        isActive: true
      });
      await admin.save();
      console.log('✅ New admin profile created');
    }

    console.log('✅ Admin profile loaded:', admin.email);

    // ✅ Check if profile fields are empty (new profile)
    const isNewProfile = !admin.name && !admin.phone;

    res.status(200).json({
      success: true,
      profile: {
        name: admin.name || '',
        phone: admin.phone || '',
        photo: admin.photo || ''
      },
      isNewProfile: isNewProfile
    });

    console.log('===================\n');

  } catch (error) {
    console.error('❌ Error fetching admin profile:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * ✅ UPDATE Admin Profile (name, phone, photo)
 * PUT /api/admin/profile
 */
exports.updateProfile = async (req, res) => {
  try {
    console.log('\n=== UPDATE ADMIN PROFILE ===');
    console.log('📍 Admin from req:', req.admin);
    console.log('📍 Admin email:', req.admin?.email);
    console.log('📦 Body:', req.body);
    console.log('📷 File:', req.file ? 'Yes' : 'No');

    if (!req.admin || !req.admin.email) {
      console.log('❌ No admin in request');
      return res.status(401).json({ 
        success: false,
        error: 'Authentication required' 
      });
    }

    // ✅ Validate required fields
    if (!req.body.name || !req.body.name.trim()) {
      return res.status(400).json({ 
        success: false,
        error: 'Name is required' 
      });
    }

    if (!req.body.phone || !req.body.phone.trim()) {
      return res.status(400).json({ 
        success: false,
        error: 'Phone is required' 
      });
    }

    console.log('🔍 Looking for admin with email:', req.admin.email);

    // ✅ Find or create admin profile
    let admin = await Admin.findOne({ email: req.admin.email });
    
    if (!admin) {
      console.log('ℹ️ Admin profile not found, creating new one...');
      admin = new Admin({
        email: req.admin.email,
        name: '',
        phone: '',
        photo: '',
        role: req.admin.role || 'admin',
        isActive: true
      });
      console.log('✅ New Admin document created (not saved yet)');
    } else {
      console.log('✅ Found existing admin profile');
    }

    const wasNewProfile = !admin.name && !admin.phone;

    // ✅ Update fields
    admin.name = req.body.name.trim();
    admin.phone = req.body.phone.trim();
    console.log('✅ Fields updated - Name:', admin.name, 'Phone:', admin.phone);

    // ✅ Handle photo upload
    if (req.file) {
      const base64Photo = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      admin.photo = base64Photo;
      console.log('✅ Photo uploaded');
    } else if (req.body.photo && req.body.photo.startsWith('data:image')) {
      admin.photo = req.body.photo;
      console.log('✅ Photo from body');
    }

    // ✅ Save to database
    console.log('💾 Saving to database...');
    await admin.save();
    console.log('✅ Profile saved successfully');

    res.status(200).json({
      success: true,
      message: wasNewProfile ? 'Profile created successfully' : 'Profile updated successfully',
      profile: {
        name: admin.name,
        phone: admin.phone,
        photo: admin.photo
      }
    });

    console.log('===================\n');

  } catch (error) {
    console.error('❌ Error updating profile:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ 
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * ✅ DELETE Admin Photo
 * DELETE /api/admin/profile/photo
 */
exports.deletePhoto = async (req, res) => {
  try {
    console.log('\n=== DELETE ADMIN PHOTO ===');
    
    const admin = await Admin.findOne({ email: req.admin.email });
    
    if (!admin) {
      return res.status(404).json({ 
        success: false,
        message: 'Admin not found' 
      });
    }

    admin.photo = '';
    await admin.save();

    console.log('✅ Photo deleted');

    res.status(200).json({ 
      success: true,
      message: 'Photo deleted successfully' 
    });

  } catch (error) {
    console.error('❌ Error deleting photo:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * ✅ Logout Admin
 * POST /api/admin/logout
 */
exports.logout = async (req, res) => {
  try {
    console.log('\n=== ADMIN LOGOUT ===');
    
    res.clearCookie('authToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });
    
    console.log('✅ Cookie cleared');
    
    res.status(200).json({ 
      success: true,
      message: 'Logged out successfully' 
    });

  } catch (error) {
    console.error('❌ Error during logout:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error'
    });
  }
};