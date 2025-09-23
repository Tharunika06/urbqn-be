// src/routes/ownerRoutes.js
const express = require('express');
const router = express.Router();
const ownerController = require('../controllers/ownerController');
const { uploadOwnerPhoto } = require('../middleware/uploadMiddleware');

// --- Main Owner Routes ---

// Add new owner with base64 photo
router.post('/add-owner', uploadOwnerPhoto, ownerController.addOwner);

// Get all owners (with optional photo exclusion for performance)
// Usage: GET /owners OR GET /owners?includePhotos=false
router.get('/', ownerController.getAllOwners);

// Get single owner by ID with photo
router.get('/:ownerId', ownerController.getOwnerById);

// Update owner with optional new photo
router.put('/:ownerId', uploadOwnerPhoto, ownerController.updateOwner);

// Delete owner
router.delete('/:ownerId', ownerController.deleteOwner);

// --- Additional Photo-specific Routes ---

// Get only owner photo (separate endpoint for performance)
router.get('/:ownerId/photo', ownerController.getOwnerPhoto);

// Update only owner photo
router.patch('/:ownerId/photo', uploadOwnerPhoto, async (req, res) => {
  try {
    if (!req.photoBase64) {
      return res.status(400).json({
        error: 'No photo provided'
      });
    }

    const Owner = require('../models/Owner');
    const updatedOwner = await Owner.findOneAndUpdate(
      { ownerId: req.params.ownerId },
      { 
        photo: req.photoBase64,
        photoInfo: req.photoInfo
      },
      { new: true }
    );

    if (!updatedOwner) {
      return res.status(404).json({
        error: 'Owner not found'
      });
    }

    console.log(`📸 Updated photo for owner: ${req.params.ownerId}`);

    res.status(200).json({
      message: 'Owner photo updated successfully',
      ownerId: updatedOwner.ownerId,
      name: updatedOwner.name,
      hasPhoto: !!updatedOwner.photo
    });

  } catch (error) {
    console.error('❌ Error updating owner photo:', error);
    res.status(500).json({
      error: 'Failed to update owner photo'
    });
  }
});

// Remove owner photo
router.delete('/:ownerId/photo', async (req, res) => {
  try {
    const Owner = require('../models/Owner');
    
    // Note: Since photo is required in schema, we'll set it to a placeholder or handle this differently
    // For now, let's update the schema requirement or use a default image
    const updatedOwner = await Owner.findOneAndUpdate(
      { ownerId: req.params.ownerId },
      { 
        $unset: { 
          photo: 1,
          photoInfo: 1
        }
      },
      { new: true }
    );

    if (!updatedOwner) {
      return res.status(404).json({
        error: 'Owner not found'
      });
    }

    console.log(`🗑️ Removed photo for owner: ${req.params.ownerId}`);

    res.status(200).json({
      message: 'Owner photo removed successfully',
      ownerId: updatedOwner.ownerId,
      name: updatedOwner.name,
      hasPhoto: false
    });

  } catch (error) {
    console.error('❌ Error removing owner photo:', error);
    res.status(500).json({
      error: 'Failed to remove owner photo'
    });
  }
});

// --- Utility Routes ---

// Get photo statistics
router.get('/stats/photos', async (req, res) => {
  try {
    const Owner = require('../models/Owner');
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
});

// Get owners without photos (for debugging/migration)
router.get('/utils/no-photos', async (req, res) => {
  try {
    const Owner = require('../models/Owner');
    const ownersWithoutPhotos = await Owner.findOwnersWithoutPhotos().select('ownerId name email');
    
    console.log(`🔍 Found ${ownersWithoutPhotos.length} owners without photos`);
    
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
});

module.exports = router;