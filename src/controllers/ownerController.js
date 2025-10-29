// src/controllers/ownerController.js
const Owner = require('../models/Owner');
const Property = require('../models/Property');
const Transaction = require('../models/Transaction');
const Counter = require('../models/Counter');
const Notification = require('../models/Notification');
const { emitNotification } = require('../utils/socketUtils');

// --- Helper: Generate Sequential ID ---
async function getNextSequenceValue(sequenceName) {
  const sequenceDocument = await Counter.findOneAndUpdate(
    { _id: sequenceName },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return sequenceDocument.seq;
}

// --- Helper: Recalculate Owner Stats from Properties and Transactions ---
async function recalculateOwnerStats(ownerId) {
  try {
    const owner = await Owner.findOne({ ownerId });
    if (!owner) return null;

    const numericOwnerId = parseInt(ownerId);

    // Get all sold property IDs for this owner
    const soldProperties = await Transaction.aggregate([
      {
        $match: {
          ownerId: numericOwnerId,
          purchaseType: 'buy',
          status: 'Completed'
        }
      },
      {
        $group: {
          _id: '$property'
        }
      }
    ]);

    const soldPropertyIds = soldProperties.map(p => p._id);

    console.log(`🏷️ Owner ${ownerId} has ${soldPropertyIds.length} sold properties`);

    // Count total properties (including sold)
    const totalPropertiesCount = await Property.countDocuments({ 
      ownerId: numericOwnerId 
    });

    // Count AVAILABLE properties (excluding sold ones)
    const availablePropertiesCount = await Property.countDocuments({ 
      ownerId: numericOwnerId,
      _id: { $nin: soldPropertyIds }
    });

    // Count rent properties (excluding sold ones)
    const rentProperties = await Property.countDocuments({ 
      ownerId: numericOwnerId, 
      status: { $in: ['rent', 'both'] },
      _id: { $nin: soldPropertyIds }
    });
    
    // Count sale properties (excluding sold ones)
    const saleProperties = await Property.countDocuments({ 
      ownerId: numericOwnerId, 
      status: { $in: ['sale', 'both'] },
      _id: { $nin: soldPropertyIds }
    });

    // Update owner with correct stats
    owner.propertyOwned = availablePropertiesCount; // Only available properties
    owner.propertyRent = rentProperties;
    owner.propertySold = soldPropertyIds.length; // Number of sold properties
    owner.totalListing = rentProperties + saleProperties;

    await owner.save();
    
    console.log(`✅ Owner stats recalculated for ${owner.name}:`);
    console.log(`   Total Properties Created: ${totalPropertiesCount}`);
    console.log(`   Available Properties: ${availablePropertiesCount}`);
    console.log(`   Sold Properties: ${soldPropertyIds.length}`);
    console.log(`   Rent Listings: ${rentProperties} | Sale Listings: ${saleProperties}`);

    return owner;
  } catch (error) {
    console.error('❌ Error recalculating owner stats:', error.message);
    return null;
  }
}

// --- Utility Controllers ---

// Get photo statistics
const getPhotoStats = async (req, res) => {
  try {
    const stats = await Owner.getPhotoStats();
    
    console.log('📊 Photo statistics requested');
    
    res.status(200).json({
      message: 'Photo statistics retrieved successfully',
      stats
    });

  } catch (error) {
    console.error('❌ Error getting photo stats:', error);
    res.status(500).json({
      error: 'Failed to get photo statistics'
    });
  }
};

// Get owners without photos
const getOwnersWithoutPhotos = async (req, res) => {
  try {
    const ownersWithoutPhotos = await Owner.findOwnersWithoutPhotos()
      .select('ownerId name email');
    
    console.log(`📋 Found ${ownersWithoutPhotos.length} owners without photos`);
    
    res.status(200).json({
      message: 'Owners without photos retrieved successfully',
      count: ownersWithoutPhotos.length,
      owners: ownersWithoutPhotos
    });

  } catch (error) {
    console.error('❌ Error finding owners without photos:', error);
    res.status(500).json({
      error: 'Failed to find owners without photos'
    });
  }
};

// Recalculate stats for single owner
const recalculateStats = async (req, res) => {
  try {
    const { ownerId } = req.params;
    console.log(`🔄 Recalculating stats for owner: ${ownerId}`);

    const owner = await recalculateOwnerStats(ownerId);
    
    if (!owner) {
      return res.status(404).json({ error: 'Owner not found' });
    }

    // Emit socket event for real-time update
    if (req.app && req.app.get('io')) {
      const io = req.app.get('io');
      io.emit('update-analytics', {
        type: 'owner-stats-updated',
        ownerId: owner.ownerId,
        stats: {
          propertyOwned: owner.propertyOwned,
          propertyRent: owner.propertyRent,
          propertySold: owner.propertySold,
          totalListing: owner.totalListing
        }
      });
    }

    res.status(200).json({
      message: 'Owner stats recalculated successfully',
      owner: {
        ownerId: owner.ownerId,
        name: owner.name,
        propertyOwned: owner.propertyOwned,
        propertyRent: owner.propertyRent,
        propertySold: owner.propertySold,
        totalListing: owner.totalListing
      }
    });

  } catch (error) {
    console.error('❌ Error recalculating stats:', error);
    res.status(500).json({ error: 'Failed to recalculate owner stats' });
  }
};

// Recalculate stats for all owners
const recalculateAllStats = async (req, res) => {
  try {
    console.log('🔄 Recalculating stats for all owners...');

    const owners = await Owner.find();
    let successCount = 0;
    let errorCount = 0;

    for (const owner of owners) {
      const result = await recalculateOwnerStats(owner.ownerId);
      if (result) {
        successCount++;
      } else {
        errorCount++;
      }
    }

    console.log(`✅ Recalculation complete: ${successCount} success, ${errorCount} errors`);

    // Emit socket event for dashboard refresh
    if (req.app && req.app.get('io')) {
      const io = req.app.get('io');
      io.emit('update-analytics', {
        type: 'all-owners-stats-updated',
        totalOwners: owners.length,
        successCount,
        errorCount
      });
    }

    res.status(200).json({
      message: 'All owner stats recalculated',
      total: owners.length,
      success: successCount,
      errors: errorCount
    });

  } catch (error) {
    console.error('❌ Error recalculating all stats:', error);
    res.status(500).json({ error: 'Failed to recalculate all owner stats' });
  }
};

// --- Main Controller Functions ---

// Add new owner
const addOwner = async (req, res) => {
  try {
    const {
      name, email, contact, address, doj, status, city,
      agency, licenseNumber, textNumber, servicesArea, about,
      photo,
      photoInfo
    } = req.body;

    console.log('📝 Adding new owner...');
    console.log('📄 Request data:', { name, email, contact, city });
    console.log('📸 Has photo base64:', !!photo);

    // Validation
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    if (!photo) {
      return res.status(400).json({ error: 'Owner photo is required' });
    }

    // Validate base64 format
    if (!photo.startsWith('data:image/')) {
      return res.status(400).json({ 
        error: 'Invalid photo format. Must be a base64 data URL.' 
      });
    }

    // Validate email format if provided
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }

      // Check if email already exists
      const existingOwner = await Owner.findOne({ 
        email: email.toLowerCase() 
      });
      
      if (existingOwner) {
        return res.status(409).json({ 
          error: 'An owner with this email already exists' 
        });
      }
    }

    // Generate next sequential ownerId
    const nextOwnerId = await getNextSequenceValue('ownerId');

    // Create Owner with base64 photo
    // Property stats will be 0 initially and auto-calculated when properties are added
    const newOwner = new Owner({
      name,
      ownerId: nextOwnerId.toString(),
      email: email ? email.toLowerCase() : email,
      contact,
      address,
      doj: doj ? new Date(doj) : undefined,
      status,
      city,
      agency,
      licenseNumber,
      textNumber,
      servicesArea,
      about,
      photo: photo,
      photoInfo: photoInfo || {
        uploadDate: new Date(),
        size: Buffer.byteLength(photo, 'utf8')
      },
      // Stats start at 0
      propertySold: 0,
      propertyRent: 0,
      propertyOwned: 0,
      totalListing: 0
    });

    await newOwner.save();

    console.log(`✅ Owner created with ID: ${newOwner.ownerId}`);
    console.log(`📸 Photo stored as base64 (${photo.length} characters)`);

    // Create notification for new owner
    try {
      const notification = new Notification({
        userId: null,
        type: "owner_added",
        target: "admin",
        message: `New owner "${newOwner.name}" has been added.`,
        relatedId: newOwner._id
      });
      await notification.save();
      console.log('✅ Notification created for new owner');

      // Emit socket event for real-time dashboard update
      if (req.app && req.app.get('io')) {
        const io = req.app.get('io');
        console.log('🔔 Emitting update-analytics event');
        io.emit('update-analytics', {
          type: 'owner-added',
          ownerId: newOwner.ownerId,
          name: newOwner.name
        });

        emitNotification(req, notification);
      }
    } catch (notifError) {
      console.error('⚠️ Notification creation failed (non-critical):', notifError.message);
    }

    res.status(201).json({
      message: 'Owner added successfully',
      owner: {
        ...newOwner.toObject(),
        hasPhoto: !!newOwner.photo
      }
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ 
        error: 'An owner with a similar unique field already exists.' 
      });
    }
    console.error('❌ Error adding owner:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
};

