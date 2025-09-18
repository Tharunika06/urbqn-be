// routes/profileRoutes.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Profile = require("../models/Profile");
const Counter = require("../models/Counter");
const Notification = require("../models/Notification");

// --- Helper: Generate Sequential ID ---
async function getNextSequenceValue(sequenceName) {
  try {
    const sequenceDocument = await Counter.findOneAndUpdate(
      { _id: sequenceName },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    return sequenceDocument.seq;
  } catch (error) {
    console.error("Error generating sequence:", error);
    throw error;
  }
}

// --- Ensure upload directory exists ---
const uploadDir = path.join(__dirname, "../uploads/profiles");
const parentUploadDir = path.join(__dirname, "../uploads");

if (!fs.existsSync(parentUploadDir)) {
  fs.mkdirSync(parentUploadDir, { recursive: true });
}
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// --- Multer Config ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

// File filter to allow only images
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  }
}).single("profileImage");

// --- POST: Add Profile ---
router.post("/add-profile", (req, res) => {
  upload(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: "File too large. Maximum size is 5MB." });
      }
      return res.status(400).json({ error: err.message });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }

    try {
      const { firstName, lastName, dob, email, phone, gender } = req.body;

      // Validation
      if (!firstName) {
        return res.status(400).json({ error: "First name is required" });
      }
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }
      if (phone && !/^\d{10}$/.test(phone)) {
        return res.status(400).json({ error: "Phone number must be 10 digits" });
      }

      // Check if email already exists
      const existingProfile = await Profile.findOne({ email });
      if (existingProfile) {
        return res.status(409).json({ error: "Profile with this email already exists" });
      }

      const profileImagePath = req.file ? `/uploads/profiles/${req.file.filename}` : "";

      // Generate next sequential profileId
      const nextProfileId = await getNextSequenceValue("profileId");

      // Create Profile
      const newProfile = new Profile({
        profileId: nextProfileId.toString(),
        firstName,
        lastName: lastName || "",
        dob: dob ? new Date(dob) : undefined,
        email,
        phone: phone || "",
        gender: gender || "",
        profileImage: profileImagePath
      });

      const savedProfile = await newProfile.save();

      // ✅ Create notification for new profile
      try {
        const notification = new Notification({
          type: "profile",
          message: `New profile "${savedProfile.firstName} ${savedProfile.lastName || ''}".trim() created.`,
          relatedId: savedProfile._id
        });
        await notification.save();
      } catch (notificationError) {
        console.error("Error creating notification:", notificationError);
        // Don't fail the main operation if notification fails
      }

      console.log("Profile created successfully:", savedProfile);
      res.status(201).json({
        message: "Profile created successfully",
        profile: savedProfile
      });

    } catch (error) {
      console.error("Error saving profile:", error);
      
      // Delete uploaded file if profile creation fails
      if (req.file) {
        const filePath = path.join(uploadDir, req.file.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      if (error.code === 11000) {
        return res.status(409).json({ error: "A profile with this ID already exists." });
      }
      
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// --- GET: All Profiles ---
router.get("/", async (req, res) => {
  try {
    const profiles = await Profile.find().sort({ createdAt: -1 });
    res.status(200).json(profiles);
  } catch (error) {
    console.error("Error fetching profiles:", error);
    res.status(500).json({ error: "Failed to fetch profiles" });
  }
});

// --- GET: Single Profile by ID ---
router.get("/:profileId", async (req, res) => {
  try {
    const profile = await Profile.findOne({ profileId: req.params.profileId });
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }
    res.status(200).json(profile);
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// --- PUT: Update Profile ---
router.put("/:profileId", (req, res) => {
  upload(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: "File too large. Maximum size is 5MB." });
      }
      return res.status(400).json({ error: err.message });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }

    try {
      const { profileId } = req.params;
      const { firstName, lastName, dob, email, phone, gender } = req.body;

      const profile = await Profile.findOne({ profileId });
      if (!profile) {
        return res.status(404).json({ error: "Profile not found" });
      }

      // Update fields
      if (firstName) profile.firstName = firstName;
      if (lastName !== undefined) profile.lastName = lastName;
      if (dob) profile.dob = new Date(dob);
      if (email) profile.email = email;
      if (phone !== undefined) profile.phone = phone;
      if (gender !== undefined) profile.gender = gender;

      // Handle image update
      if (req.file) {
        // Delete old image if exists
        if (profile.profileImage) {
          const oldImagePath = path.join(__dirname, "..", profile.profileImage);
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
          }
        }
        profile.profileImage = `/uploads/profiles/${req.file.filename}`;
      }

      const updatedProfile = await profile.save();

      res.status(200).json({
        message: "Profile updated successfully",
        profile: updatedProfile
      });

    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });
});

// --- DELETE: Profile by ID ---
router.delete("/:profileId", async (req, res) => {
  try {
    const { profileId } = req.params;
    const profile = await Profile.findOne({ profileId });
    
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    await Profile.findOneAndDelete({ profileId });

    // ✅ Create notification for deleted profile
    try {
      const notification = new Notification({
        type: "profile",
        message: `Profile "${profile.firstName} ${profile.lastName || ''}".trim() (ID: ${profile.profileId}) deleted.`,
        relatedId: profile._id
      });
      await notification.save();
    } catch (notificationError) {
      console.error("Error creating notification:", notificationError);
    }

    // Delete uploaded image
    if (profile.profileImage) {
      const profilePath = path.join(__dirname, "..", profile.profileImage);
      if (fs.existsSync(profilePath)) {
        fs.unlinkSync(profilePath);
      }
    }

    res.status(200).json({ 
      message: "Profile deleted successfully", 
      deletedProfileId: profileId 
    });

  } catch (error) {
    console.error("Error deleting profile:", error);
    res.status(500).json({ error: "Failed to delete profile" });
  }
});

module.exports = router;