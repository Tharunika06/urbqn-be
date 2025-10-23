// routes/propertyRoutes.js
const express = require('express');
const router = express.Router();
const propertyController = require('../controllers/propertyController');
const Transaction = require('../models/Transaction');

// ============ AVAILABILITY CHECK ROUTES ============

/**
 * Get all sold-out property IDs
 * Returns array of property IDs that have been purchased (not rented)
 */
router.get('/sold-out', async (req, res) => {
  try {
    console.log('📋 Fetching sold-out properties...');
    
    // Find all transactions where purchaseType is 'buy' (not 'rent')
    const soldProperties = await Transaction.aggregate([
      {
        $match: {
          purchaseType: 'buy',
          status: 'Completed'
        }
      },
      {
        $group: {
          _id: '$property',
          soldCount: { $sum: 1 },
          lastSoldDate: { $max: '$createdAt' }
        }
      },
      {
        $project: {
          propertyId: '$_id',
          soldCount: 1,
          lastSoldDate: 1,
          _id: 0
        }
      }
    ]);

    const soldPropertyIds = soldProperties.map(p => p.propertyId.toString());
    
    console.log(`✅ Found ${soldPropertyIds.length} sold properties`);
    
    res.status(200).json({
      success: true,
      soldProperties: soldPropertyIds,
      count: soldPropertyIds.length,
      details: soldProperties
    });

  } catch (error) {
    console.error('❌ Error fetching sold properties:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sold properties',
      message: error.message
    });
  }
});

/**
 * Get all available properties (excluding sold ones)
 * This endpoint filters out properties that have been purchased
 */
router.get('/available', async (req, res) => {
  try {
    console.log('🏠 Fetching available properties...');
    
    const Property = require('../models/Property');
    
    // Get all sold property IDs
    const soldProperties = await Transaction.aggregate([
      {
        $match: {
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

    // Get all properties that are NOT in the sold list
    const availableProperties = await Property.find({
      _id: { $nin: soldPropertyIds }
    });

    console.log(`✅ Found ${availableProperties.length} available properties`);
    console.log(`❌ Excluded ${soldPropertyIds.length} sold properties`);

    res.status(200).json({
      success: true,
      properties: availableProperties,
      totalAvailable: availableProperties.length,
      totalSold: soldPropertyIds.length
    });

  } catch (error) {
    console.error('❌ Error fetching available properties:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch available properties',
      message: error.message
    });
  }
});

// ============ EXISTING PROPERTY ROUTES ============

// Get all properties (with optional includePhotos query param)
router.get('/', propertyController.getAllProperties);

// Get properties by category/type
router.get('/category/:type', propertyController.getPropertiesByCategory);

// Get properties by owner
router.get('/owner/:ownerId', propertyController.getPropertiesByOwner);

/**
 * Check if a specific property is available for purchase
 * Must be BEFORE the generic /:id route to avoid route conflicts
 */
router.get('/:id/availability', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🔍 Checking availability for property: ${id}`);

    // Check if property exists first
    const Property = require('../models/Property');
    const property = await Property.findById(id);
    
    if (!property) {
      return res.status(404).json({
        success: false,
        error: 'Property not found'
      });
    }

    // Check if property has been purchased (not rented)
    const purchaseTransaction = await Transaction.findOne({
      property: id,
      purchaseType: 'buy',
      status: 'Completed'
    }).sort({ createdAt: -1 }); // Get the most recent purchase

    const isAvailable = !purchaseTransaction;
    
    console.log(`${isAvailable ? '✅' : '❌'} Property ${id} is ${isAvailable ? 'AVAILABLE' : 'SOLD'}`);
    
    res.status(200).json({
      success: true,
      propertyId: id,
      propertyName: property.name,
      isAvailable,
      isSold: !isAvailable,
      soldDate: purchaseTransaction?.createdAt || null,
      soldTo: purchaseTransaction?.customerName || null,
      transactionId: purchaseTransaction?.customTransactionId || null
    });

  } catch (error) {
    console.error('❌ Error checking property availability:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check property availability',
      message: error.message
    });
  }
});

// Get property with owner details
router.get('/:id/with-owner', propertyController.getPropertyWithOwner);

// Get property by ID
router.get('/:id', propertyController.getPropertyById);

// Create new property (handles JSON with base64 image)
router.post('/', propertyController.createProperty);

// Update property
router.put('/:id', propertyController.updateProperty);

// Delete property
router.delete('/:id', propertyController.deleteProperty);

module.exports = router;