// Get all owners
const getAllOwners = async (req, res) => {
  try {
    console.log('📋 Fetching all owners...');
    
    const includePhotos = req.query.includePhotos !== 'false';
    
    let query = Owner.find().sort({ createdAt: -1 });
    
    if (!includePhotos) {
      query = query.select('-photo');
      console.log('⚡ Excluding photos for better performance');
    }

    const owners = await query;

    console.log(`✅ Found ${owners.length} owners`);
    console.log(`📸 Owners with photos: ${owners.filter(o => o.photo).length}`);

    res.status(200).json({
      owners,
      count: owners.length,
      includePhotos
    });

  } catch (error) {
    console.error('❌ Error fetching owners:', error);
    res.status(500).json({ error: 'Failed to fetch owners' });
  }
};

// Get single owner by ID
const getOwnerById = async (req, res) => {
  try {
    const { ownerId } = req.params;
    console.log(`🔍 Fetching owner with ID: ${ownerId}`);

    const owner = await Owner.findOne({ ownerId });

    if (!owner) {
      console.log(`❌ Owner not found: ${ownerId}`);
      return res.status(404).json({ error: 'Owner not found' });
    }

    console.log(`✅ Owner found: ${owner.name}`);
    console.log(`📸 Has photo: ${!!owner.photo}`);
    console.log(`📊 Stats: Owned=${owner.propertyOwned}, Rent=${owner.propertyRent}, Sold=${owner.propertySold}`);

    res.status(200).json({
      ...owner.toObject(),
      hasPhoto: !!owner.photo
    });

  } catch (error) {
    console.error('❌ Error fetching owner:', error);
    res.status(500).json({ error: 'Failed to fetch owner' });
  }
};

