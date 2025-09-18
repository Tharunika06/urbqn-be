// models/owner.js

const mongoose = require('mongoose');

// Define the schema for a single property


const OwnerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  ownerId: { type: String, required: true, unique: true },
  email: { type: String },
  contact: { type: String },
  address: { type: String },
  doj: { type: Date },
  status: { type: String },
  city: { type: String },
  photo: { // This is the owner's photo
    type: String,
    required: true
  },
  // Professional Info
  agency: { type: String },
  licenseNumber: { type: String },
  textNumber: { type: String },
  servicesArea: { type: String },
  about: { type: String },

  // Property Stats
  totalListing: { type: Number },
  propertySold: { type: Number },
  propertyRent: { type: Number },

  // Array of properties using the sub-schema

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Owner', OwnerSchema);
