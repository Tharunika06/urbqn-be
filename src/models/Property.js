const mongoose = require('mongoose');

const PropertySchema = new mongoose.Schema({
  name: { type: String, required: true },
  photo: { type: String },
  size: { type: String },
  type: { type: String },
  status: { 
    type: String, 
    enum: ['rent', 'sale', 'both'], 
    required: true,
    lowercase: true // Automatically convert to lowercase
  },
  bedrooms: { type: Number },
  bath: { type: Number },
  floor: { type: String },
  address: { type: String },
  zip: { type: String },
  country: { type: String },
  city: { type: String },
   visits: { type: Number, default: 0 },
  // Price fields - keep as mixed to handle both strings and numbers
  price: { type: mongoose.Schema.Types.Mixed }, // Fallback generic price
  rentPrice: { type: mongoose.Schema.Types.Mixed }, // Specific rent price
  salePrice: { type: mongoose.Schema.Types.Mixed }, // Specific sale price
  
  rating: { type: Number, default: 4.5 },
  ownerId: { type: Number, required: true },
  ownerName: { type: String, required: true },
  facility: { type: [String], default: [] },
  about: { type: String },
  createdAt: { type: Date, default: Date.now }
});

// Add a virtual field to compute the display location
PropertySchema.virtual('location').get(function() {
  if (this.city && this.country) {
    return `${this.city}, ${this.country}`;
  } else if (this.address) {
    return this.address;
  }
  return 'Location not specified';
});

// Ensure virtual fields are included when converting to JSON
PropertySchema.set('toJSON', { virtuals: true });
PropertySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Property', PropertySchema);