// Update owner
const updateOwner = async (req, res) => {
  try {
    const { ownerId } = req.params;
    console.log(`✏️ Updating owner with ID: ${ownerId}`);

    const owner = await Owner.findOne({ ownerId });
    if (!owner) {
      console.log(`❌ Owner not found: ${ownerId}`);
      return res.status(404).json({ error: 'Owner not found' });
    }

    const {
      name, email, contact, address, doj, status, city,
      agency, licenseNumber, textNumber, servicesArea, about,
      photo,
      photoInfo
    } = req.body;

    // Validate email if being updated
    if (email && email !== owner.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }

      // Check if new email already exists
      const existingOwner = await Owner.findOne({ 
        email: email.toLowerCase(),
        ownerId: { $ne: ownerId }
      });
      
      if (existingOwner) {
        return res.status(409).json({ 
          error: 'Another owner with this email already exists' 
        });
      }
    }

    // NOTE: We DO NOT update property stats manually
    // They are auto-calculated by the property/transaction controllers

    const updateData = {
      name: name || owner.name,
      email: email ? email.toLowerCase() : owner.email,
      contact: contact || owner.contact,
      address: address || owner.address,
      doj: doj ? new Date(doj) : owner.doj,
      status: status || owner.status,
      city: city || owner.city,
      agency: agency || owner.agency,
      licenseNumber: licenseNumber || owner.licenseNumber,
      textNumber: textNumber || owner.textNumber,
      servicesArea: servicesArea || owner.servicesArea,
      about: about || owner.about
    };

    // Handle photo update
    if (photo) {
      if (!photo.startsWith('data:image/')) {
        return res.status(400).json({ 
          error: 'Invalid photo format. Must be a base64 data URL.' 
        });
      }
      
      updateData.photo = photo;
      updateData.photoInfo = photoInfo || {
        uploadDate: new Date(),
        size: Buffer.byteLength(photo, 'utf8')
      };
      
      console.log(`📸 New photo uploaded (${photo.length} characters)`);
    }

    const updatedOwner = await Owner.findOneAndUpdate(
      { ownerId },
      updateData,
      { new: true, runValidators: true }
    );

    console.log(`✅ Owner updated: ${ownerId}`);

    // Create notification for owner update
    try {
      const notification = new Notification({
        userId: null,
        type: "owner_updated",
        target: "admin",
        message: `Owner "${updatedOwner.name}" has been updated.`,
        relatedId: updatedOwner._id
      });
      await notification.save();
      console.log('✅ Notification created for owner update');

      // Emit socket event
      if (req.app && req.app.get('io')) {
        const io = req.app.get('io');
        console.log('🔔 Emitting update-analytics event');
        io.emit('update-analytics', {
          type: 'owner-updated',
          ownerId: updatedOwner.ownerId,
          name: updatedOwner.name
        });

        emitNotification(req, notification);
      }
    } catch (notifError) {
      console.error('⚠️ Notification creation failed (non-critical):', notifError.message);
    }

    res.status(200).json({
      message: 'Owner updated successfully',
      owner: {
        ...updatedOwner.toObject(),
        hasPhoto: !!updatedOwner.photo
      }
    });

  } catch (error) {
    console.error('❌ Error updating owner:', error);
    res.status(500).json({ 
      error: 'Failed to update owner',
      details: error.message 
    });
  }
};

