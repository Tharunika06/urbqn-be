// src/controllers/ownerController.js
const Owner = require('../models/Owner');
const Counter = require('../models/Counter');
const Notification = require('../models/Notification');

// --- Helper: Generate Sequential ID ---
async function getNextSequenceValue(sequenceName) {
  const sequenceDocument = await Counter.findOneAndUpdate(
    { _id: sequenceName },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return sequenceDocument.seq;
}

// --- Controller Functions ---

// Add new owner
const addOwner = async (req, res) => {
  try {
    const {
      name, email, contact, address, doj, status, city,
      agency, licenseNumber, textNumber, servicesArea, about,
      propertySold, propertyRent
    } = req.body;

    console.log('📝 Adding new owner...');
    console.log('📄 Request body:', { name, email, contact, city });
    console.log('📸 Has photo base64:', !!req.photoBase64);

    // Validation
    if (!name) return res.status(400).json({ error: 'Name is required' });
    if (!req.photoBase64) return res.status(400).json({ error: 'Owner photo is required' });

    // Parse numbers safely
    const sold = parseInt(propertySold) || 0;
    const rent = parseInt(propertyRent) || 0;
    const totalListing = sold + rent;

    // Generate next sequential ownerId
    const nextOwnerId = await getNextSequenceValue('ownerId');

    // Create Owner with base64 photo
    const newOwner = new Owner({
      name,
      ownerId: nextOwnerId.toString(),
      email,
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
      photo: req.photoBase64, // Store base64 data URL
      photoInfo: req.photoInfo, // Store photo metadata
      propertySold: sold,
      propertyRent: rent,
      totalListing
    });

    await newOwner.save();

    console.log(`✅ Owner created with ID: ${newOwner.ownerId}`);
    console.log(`📸 Photo stored as base64 (${req.photoBase64.length} characters)`);

    // Create notification for new owner
    const notification = new Notification({
      type: "owner",
      message: `New owner "${newOwner.name}" has been added.`,
      relatedId: newOwner._id
    });
    await notification.save();

    res.status(201).json({
      ...newOwner.toObject(),
      hasPhoto: !!newOwner.photo
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: 'An owner with a similar unique field already exists.' });
    }
    console.error('❌ Error adding owner:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all owners
const getAllOwners = async (req, res) => {
  try {
    console.log('📋 Fetching all owners...');
    
    // Optional: Add option to exclude photos for list view (performance)
    const includePhotos = req.query.includePhotos !== 'false';
    
    let query = Owner.find().sort({ createdAt: -1 });
    
    // Exclude photo field for better performance if not needed
    if (!includePhotos) {
      query = query.select('-photo');
      console.log('⚡ Excluding photos for better performance');
    }

    const owners = await query;

    console.log(`✅ Found ${owners.length} owners`);
    console.log(`📸 Photos included: ${includePhotos}`);

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

    res.status(200).json({
      ...owner.toObject(),
      hasPhoto: !!owner.photo
    });

  } catch (error) {
    console.error('❌ Error fetching owner:', error);
    res.status(500).json({ error: 'Failed to fetch owner' });
  }
};

// Delete owner by ID
const deleteOwner = async (req, res) => {
  try {
    const { ownerId } = req.params;
    console.log('🗑️ Attempting to delete owner with ownerId:', ownerId);

    // Find the owner first
    const owner = await Owner.findOne({ ownerId });

    if (!owner) {
      console.log('❌ Owner not found with ownerId:', ownerId);
      return res.status(404).json({ error: 'Owner not found' });
    }

    // Delete the owner from database
    await Owner.findOneAndDelete({ ownerId });
    console.log('✅ Owner deleted successfully:', ownerId);
    console.log('🗑️ Base64 photo data deleted from database');

    // Create notification for deleted owner
    const notification = new Notification({
      type: "owner",
      message: `Owner "${owner.name}" (ID: ${owner.ownerId}) was deleted.`,
      relatedId: owner._id
    });
    await notification.save();

    res.status(200).json({
      message: 'Owner deleted successfully',
      deletedOwnerId: ownerId
    });

  } catch (error) {
    console.error('❌ Error deleting owner:', error);
    res.status(500).json({ error: 'Failed to delete owner' });
  }
};

// Update owner (new function)
const updateOwner = async (req, res) => {
  try {
    const { ownerId } = req.params;
    console.log(`✏️ Updating owner with ID: ${ownerId}`);

    const owner = await Owner.findOne({ ownerId });
    if (!owner) {
      return res.status(404).json({ error: 'Owner not found' });
    }

    const {
      name, email, contact, address, doj, status, city,
      agency, licenseNumber, textNumber, servicesArea, about,
      propertySold, propertyRent
    } = req.body;

    // Parse numbers safely
    const sold = parseInt(propertySold) || owner.propertySold || 0;
    const rent = parseInt(propertyRent) || owner.propertyRent || 0;
    const totalListing = sold + rent;

    const updateData = {
      name: name || owner.name,
      email: email || owner.email,
      contact: contact || owner.contact,
      address: address || owner.address,
      doj: doj ? new Date(doj) : owner.doj,
      status: status || owner.status,
      city: city || owner.city,
      agency: agency || owner.agency,
      licenseNumber: licenseNumber || owner.licenseNumber,
      textNumber: textNumber || owner.textNumber,
      servicesArea: servicesArea || owner.servicesArea,
      about: about || owner.about,
      propertySold: sold,
      propertyRent: rent,
      totalListing
    };

    // Handle new base64 photo if provided
    if (req.photoBase64) {
      updateData.photo = req.photoBase64;
      updateData.photoInfo = req.photoInfo;
      
      console.log(`📸 New photo uploaded (${req.photoBase64.length} characters)`);
    }

    const updatedOwner = await Owner.findOneAndUpdate(
      { ownerId },
      updateData,
      { new: true, runValidators: true }
    );

    console.log(`✅ Owner updated: ${ownerId}`);

    res.status(200).json({
      ...updatedOwner.toObject(),
      hasPhoto: !!updatedOwner.photo
    });

  } catch (error) {
    console.error('❌ Error updating owner:', error);
    res.status(500).json({ error: 'Failed to update owner' });
  }
};

// Get owner photo only (separate endpoint for performance)
const getOwnerPhoto = async (req, res) => {
  try {
    const { ownerId } = req.params;
    console.log(`📸 Fetching photo for owner: ${ownerId}`);

    const owner = await Owner.findOne({ ownerId }).select('photo photoInfo name');

    if (!owner) {
      return res.status(404).json({ error: 'Owner not found' });
    }

    if (!owner.photo) {
      return res.status(404).json({ error: 'Owner has no photo' });
    }

    console.log(`✅ Photo found for owner: ${ownerId}`);

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

module.exports = {
  addOwner,
  getAllOwners,
  getOwnerById,
  deleteOwner,
  updateOwner,
  getOwnerPhoto
};