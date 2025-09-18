// models/Profile.js
const mongoose = require("mongoose");

const ProfileSchema = new mongoose.Schema({
  profileId: { type: String, required: true, unique: true }, // auto-increment
  firstName: { type: String, required: true },
  lastName: { type: String },
  dob: { type: Date },
  email: { type: String },
  phone: { type: String },
  gender: { type: String },
  profileImage: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Profile", ProfileSchema);
