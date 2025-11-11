// backend/src/models/Admin.js
const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  // ✅ Email is REQUIRED - links to User model
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  
  // Profile fields
  name: { 
    type: String, 
    default: "" 
  },
  phone: { 
    type: String, 
    default: "" 
  },
  photo: { 
    type: String, 
    default: "" 
  },
  
  // Role/Status fields (optional, inherited from User)
  role: {
    type: String,
    default: 'admin',
    enum: ['admin', 'superadmin']
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Create indexes for faster queries
adminSchema.index({ email: 1 });
adminSchema.index({ phone: 1 });

module.exports = mongoose.model('Admin', adminSchema);