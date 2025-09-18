const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Owner = require('../models/Owner');
const Counter = require('../models/counter');
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

// --- Ensure upload directory exists ---
const uploadDir = path.join(__dirname, '../uploads/owners');
const parentUploadDir = path.join(__dirname, '../uploads');

if (!fs.existsSync(parentUploadDir)) fs.mkdirSync(parentUploadDir);
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// --- Multer Config ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'photo') cb(null, uploadDir);
    else cb(new Error('Invalid file field name'));
  },
  filename: (req, file, cb) => {
    const uniqueName =
      Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({ storage }).fields([{ name: 'photo', maxCount: 1 }]);

// --- POST /add-owner ---
router.post('/add-owner', upload, async (req, res) => {
  try {
    const {
      name, email, contact, address, doj, status, city,
      agency, licenseNumber, textNumber, servicesArea, about,
      propertySold, propertyRent
    } = req.body;

    // Validation
    if (!name) return res.status(400).json({ error: 'Name is required' });
    if (!req.files?.photo?.[0]) return res.status(400).json({ error: 'Owner photo is required' });

    const ownerPhotoPath = `/uploads/owners/${req.files.photo[0].filename}`;

    // Parse numbers safely
    const sold = parseInt(propertySold) || 0;
    const rent = parseInt(propertyRent) || 0;
    const totalListing = sold + rent;

    // Generate next sequential ownerId
    const nextOwnerId = await getNextSequenceValue('ownerId');

    // Create Owner
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
      photo: ownerPhotoPath,
      propertySold: sold,
      propertyRent: rent,
      totalListing
    });

    await newOwner.save();

    // ✅ Create notification for new owner
    const notification = new Notification({
      type: "owner",
      message: `New owner "${newOwner.name}" has been added.`,
      relatedId: newOwner._id
    });
    await notification.save();

    res.status(201).json(newOwner);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: 'An owner with a similar unique field already exists.' });
    }
    console.error('Error adding owner:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- GET: All Owners ---
router.get('/', async (req, res) => {
  try {
    const owners = await Owner.find();
    res.status(200).json(owners);
  } catch (error) {
    console.error('Error fetching owners:', error);
    res.status(500).json({ error: 'Failed to fetch owners' });
  }
});

// --- GET: Single Owner by ID ---
router.get('/:ownerId', async (req, res) => {
  try {
    const owner = await Owner.findOne({ ownerId: req.params.ownerId });

    if (!owner) return res.status(404).json({ error: 'Owner not found' });
    res.status(200).json(owner);
  } catch (error) {
    console.error('Error fetching owner:', error);
    res.status(500).json({ error: 'Failed to fetch owner' });
  }
});

// --- DELETE: Owner by ID ---
router.delete('/:ownerId', async (req, res) => {
  try {
    const { ownerId } = req.params;
    console.log('Attempting to delete owner with ownerId:', ownerId);

    // Find the owner first to get file paths for cleanup
    const owner = await Owner.findOne({ ownerId });

    if (!owner) {
      console.log('Owner not found with ownerId:', ownerId);
      return res.status(404).json({ error: 'Owner not found' });
    }

    // Delete the owner from database
    await Owner.findOneAndDelete({ ownerId });
    console.log('Owner deleted successfully:', ownerId);

    // ✅ Create notification for deleted owner
    const notification = new Notification({
      type: "owner",
      message: `Owner "${owner.name}" (ID: ${owner.ownerId}) was deleted.`,
      relatedId: owner._id
    });
    await notification.save();

    // Optional: Clean up uploaded files
    try {
      if (owner.photo) {
        const ownerPhotoPath = path.join(__dirname, '..', owner.photo);
        if (fs.existsSync(ownerPhotoPath)) {
          fs.unlinkSync(ownerPhotoPath);
          console.log('Deleted owner photo:', ownerPhotoPath);
        }
      }
    } catch (fileError) {
      console.error('Error deleting files:', fileError);
    }

    res.status(200).json({
      message: 'Owner deleted successfully',
      deletedOwnerId: ownerId
    });
  } catch (error) {
    console.error('Error deleting owner:', error);
    res.status(500).json({ error: 'Failed to delete owner' });
  }
});

module.exports = router;
