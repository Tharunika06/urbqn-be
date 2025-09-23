const Admin = require('../models/AdminProfile');

// Get profile
exports.getProfile = async (req, res) => {
  try {
    let profile = await Admin.findOne();
    if (!profile) {
      profile = new Admin({ name: "", phone: "", photo: "" });
      await profile.save();
    }
    res.json({ success: true, profile });
  } catch (error) {
    console.error("Error fetching admin profile:", error);
    res.status(500).json({ success: false, message: "Failed to fetch profile" });
  }
};

// Update profile
exports.updateProfile = async (req, res) => {
  try {
    let profile = await Admin.findOne();
    if (!profile) {
      profile = new Admin();
    }

    if (req.body.name) profile.name = req.body.name;
    if (req.body.phone) profile.phone = req.body.phone;

    // Convert uploaded file to base64 DataURL
    if (req.file) {
      profile.photo = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    }

    await profile.save();
    res.json({ success: true, profile });
  } catch (error) {
    console.error("Error updating admin profile:", error);
    res.status(500).json({ success: false, message: "Failed to update admin profile" });
  }
};

// Delete profile photo
exports.deletePhoto = async (req, res) => {
  try {
    let profile = await Admin.findOne();
    if (!profile) {
      return res.status(404).json({ success: false, message: "Profile not found" });
    }

    profile.photo = "";
    await profile.save();

    res.json({ success: true, message: "Photo deleted" });
  } catch (error) {
    console.error("Error deleting admin photo:", error);
    res.status(500).json({ success: false, message: "Failed to delete photo" });
  }
};