// Delete owner by ID
const deleteOwner = async (req, res) => {
  try {
    const { ownerId } = req.params;
    console.log('🗑️ Attempting to delete owner with ownerId:', ownerId);

    const owner = await Owner.findOne({ ownerId });

    if (!owner) {
      console.log('❌ Owner not found with ownerId:', ownerId);
      return res.status(404).json({ error: 'Owner not found' });
    }

    // Check if owner has properties
    const numericOwnerId = parseInt(ownerId);
    const propertyCount = await Property.countDocuments({ ownerId: numericOwnerId });
    
    if (propertyCount > 0) {
      console.log(`⚠️ Owner has ${propertyCount} properties. Consider deleting properties first.`);
      return res.status(400).json({ 
        error: 'Cannot delete owner with existing properties',
        message: `This owner has ${propertyCount} properties. Please delete or reassign them first.`,
        propertyCount
      });
    }

    await Owner.findOneAndDelete({ ownerId });
    console.log('✅ Owner deleted successfully:', ownerId);

    // Create notification for deleted owner
    try {
      const notification = new Notification({
        userId: null,
        type: "owner_deleted",
        target: "admin",
        message: `Owner "${owner.name}" (ID: ${owner.ownerId}) was deleted.`,
        relatedId: owner._id
      });
      await notification.save();
      console.log('✅ Notification created for owner deletion');

      // Emit socket event for real-time dashboard update
      if (req.app && req.app.get('io')) {
        const io = req.app.get('io');
        console.log('🔔 Emitting update-analytics event');
        io.emit('update-analytics', {
          type: 'owner-deleted',
          ownerId: owner.ownerId,
          name: owner.name
        });

        emitNotification(req, notification);
      }
    } catch (notifError) {
      console.error('⚠️ Notification creation failed (non-critical):', notifError.message);
    }

    res.status(200).json({
      message: 'Owner deleted successfully',
      deletedOwnerId: ownerId,
      deletedOwnerName: owner.name
    });

  } catch (error) {
    console.error('❌ Error deleting owner:', error);
    res.status(500).json({ error: 'Failed to delete owner' });
  }
};

// --- Photo-specific Controllers ---

