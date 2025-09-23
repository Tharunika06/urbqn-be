// routes/propertyRoutes.js
const express = require('express');
const router = express.Router();
const propertyController = require('../controllers/propertyController');

// Routes - Removed multer middleware since we're handling base64 directly
router.get('/', propertyController.getAllProperties);
router.get('/category/:type', propertyController.getPropertiesByCategory);
router.get('/owner/:ownerId', propertyController.getPropertiesByOwner);
router.get('/:id', propertyController.getPropertyById);
router.get('/:id/with-owner', propertyController.getPropertyWithOwner);

// Updated to handle JSON directly (no file upload middleware)
router.post('/', propertyController.createProperty);
router.put('/:id', propertyController.updateProperty);
router.delete('/:id', propertyController.deleteProperty);

module.exports = router;