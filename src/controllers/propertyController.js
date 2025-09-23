// controllers/propertyController.js
const Property = require('../models/Property');
const Owner = require('../models/Owner');
const Notification = require('../models/Notification');
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

// POST new property - UPDATED to handle base64 images
exports.createProperty = async (req, res) => {
  try {
    const {
      name, type, price, rentPrice, salePrice, status,
      bedrooms, bath, size, floor, address, zip, country,
      city, rating, ownerId, about, facility, photo // Added photo from request body
    } = req.body;

    console.log('Received property data:', {
      name,
      status,
      ownerId,
      photo: photo ? `Base64 data received (${photo.length} chars)` : 'No photo'
    });

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

    // Clean prices
    const cleanedPrices = {
      price: cleanPrice(price),
      rentPrice: cleanPrice(rentPrice),
      salePrice: cleanPrice(salePrice)
    };

    // Handle facilities array
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

    // Validate base64 image if provided
    let validatedPhoto = '';
    if (photo) {
      // Check if it's a valid base64 data URL
      if (photo.startsWith('data:image/') && photo.includes('base64,')) {
        validatedPhoto = photo;
        console.log('Valid base64 image received');
      } else {
        console.warn('Invalid image format received');
        return res.status(400).json({ error: 'Invalid image format. Please upload a valid image.' });
      }
    }

    const newProperty = new Property({
      name,
      type: type || 'Apartment',
      price: cleanedPrices.price,
      rentPrice: cleanedPrices.rentPrice,
      salePrice: cleanedPrices.salePrice,
      status: normalizedStatus,
      bedrooms: bedrooms ? parseInt(bedrooms) : undefined,
      bath: bath ? parseInt(bath) : undefined,
      size,
      floor,
      address,
      zip,
      country,
      city,
      rating: rating ? parseFloat(rating) : 4.5,
      photo: validatedPhoto, // Store base64 string directly
      facility: facilitiesArray,
      about,
      ownerId: numericOwnerId,
      ownerName: owner.name
    });

    await newProperty.save();
    console.log('Property saved successfully with ID:', newProperty._id);

    // Update owner property count
    owner.propertyOwned = (owner.propertyOwned || 0) + 1;
    await owner.save();

    // Create notification
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
    res.status(500).json({ 
      error: 'Failed to add property', 
      details: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
};

// PUT update property - UPDATED to handle base64 images
exports.updateProperty = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ error: 'Property not found' });

    const updateFields = {};
    const {
      name, type, price, rentPrice, salePrice, status,
      bedrooms, bath, size, floor, address, zip, country,
      city, rating, about, facility, photo // Added photo from request body
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

    // Handle base64 photo update
    if (photo) {
      if (photo.startsWith('data:image/') && photo.includes('base64,')) {
        updateFields.photo = photo;
      } else {
        return res.status(400).json({ error: 'Invalid image format' });
      }
    }

    const updatedProperty = await Property.findByIdAndUpdate(req.params.id, updateFields, { new: true });
    const propertyWithOwner = await populateOwnerDetails(updatedProperty);

    res.json(propertyWithOwner);
  } catch (err) {
    console.error('Error updating property:', err);
    res.status(500).json({ error: 'Failed to update property', details: err.message });
  }
};

// DELETE property
exports.deleteProperty = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ error: 'Property not found' });

    // No need to delete physical files since we're storing base64 in DB

    const owner = await Owner.findOne({ ownerId: property.ownerId });
    if (owner && owner.propertyOwned > 0) {
      owner.propertyOwned -= 1;
      await owner.save();
    }

    await Property.findByIdAndDelete(req.params.id);

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
};