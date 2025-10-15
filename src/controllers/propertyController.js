// controllers/propertyController.js
const Property = require('../models/Property');
const Owner = require('../models/Owner');
const notificationController = require('./notificationController');
const { cleanPrice, populateOwnerDetails } = require('../utils/propertyUtils');

// ---------------- CONTROLLERS ----------------

// GET all properties
exports.getAllProperties = async (req, res) => {
  try {
    const properties = await Property.find();
    const propertiesWithOwners = await populateOwnerDetails(properties);
    res.json(propertiesWithOwners);
  } catch (err) {
    console.error('Error fetching properties:', err);
    res.status(500).json({ error: 'Failed to fetch all properties' });
  }
};

// GET properties by category
exports.getPropertiesByCategory = async (req, res) => {
  try {
    const { type } = req.params;
    const query = type === 'All' ? {} : { type: new RegExp(`^${type}$`, 'i') };
    const properties = await Property.find(query);
    const propertiesWithOwners = await populateOwnerDetails(properties);
    res.json(propertiesWithOwners);
  } catch (err) {
    console.error('Error fetching properties by type:', err);
    res.status(500).json({ error: 'Failed to fetch properties by type' });
  }
};

// GET properties by owner
exports.getPropertiesByOwner = async (req, res) => {
  try {
    const { ownerId } = req.params;
    const numericOwnerId = parseInt(ownerId);

    if (isNaN(numericOwnerId)) {
      return res.status(400).json({ error: 'Invalid owner ID' });
    }

    const owner = await Owner.findOne({ ownerId: numericOwnerId });
    if (!owner) return res.status(404).json({ error: 'Owner not found' });

    const properties = await Property.find({ ownerId: numericOwnerId });
    const propertiesWithOwners = await populateOwnerDetails(properties);

    res.json(propertiesWithOwners);
  } catch (err) {
    console.error('Error fetching properties by owner:', err);
    res.status(500).json({ error: 'Failed to fetch properties by owner', details: err.message });
  }
};

