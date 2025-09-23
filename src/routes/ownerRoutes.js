// src/routes/ownerRoutes.js
const express = require('express');
const router = express.Router();
const ownerController = require('../controllers/ownerController');

// --- Utility Routes (MUST come before parameterized routes) ---

// Get photo statistics
router.get('/stats/photos', async (req, res) => {
  try {
    const Owner = require('../models/Owner');
    const stats = await Owner.getPhotoStats();
    
    console.log('Photo statistics requested');
    
    res.status(200).json({
      message: 'Photo statistics retrieved successfully',
      stats
    });

  } catch (error) {
    console.error('Error getting photo stats:', error);
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
    
    console.log(`Found ${ownersWithoutPhotos.length} owners without photos`);
    
    res.status(200).json({
      message: 'Owners without photos retrieved successfully',
      count: ownersWithoutPhotos.length,
      owners: ownersWithoutPhotos
    });

  } catch (error) {
    console.error('Error finding owners without photos:', error);
    res.status(500).json({
      error: 'Failed to find owners without photos'
    });
  }
});

// --- Main Owner Routes ---

// Get all owners (with optional photo exclusion for performance)
// Usage: GET /owners OR GET /owners?includePhotos=false
router.get('/', ownerController.getAllOwners);

// Add new owner with base64 photo (NO middleware - handles JSON directly)
router.post('/add-owner', ownerController.addOwner);

// Get single owner by ID with photo
router.get('/:ownerId', ownerController.getOwnerById);

// Update owner with optional new photo (NO middleware - handles JSON directly)
router.put('/:ownerId', ownerController.updateOwner);

// Delete owner
router.delete('/:ownerId', ownerController.deleteOwner);

// --- Photo-specific Routes ---

// Get only owner photo (separate endpoint for performance)
router.get('/:ownerId/photo', ownerController.getOwnerPhoto);

// Update only owner photo (handles base64 directly)
router.patch('/:ownerId/photo', async (req, res) => {
  try {
    const { photo } = req.body;
    
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

    const Owner = require('../models/Owner');
    const updatedOwner = await Owner.findOneAndUpdate(
      { ownerId: req.params.ownerId },
      { 
        photo: photo,
        'photoInfo.uploadDate': new Date(),
        'photoInfo.size': Buffer.byteLength(photo, 'utf8')
      },
      { new: true }
    );

    if (!updatedOwner) {
      return res.status(404).json({
        error: 'Owner not found'
      });
    }

    console.log(`Updated photo for owner: ${req.params.ownerId}`);

    res.status(200).json({
      message: 'Owner photo updated successfully',
      ownerId: updatedOwner.ownerId,
      name: updatedOwner.name,
      hasPhoto: !!updatedOwner.photo
    });

  } catch (error) {
    console.error('Error updating owner photo:', error);
    res.status(500).json({
      error: 'Failed to update owner photo'
    });
  }
});

// Remove owner photo
router.delete('/:ownerId/photo', async (req, res) => {
  try {
    const Owner = require('../models/Owner');
    
    const updatedOwner = await Owner.findOneAndUpdate(
      { ownerId: req.params.ownerId },
      { 
        $unset: { 
          photo: 1,
          photoInfo: 1
        }
      },
      { new: true, runValidators: false } // Skip validation since photo is optional now
    );

    if (!updatedOwner) {
      return res.status(404).json({
        error: 'Owner not found'
      });
    }

    console.log(`Removed photo for owner: ${req.params.ownerId}`);

    res.status(200).json({
      message: 'Owner photo removed successfully',
      ownerId: updatedOwner.ownerId,
      name: updatedOwner.name,
      hasPhoto: false
    });

  } catch (error) {
    console.error('Error removing owner photo:', error);
    res.status(500).json({
      error: 'Failed to remove owner photo'
    });
  }
});

module.exports = router;