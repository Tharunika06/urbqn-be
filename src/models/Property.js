// models/property.js
const mongoose = require('mongoose');

const PropertySchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true 
  },
  
  // Base64 photo storage - stores complete data URL
  photo: { 
    type: String // Will store: "data:image/jpeg;base64,/9j/4AAQ..."
  },
  
  // Photo metadata
  photoInfo: {
    originalName: { type: String },
    mimeType: { type: String },
    size: { type: Number }, // Size in bytes
    uploadDate: { type: Date, default: Date.now }
  },

  size: { 
    type: String,
    trim: true 
  },
  type: { 
    type: String,
    trim: true,
    default: 'Apartment'
  },
  status: { 
    type: String, 
    enum: ['rent', 'sale', 'both'], 
    required: true,
    lowercase: true
  },
  bedrooms: { type: Number },
  bath: { type: Number },
  floor: { 
    type: String,
    trim: true 
  },
  address: { 
    type: String,
    trim: true 
  },
  zip: { 
    type: String,
    trim: true 
  },
  country: { 
    type: String,
    trim: true 
  },
  city: { 
    type: String,
    trim: true 
  },
  visits: { type: Number, default: 0 },
  
  // Price fields - keep as mixed to handle both strings and numbers
  price: { type: mongoose.Schema.Types.Mixed }, // Fallback generic price
  rentPrice: { type: mongoose.Schema.Types.Mixed }, // Specific rent price
  salePrice: { type: mongoose.Schema.Types.Mixed }, // Specific sale price

  rating: { type: Number, default: 4.5 },
  ownerId: { type: Number, required: true },
  ownerName: { type: String, required: true },
  facility: { type: [String], default: [] },
  about: { 
    type: String,
    trim: true 
  },
  createdAt: { type: Date, default: Date.now }
});

// Indexes for better performance
PropertySchema.index({ ownerId: 1 });
PropertySchema.index({ type: 1 });
PropertySchema.index({ status: 1 });
PropertySchema.index({ city: 1 });
PropertySchema.index({ createdAt: -1 });

// Virtual to check if property has photo
PropertySchema.virtual('hasPhoto').get(function() {
  return !!(this.photo && this.photo.startsWith('data:'));
});

// Virtual field to compute the display location
PropertySchema.virtual('location').get(function() {
  if (this.city && this.country) {
    return `${this.city}, ${this.country}`;
  } else if (this.address) {
    return this.address;
  }
  return 'Location not specified';
});

// Method to get photo size in KB
PropertySchema.methods.getPhotoSize = function() {
  if (!this.photo) return 0;
  
  // Calculate approximate size in KB
  const base64Length = this.photo.length;
  const padding = (this.photo.match(/=/g) || []).length;
  const sizeInBytes = (base64Length * 3) / 4 - padding;
  
  return Math.round(sizeInBytes / 1024); // Return in KB
};

// Method to get photo format
PropertySchema.methods.getPhotoFormat = function() {
  if (!this.photo) return null;
  
  const match = this.photo.match(/^data:image\/([^;]+);base64,/);
  return match ? match[1] : null;
};

// Pre-save middleware to validate and process data
PropertySchema.pre('save', function(next) {
  // Validate base64 photo if provided
  if (this.photo && this.photo.length > 0) {
    if (!this.photo.startsWith('data:image/')) {
      return next(new Error('Photo must be a valid base64 data URL'));
    }
    
    // Check if it's too large (MongoDB 16MB document limit)
    const sizeInMB = Buffer.byteLength(this.photo, 'utf8') / (1024 * 1024);
    if (sizeInMB > 15) { // Leave some room for other fields
      return next(new Error('Photo is too large. Maximum size is 15MB'));
    }
  }
  
  next();
});

// Transform function to control JSON output
PropertySchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret, options) {
    // Remove MongoDB internal fields
    delete ret.__v;
    
    // Add computed fields
    ret.hasPhoto = !!(ret.photo && ret.photo.startsWith('data:'));
    
    // Optionally exclude photo for list views (if query param says so)
    if (options.excludePhoto) {
      delete ret.photo;
      delete ret.photoInfo;
    }
    
    return ret;
  }
});

// Ensure virtual fields are included when converting to JSON
PropertySchema.set('toObject', { virtuals: true });

// Static method to find properties without photos (for migration purposes)
PropertySchema.statics.findPropertiesWithoutPhotos = function() {
  return this.find({
    $or: [
      { photo: { $exists: false } },
      { photo: null },
      { photo: '' },
      { photo: { $not: /^data:image\// } }
    ]
  });
};

// Static method to get photo statistics
PropertySchema.statics.getPhotoStats = async function() {
  const totalProperties = await this.countDocuments();
  const propertiesWithPhotos = await this.countDocuments({
    photo: { $exists: true, $ne: null, $ne: '', $regex: /^data:image\// }
  });
  
  return {
    totalProperties,
    propertiesWithPhotos,
    propertiesWithoutPhotos: totalProperties - propertiesWithPhotos,
    photoPercentage: totalProperties > 0 ? Math.round((propertiesWithPhotos / totalProperties) * 100) : 0
  };
};

module.exports = mongoose.model('Property', PropertySchema);