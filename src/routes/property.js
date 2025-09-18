// server/src/routes/property.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const Property = require('../models/Property');
const Owner = require('../models/Owner');
const Notification = require('../models/Notification'); // ✅ Import notification model

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Helper function to clean and convert price
const cleanPrice = (priceInput) => {
  if (!priceInput) return null;
  if (typeof priceInput === 'number') return priceInput;
  if (typeof priceInput === 'string') {
    const cleaned = priceInput.replace(/[^\d.-]/g, '');
    const numericValue = parseFloat(cleaned);
    return !isNaN(numericValue) ? numericValue : null;
  }
  return null;
};

// Helper function to populate owner details
const populateOwnerDetails = async (properties) => {
  if (!Array.isArray(properties)) {
    if (properties.ownerId) {
      const owner = await Owner.findOne({ ownerId: properties.ownerId });
      return {
        ...properties.toObject(),
        ownerDetails: owner ? {
          ownerId: owner.ownerId,
          name: owner.name,
          email: owner.email,
          contact: owner.contact,
          photo: owner.photo,
          propertyOwned: owner.propertyOwned,
          createdAt: owner.createdAt
        } : null
      };
    }
    return properties.toObject();
  }

  const propertiesWithOwners = await Promise.all(
    properties.map(async (property) => {
      if (property.ownerId) {
        const owner = await Owner.findOne({ ownerId: property.ownerId });
        return {
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
        };
      }
      return property.toObject();
    })
  );

  return propertiesWithOwners;
};

// ---------------- ROUTES ----------------

// GET all properties with owner details
router.get('/', async (req, res) => {
  try {
    const properties = await Property.find();
    const propertiesWithOwners = await populateOwnerDetails(properties);
    res.json(propertiesWithOwners);
  } catch (err) {
    console.error('Error fetching properties:', err);
    res.status(500).json({ error: 'Failed to fetch all properties' });
  }
});

// GET properties by category
router.get('/category/:type', async (req, res) => {
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
});

// GET properties by owner ID (Updated with debugging and better handling)
router.get('/owner/:ownerId', async (req, res) => {
  try {
    const { ownerId } = req.params;
    // console.log('🔍 Received ownerId:', ownerId, 'Type:', typeof ownerId);
    
    // Try both string and numeric conversion
    const numericOwnerId = parseInt(ownerId);
    // console.log('🔢 Converted to numeric:', numericOwnerId, 'isNaN:', isNaN(numericOwnerId));

    if (isNaN(numericOwnerId)) {
      console.log('❌ Invalid owner ID provided');
      return res.status(400).json({ error: 'Invalid owner ID' });
    }

    // First, verify the owner exists
    const owner = await Owner.findOne({ ownerId: numericOwnerId });
    console.log('👤 Owner found:', owner ? owner.name : 'Not found');
    
    if (!owner) {
      console.log('❌ Owner not found in database');
      return res.status(404).json({ error: 'Owner not found' });
    }

    // Search for properties with this ownerId
    // console.log('🏠 Searching for properties with ownerId:', numericOwnerId);
    const properties = await Property.find({ ownerId: numericOwnerId });
    // console.log('📊 Found properties:', properties.length);
    
    // Log sample property if exists
    if (properties.length > 0) {
      console.log('🏡Property:', {
        name: properties[0].name,
        ownerId: properties[0].ownerId,
        ownerIdType: typeof properties[0].ownerId,
        status: properties[0].status
      });
    } else {
      console.log('📭 No properties found for this owner');
    }

    const propertiesWithOwners = await populateOwnerDetails(properties);
    console.log('✅ Returning', propertiesWithOwners.length, 'properties with owner details');
    
    res.json(propertiesWithOwners);
  } catch (err) {
    console.error('Error fetching properties by owner:', err);
    res.status(500).json({ error: 'Failed to fetch properties by owner', details: err.message });
  }
});

