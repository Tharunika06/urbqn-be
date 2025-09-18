// models/AdminProfile.js
const mongoose = require('mongoose');

const adminProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    unique: true,
    ref: 'User' // Reference to your user model
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    trim: true,
    maxlength: 15
  },
  photo: {
    type: String, // URL or base64 string
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
adminProfileSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Create indexes for better performance
adminProfileSchema.index({ userId: 1 });
adminProfileSchema.index({ updatedAt: -1 });

module.exports = mongoose.model('AdminProfile', adminProfileSchema);