// Get owner photo only
const getOwnerPhoto = async (req, res) => {
  try {
    const { ownerId } = req.params;
    console.log(`📸 Fetching photo for owner: ${ownerId}`);

    const owner = await Owner.findOne({ ownerId })
      .select('photo photoInfo name ownerId');

    if (!owner) {
      console.log(`❌ Owner not found: ${ownerId}`);
      return res.status(404).json({ error: 'Owner not found' });
    }

    if (!owner.photo) {
      console.log(`⚠️ Owner ${ownerId} has no photo`);
      return res.status(404).json({ error: 'Owner has no photo' });
    }

    console.log(`✅ Photo retrieved for owner: ${owner.name}`);

    res.status(200).json({
      ownerId: owner.ownerId,
      name: owner.name,
      photo: owner.photo,
      photoInfo: owner.photoInfo
    });

  } catch (error) {
    console.error('❌ Error fetching owner photo:', error);
    res.status(500).json({ error: 'Failed to fetch owner photo' });
  }
};

// Update only owner photo
const updateOwnerPhoto = async (req, res) => {
  try {
    const { ownerId } = req.params;
    const { photo } = req.body;
    
    console.log(`📸 Updating photo for owner: ${ownerId}`);
    
    if (!photo) {
      return res.status(400).json({
        error: 'No photo provided'
      });
    }

    // Validate base64 format
    if (!photo.startsWith('data:image/') || !photo.includes('base64,')) {
      return res.status(400).json({
        error: 'Invalid photo format. Must be a valid base64 data URL.'
      });
    }

    const updatedOwner = await Owner.findOneAndUpdate(
      { ownerId },
      { 
        photo: photo,
        'photoInfo.uploadDate': new Date(),
        'photoInfo.size': Buffer.byteLength(photo, 'utf8')
      },
      { new: true }
    );

    if (!updatedOwner) {
      console.log(`❌ Owner not found: ${ownerId}`);
      return res.status(404).json({
        error: 'Owner not found'
      });
    }

    console.log(`✅ Photo updated for owner: ${ownerId} - ${updatedOwner.name}`);

    // Emit socket event for real-time update
    if (req.app && req.app.get('io')) {
      const io = req.app.get('io');
      io.emit('update-analytics', {
        type: 'owner-photo-updated',
        ownerId: updatedOwner.ownerId,
        name: updatedOwner.name
      });
    }

    res.status(200).json({
      message: 'Owner photo updated successfully',
      ownerId: updatedOwner.ownerId,
      name: updatedOwner.name,
      hasPhoto: !!updatedOwner.photo
    });

  } catch (error) {
    console.error('❌ Error updating owner photo:', error);
    res.status(500).json({
      error: 'Failed to update owner photo',
      details: error.message
    });
  }
};

// Remove owner photo
const removeOwnerPhoto = async (req, res) => {
  try {
    const { ownerId } = req.params;
    
    console.log(`🗑️ Removing photo for owner: ${ownerId}`);
    
    const updatedOwner = await Owner.findOneAndUpdate(
      { ownerId },
      { 
        $unset: { 
          photo: 1,
          photoInfo: 1
        }
      },
      { new: true, runValidators: false }
    );

    if (!updatedOwner) {
      console.log(`❌ Owner not found: ${ownerId}`);
      return res.status(404).json({
        error: 'Owner not found'
      });
    }

    console.log(`✅ Photo removed for owner: ${ownerId} - ${updatedOwner.name}`);

    // Emit socket event for real-time update
    if (req.app && req.app.get('io')) {
      const io = req.app.get('io');
      io.emit('update-analytics', {
        type: 'owner-photo-removed',
        ownerId: updatedOwner.ownerId,
        name: updatedOwner.name
      });
    }

    res.status(200).json({
      message: 'Owner photo removed successfully',
      ownerId: updatedOwner.ownerId,
      name: updatedOwner.name,
      hasPhoto: false
    });

  } catch (error) {
    console.error('❌ Error removing owner photo:', error);
    res.status(500).json({
      error: 'Failed to remove owner photo',
      details: error.message
    });
  }
};

module.exports = {
  // Utility functions
  getPhotoStats,
  getOwnersWithoutPhotos,
  recalculateStats,
  recalculateAllStats,
  
  // Main CRUD operations
  addOwner,
  getAllOwners,
  getOwnerById,
  updateOwner,
  deleteOwner,
  
  // Photo-specific operations
  getOwnerPhoto,
  updateOwnerPhoto,
  removeOwnerPhoto,
  
  // Export helper for use in other controllers
  recalculateOwnerStats
};