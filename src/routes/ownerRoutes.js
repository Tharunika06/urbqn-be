// src/routes/ownerRoutes.js
const express = require('express');
const router = express.Router();
const ownerController = require('../controllers/ownerController');

// --- Utility Routes (MUST come before parameterized routes) ---

// Get photo statistics
router.get('/stats/photos', ownerController.getPhotoStats);

// Get owners without photos (for debugging/migration)
router.get('/utils/no-photos', ownerController.getOwnersWithoutPhotos);

// --- Main Owner Routes ---

// Get all owners (with optional photo exclusion for performance)
// Usage: GET /owners OR GET /owners?includePhotos=false
router.get('/', ownerController.getAllOwners);

// Add new owner with base64 photo (accepts JSON)
router.post('/add-owner', ownerController.addOwner);

// Get single owner by ID with photo
router.get('/:ownerId', ownerController.getOwnerById);

// Update owner with optional new photo (accepts JSON)
router.put('/:ownerId', ownerController.updateOwner);

// Delete owner
router.delete('/:ownerId', ownerController.deleteOwner);

// --- Photo-specific Routes ---

// Get only owner photo (separate endpoint for performance)
router.get('/:ownerId/photo', ownerController.getOwnerPhoto);

// Update only owner photo (handles base64 directly)
router.patch('/:ownerId/photo', ownerController.updateOwnerPhoto);

// Remove owner photo
router.delete('/:ownerId/photo', ownerController.removeOwnerPhoto);

module.exports = router;