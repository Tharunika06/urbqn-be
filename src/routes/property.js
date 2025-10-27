// routes/propertyRoutes.js
const express = require('express');
const router = express.Router();
const propertyController = require('../controllers/propertyController');

// ============ AVAILABILITY CHECK ROUTES ============

// Get all sold-out property IDs
router.get('/sold-out', propertyController.getSoldOutProperties);

// Get all available properties (excluding sold ones)
router.get('/available', propertyController.getAvailableProperties);

// ============ EXISTING PROPERTY ROUTES ============

// Get all properties (with optional includePhotos query param)
router.get('/', propertyController.getAllProperties);

// Get properties by category/type
router.get('/category/:type', propertyController.getPropertiesByCategory);

// Get properties by owner
router.get('/owner/:ownerId', propertyController.getPropertiesByOwner);

// Check if a specific property is available for purchase
// Must be BEFORE the generic /:id route to avoid route conflicts
router.get('/:id/availability', propertyController.checkPropertyAvailability);

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