// GET property by ID
exports.getPropertyById = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ error: 'Property not found' });

    const propertyWithOwner = await populateOwnerDetails(property);
    res.json(propertyWithOwner);
  } catch (err) {
    console.error('Error fetching property by ID:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// GET property with full owner details
exports.getPropertyWithOwner = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ error: 'Property not found' });

    const owner = property.ownerId ? await Owner.findOne({ ownerId: property.ownerId }) : null;

    res.json({
      ...property.toObject(),
      ownerDetails: owner ? {
        ownerId: owner.ownerId,
        name: owner.name,
        email: owner.email,
        contact: owner.contact,
        photo: owner.photo,
        propertyOwned: owner.propertyOwned,
        createdAt: owner.createdAt
      } : null
    });
  } catch (err) {
    console.error('Error fetching property with owner details:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// POST new property - FIXED NOTIFICATIONS
exports.createProperty = async (req, res) => {
  try {
    console.log('\n========== NEW PROPERTY REQUEST ==========');
    console.log('📥 Timestamp:', new Date().toISOString());
    
    const {
      name, type, price, rentPrice, salePrice, status,
      bedrooms, bath, size, floor, address, zip, country,
      city, rating, ownerId, about, facility, photo
    } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({ 
        error: 'Validation failed',
        message: 'Property name is required',
        field: 'name'
      });
    }
    if (!status) {
      return res.status(400).json({ 
        error: 'Validation failed',
        message: 'Property status is required',
        field: 'status'
      });
    }
    if (!ownerId) {
      return res.status(400).json({ 
        error: 'Validation failed',
        message: 'Owner ID is required',
        field: 'ownerId'
      });
    }

    // Validate and parse ownerId
    const numericOwnerId = parseInt(ownerId);
    if (isNaN(numericOwnerId)) {
      return res.status(400).json({ 
        error: 'Validation failed',
        message: 'Owner ID must be a valid number',
        received: ownerId
      });
    }

    // Check if owner exists
    const owner = await Owner.findOne({ ownerId: numericOwnerId });
    if (!owner) {
      return res.status(404).json({ 
        error: 'Owner not found',
        message: `No owner found with ID: ${numericOwnerId}`
      });
    }

    // Validate status
    const validStatuses = ['rent', 'sale', 'both'];
    const normalizedStatus = status.toLowerCase();
    if (!validStatuses.includes(normalizedStatus)) {
      return res.status(400).json({ 
        error: 'Validation failed',
        message: `Status must be one of: ${validStatuses.join(', ')}`,
        received: status
      });
    }

    // Clean prices
    const cleanedPrices = {
      price: cleanPrice(price),
      rentPrice: cleanPrice(rentPrice),
      salePrice: cleanPrice(salePrice)
    };

    // Handle facilities
    let facilitiesArray = [];
    if (facility) {
      if (typeof facility === 'string') {
        try {
          facilitiesArray = JSON.parse(facility);
        } catch {
          facilitiesArray = facility.split(',').map(f => f.trim()).filter(Boolean);
        }
      } else if (Array.isArray(facility)) {
        facilitiesArray = facility;
      }
    }

    // Validate photo
    let validatedPhoto = '';
    if (photo) {
      if (typeof photo !== 'string') {
        return res.status(400).json({ 
          error: 'Invalid photo format',
          message: 'Photo must be a base64 string',
          received: typeof photo
        });
      }

      if (photo.length > 0) {
        if (!photo.startsWith('data:image/')) {
          return res.status(400).json({ 
            error: 'Invalid photo format',
            message: 'Photo must start with "data:image/"',
            received: photo.substring(0, 50)
          });
        }
        if (!photo.includes('base64,')) {
          return res.status(400).json({ 
            error: 'Invalid photo format',
            message: 'Photo must contain "base64," marker'
          });
        }
        
        const sizeInMB = Buffer.byteLength(photo, 'utf8') / (1024 * 1024);
        if (sizeInMB > 15) {
          return res.status(400).json({ 
            error: 'Photo too large',
            message: 'Photo size exceeds 15MB limit',
            size: sizeInMB.toFixed(2) + ' MB'
          });
        }
        
        validatedPhoto = photo;
      }
    }

    // Create property object
    const propertyData = {
      name: name.trim(),
      type: type || 'Apartment',
      price: cleanedPrices.price,
      rentPrice: cleanedPrices.rentPrice,
      salePrice: cleanedPrices.salePrice,
      status: normalizedStatus,
      bedrooms: bedrooms ? parseInt(bedrooms) : undefined,
      bath: bath ? parseInt(bath) : undefined,
      size: size || undefined,
      floor: floor || undefined,
      address: address || undefined,
      zip: zip || undefined,
      country: country || undefined,
      city: city || undefined,
      rating: rating ? parseFloat(rating) : 4.5,
      photo: validatedPhoto,
      facility: facilitiesArray,
      about: about || undefined,
      ownerId: numericOwnerId,
      ownerName: owner.name
    };

    // Save to database
    const newProperty = new Property(propertyData);
    await newProperty.save();
    console.log('✅ Property saved successfully!');

    // Update owner property count
    owner.propertyOwned = (owner.propertyOwned || 0) + 1;
    await owner.save();
    console.log('✅ Owner property count updated:', owner.propertyOwned);

    // ========== NOTIFICATIONS (FIXED) ==========
    console.log('\n🔔 Creating notifications...');
    try {
      // 1. ADMIN NOTIFICATION (Always create, not conditional on req.user)
      console.log('📢 Creating admin notification...');
      await notificationController.createNotification({
        userId: req.user?._id || null,
        type: 'property_created',
        target: 'admin',
        title: 'New Property Created',
        message: `New property "${newProperty.name}" was added by ${owner.name}`,
        propertyName: newProperty.name,
        propertyId: newProperty._id,
        userName: owner.name,
        relatedId: newProperty._id,
      });
      console.log('✅ Admin notification created');

      // 2. MOBILE BROADCAST - Property Created (Generic)
      console.log('📱 Broadcasting property creation to mobile users...');
      await notificationController.broadcastNotification({
        type: 'property_created',
        propertyId: newProperty._id,
        propertyName: newProperty.name,
        userName: owner.name,
        userImage: owner.photo || null,
        metadata: {
          propertyType: newProperty.type,
          propertyStatus: newProperty.status,
          propertyImage: newProperty.photo || null,
          price: newProperty.price,
          rentPrice: newProperty.rentPrice,
          salePrice: newProperty.salePrice,
        }
      });
      console.log('✅ Mobile broadcast notification sent');

      // 3. MOBILE BROADCAST - Property Type Specific
      if (newProperty.type) {
        console.log(`📱 Broadcasting ${newProperty.type} notification...`);
        await notificationController.broadcastNotification({
          type: newProperty.type,
          propertyId: newProperty._id,
          propertyName: newProperty.name,
          userName: owner.name,
          userImage: owner.photo || null,
          metadata: {
            propertyType: newProperty.type,
            propertyStatus: newProperty.status,
            propertyImage: newProperty.photo || null,
            price: newProperty.price,
            rentPrice: newProperty.rentPrice,
            salePrice: newProperty.salePrice,
          }
        });
        console.log(`✅ ${newProperty.type} notification sent`);
      }

    } catch (notifError) {
      console.error('❌ Notification creation failed:', notifError.message);
      console.error('Stack:', notifError.stack);
    }

    // Populate owner details and return
    const propertyWithOwner = await populateOwnerDetails(newProperty);
    
    console.log('✅✅✅ PROPERTY CREATED SUCCESSFULLY! ✅✅✅\n');
    
    res.status(201).json({ 
      success: true,
      message: 'Property created successfully',
      property: propertyWithOwner 
    });
    
  } catch (err) {
    console.error('\n💥 CRITICAL ERROR:', err.message);
    console.error('Stack:', err.stack);
    res.status(500).json({ 
      error: 'Failed to add property', 
      message: err.message,
      name: err.name
    });
  }
};

// PUT update property - FIXED NOTIFICATIONS
exports.updateProperty = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ error: 'Property not found' });

    const updateFields = {};
    const {
      name, type, price, rentPrice, salePrice, status,
      bedrooms, bath, size, floor, address, zip, country,
      city, rating, about, facility, photo
    } = req.body;

    if (name) updateFields.name = name;
    if (type) updateFields.type = type;
    if (status && ['rent', 'sale', 'both'].includes(status.toLowerCase())) {
      updateFields.status = status.toLowerCase();
    }

    if (price !== undefined) updateFields.price = cleanPrice(price);
    if (rentPrice !== undefined) updateFields.rentPrice = cleanPrice(rentPrice);
    if (salePrice !== undefined) updateFields.salePrice = cleanPrice(salePrice);
    if (bedrooms) updateFields.bedrooms = parseInt(bedrooms);
    if (bath) updateFields.bath = parseInt(bath);
    if (size) updateFields.size = size;
    if (floor) updateFields.floor = floor;
    if (address) updateFields.address = address;
    if (zip) updateFields.zip = zip;
    if (country) updateFields.country = country;
    if (city) updateFields.city = city;
    if (rating) updateFields.rating = parseFloat(rating);
    if (about) updateFields.about = about;

    if (facility) {
      try {
        updateFields.facility = Array.isArray(facility) ? facility : JSON.parse(facility);
      } catch {
        updateFields.facility = facility.split(',').map(f => f.trim()).filter(Boolean);
      }
    }

    if (photo && typeof photo === 'string' && photo.length > 0) {
      if (photo.startsWith('data:image/') && photo.includes('base64,')) {
        updateFields.photo = photo;
      }
    }

    const updatedProperty = await Property.findByIdAndUpdate(
      req.params.id, 
      updateFields, 
      { new: true, runValidators: true }
    );
    
    const propertyWithOwner = await populateOwnerDetails(updatedProperty);

    // Create admin notification
    try {
      console.log('📢 Creating property update notification...');
      await notificationController.createNotification({
        userId: req.user?._id || null,
        type: 'property_updated',
        target: 'admin',
        title: 'Property Updated',
        message: `Property "${updatedProperty.name}" was updated`,
        propertyName: updatedProperty.name,
        propertyId: updatedProperty._id,
        relatedId: updatedProperty._id
      });
      console.log('✅ Property update notification created');
    } catch (notifError) {
      console.error('⚠️ Notification creation failed:', notifError.message);
    }

    res.json({ 
      success: true,
      property: propertyWithOwner 
    });
  } catch (err) {
    console.error('Error updating property:', err);
    res.status(500).json({ error: 'Failed to update property', details: err.message });
  }
};

// DELETE property - FIXED NOTIFICATIONS
exports.deleteProperty = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ error: 'Property not found' });

    const owner = await Owner.findOne({ ownerId: property.ownerId });
    if (owner && owner.propertyOwned > 0) {
      owner.propertyOwned -= 1;
      await owner.save();
    }

    await Property.findByIdAndDelete(req.params.id);

    // Create admin notification
    try {
      console.log('📢 Creating property deletion notification...');
      await notificationController.createNotification({
        userId: req.user?._id || null,
        type: 'property_deleted',
        target: 'admin',
        title: 'Property Deleted',
        message: `Property "${property.name}" was deleted`,
        propertyName: property.name,
        propertyId: property._id,
        relatedId: property._id,
      });
      console.log('✅ Property deletion notification created');
    } catch (notifError) {
      console.error('⚠️ Notification creation failed:', notifError.message);
    }

    res.json({ 
      success: true,
      message: 'Property deleted successfully',
    });
  } catch (err) {
    console.error('Error deleting property:', err);
    res.status(500).json({ error: 'Failed to delete property' });
  }
};