// GET property by ID
router.get('/:id', async (req, res) => {
  try {
    // Skip if this looks like the owner route
    if (req.params.id === 'owner') {
      return res.status(404).json({ error: 'Property not found' });
    }

    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ error: 'Property not found' });

    const propertyWithOwner = await populateOwnerDetails(property);
    res.json(propertyWithOwner);
  } catch (err) {
    console.error('Error fetching property by ID:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET property with full owner details
router.get('/:id/with-owner', async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ error: 'Property not found' });

    let ownerDetails = null;
    if (property.ownerId) {
      ownerDetails = await Owner.findOne({ ownerId: property.ownerId });
    }

    const response = {
      ...property.toObject(),
      ownerDetails: ownerDetails ? {
        ownerId: ownerDetails.ownerId,
        name: ownerDetails.name,
        email: ownerDetails.email,
        contact: ownerDetails.contact,
        photo: ownerDetails.photo,
        propertyOwned: ownerDetails.propertyOwned,
        createdAt: ownerDetails.createdAt
      } : null
    };

    res.json(response);
  } catch (err) {
    console.error('Error fetching property with owner details:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST new property
router.post('/', upload.single('photo'), async (req, res) => {
  try {
    const {
      name, type, price, rentPrice, salePrice, status,
      bedrooms, bath, size, floor, address, zip, country,
      city, rating, ownerId, about, facility
    } = req.body;

    console.log('📝 Creating new property:', { name, ownerId, status });

    if (!name || !status || !ownerId) {
      return res.status(400).json({ error: 'Name, status, and ownerId are required' });
    }

    const numericOwnerId = parseInt(ownerId);
    if (isNaN(numericOwnerId)) {
      return res.status(400).json({ error: 'Invalid owner ID' });
    }

    const owner = await Owner.findOne({ ownerId: numericOwnerId });
    if (!owner) return res.status(404).json({ error: 'Owner not found' });

    const validStatuses = ['rent', 'sale', 'both'];
    const normalizedStatus = status.toLowerCase();
    if (!validStatuses.includes(normalizedStatus)) {
      return res.status(400).json({ error: 'Invalid status. Must be one of: rent, sale, both' });
    }

    const cleanedPrices = {
      price: cleanPrice(price),
      rentPrice: cleanPrice(rentPrice),
      salePrice: cleanPrice(salePrice)
    };

    if (normalizedStatus === 'rent' && !cleanedPrices.rentPrice && !cleanedPrices.price) {
      return res.status(400).json({ error: 'Rent price is required for rental properties' });
    }
    if (normalizedStatus === 'sale' && !cleanedPrices.salePrice && !cleanedPrices.price) {
      return res.status(400).json({ error: 'Sale price is required for sale properties' });
    }
    if (normalizedStatus === 'both' && !cleanedPrices.rentPrice && !cleanedPrices.salePrice) {
      return res.status(400).json({ error: 'Both rent and sale prices are required' });
    }

    let facilitiesArray = [];
    if (facility) {
      if (typeof facility === 'string') {
        try {
          const parsed = JSON.parse(facility);
          facilitiesArray = Array.isArray(parsed) ? parsed : [facility];
        } catch (e) {
          facilitiesArray = facility.split(',').map(f => f.trim()).filter(Boolean);
        }
      } else if (Array.isArray(facility)) {
        facilitiesArray = facility;
      }
    }

    const photo = req.file ? `/uploads/${req.file.filename}` : '';

    const newProperty = new Property({
      name,
      type: type || 'Apartment',
      price: cleanedPrices.price,
      rentPrice: cleanedPrices.rentPrice,
      salePrice: cleanedPrices.salePrice,
      status: normalizedStatus,
      bedrooms: bedrooms !== undefined ? parseInt(bedrooms) : undefined,
      bath: bath !== undefined ? parseInt(bath) : undefined,
      size,
      floor,
      address,
      zip,
      country,
      city,
      rating: rating !== undefined ? parseFloat(rating) : 4.5,
      photo,
      facility: facilitiesArray,
      about,
      ownerId: numericOwnerId, // Use the numeric value directly
      ownerName: owner.name
    });

    await newProperty.save();
    console.log('✅ Property saved with ownerId:', newProperty.ownerId, 'Type:', typeof newProperty.ownerId);

    // Update owner's property count
    if (owner.propertyOwned === undefined || owner.propertyOwned === null) {
      owner.propertyOwned = 1;
    } else {
      owner.propertyOwned = owner.propertyOwned + 1;
    }
    await owner.save();
    console.log('📊 Owner property count updated to:', owner.propertyOwned);

    // ✅ Create notification for property creation
    const notification = new Notification({
      type: "property",
      message: `New property "${newProperty.name}" was added by ${owner.name}`,
      relatedId: newProperty._id
    });
    await notification.save();

    const propertyWithOwner = await populateOwnerDetails(newProperty);

    res.status(201).json(propertyWithOwner);
  } catch (err) {
    console.error('💥 Error adding property:', err);
    res.status(500).json({ error: 'Failed to add property', details: err.message });
  }
});

// PUT update property
router.put('/:id', upload.single('photo'), async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ error: 'Property not found' });

    const updateFields = {};
    const {
      name, type, price, rentPrice, salePrice, status,
      bedrooms, bath, size, floor, address, zip, country,
      city, rating, about, facility
    } = req.body;

    if (name) updateFields.name = name;
    if (type) updateFields.type = type;
    if (status) {
      const normalizedStatus = status.toLowerCase();
      if (['rent', 'sale', 'both'].includes(normalizedStatus)) {
        updateFields.status = normalizedStatus;
      }
    }

    if (price !== undefined) updateFields.price = cleanPrice(price);
    if (rentPrice !== undefined) updateFields.rentPrice = cleanPrice(rentPrice);
    if (salePrice !== undefined) updateFields.salePrice = cleanPrice(salePrice);

    if (bedrooms !== undefined) updateFields.bedrooms = parseInt(bedrooms);
    if (bath !== undefined) updateFields.bath = parseInt(bath);
    if (size) updateFields.size = size;
    if (floor) updateFields.floor = floor;
    if (address) updateFields.address = address;
    if (zip) updateFields.zip = zip;
    if (country) updateFields.country = country;
    if (city) updateFields.city = city;
    if (rating !== undefined) updateFields.rating = parseFloat(rating);
    if (about) updateFields.about = about;

    if (facility) {
      let facilitiesArray = [];
      if (typeof facility === 'string') {
        try {
          const parsed = JSON.parse(facility);
          facilitiesArray = Array.isArray(parsed) ? parsed : [facility];
        } catch (e) {
          facilitiesArray = facility.split(',').map(f => f.trim()).filter(Boolean);
        }
      } else if (Array.isArray(facility)) {
        facilitiesArray = facility;
      }
      updateFields.facility = facilitiesArray;
    }

    if (req.file) {
      if (property.photo) {
        const oldPhotoPath = path.join(__dirname, '..', property.photo);
        fs.unlink(oldPhotoPath, (err) => {
          if (err) console.warn('Could not delete old photo:', err.message);
        });
      }
      updateFields.photo = `/uploads/${req.file.filename}`;
    }

    const updatedProperty = await Property.findByIdAndUpdate(
      req.params.id,
      updateFields,
      { new: true }
    );

    const propertyWithOwner = await populateOwnerDetails(updatedProperty);
    res.json(propertyWithOwner);
  } catch (err) {
    console.error('Error updating property:', err);
    res.status(500).json({ error: 'Failed to update property' });
  }
});

// DELETE property by ID
router.delete('/:id', async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ error: 'Property not found' });

    if (property.photo) {
      const photoPath = path.join(__dirname, '..', property.photo);
      fs.unlink(photoPath, (err) => {
        if (err) console.warn('Could not delete photo:', err.message);
      });
    }

    const owner = await Owner.findOne({ ownerId: property.ownerId });
    if (owner && owner.propertyOwned > 0) {
      owner.propertyOwned -= 1;
      await owner.save();
    }

    await Property.findByIdAndDelete(req.params.id);

    // ✅ Create notification for property deletion
    const notification = new Notification({
      type: "property",
      message: `Property "${property.name}" was deleted.`,
      relatedId: property._id
    });
    await notification.save();

    res.json({ message: 'Property deleted successfully' });
  } catch (err) {
    console.error('Error deleting property:', err);
    res.status(500).json({ error: 'Failed to delete property' });
  }
});

module.exports = router;