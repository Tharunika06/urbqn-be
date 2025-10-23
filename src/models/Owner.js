// models/Owner.js
const mongoose = require('mongoose');

const OwnerSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true 
  },
  ownerId: { 
    type: String, 
    required: true, 
    unique: true 
  },
  email: { 
    type: String,
    trim: true,
    lowercase: true 
  },
  contact: { 
    type: String,
    trim: true 
  },
  address: { 
    type: String,
    trim: true 
  },
  doj: { type: Date },
  status: { 
    type: String,
    trim: true 
  },
  city: { 
    type: String,
    trim: true 
  },
  
  // Base64 photo storage - stores complete data URL
  photo: { 
    type: String, // Will store: "data:image/jpeg;base64,/9j/4AAQ..."
    required: false
  },
  
  // Photo metadata
  // photoInfo: {
  //   originalName: { type: String },
  //   mimeType: { type: String },
  //   size: { type: Number }, // Size in bytes
  //   uploadDate: { type: Date, default: Date.now }
  // },

  // Professional Info
  agency: { 
    type: String,
    trim: true 
  },
  licenseNumber: { 
    type: String,
    trim: true 
  },
  textNumber: { 
    type: String,
    trim: true 
  },
  servicesArea: { 
    type: String,
    trim: true 
  },
  about: { 
    type: String,
    trim: true 
  },

  // Property Stats - These will be AUTO-CALCULATED from Property collection
  totalListing: { 
    type: Number, 
    default: 0,
    comment: 'Auto-calculated: propertyRent + propertySold'
  },
  propertySold: { 
    type: Number, 
    default: 0,
    comment: 'Auto-calculated: Count of properties with status "sale" or "both"'
  },
  propertyRent: { 
    type: Number, 
    default: 0,
    comment: 'Auto-calculated: Count of properties with status "rent" or "both"'
  },
  propertyOwned: { 
    type: Number, 
    default: 0,
    comment: 'Auto-calculated: Total count of all properties owned by this owner'
  },

  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Indexes for better performance
OwnerSchema.index({ ownerId: 1 }, { unique: true });
OwnerSchema.index({ email: 1 });
OwnerSchema.index({ name: 1 });
OwnerSchema.index({ city: 1 });
OwnerSchema.index({ status: 1 });
OwnerSchema.index({ createdAt: -1 });

// Virtual to check if owner has photo
OwnerSchema.virtual('hasPhoto').get(function() {
  return !!(this.photo && this.photo.startsWith('data:'));
});

// Method to get photo size in KB
OwnerSchema.methods.getPhotoSize = function() {
  if (!this.photo) return 0;
  
  // Calculate approximate size in KB
  const base64Length = this.photo.length;
  const padding = (this.photo.match(/=/g) || []).length;
  const sizeInBytes = (base64Length * 3) / 4 - padding;
  
  return Math.round(sizeInBytes / 1024); // Return in KB
};

// Method to get photo format
OwnerSchema.methods.getPhotoFormat = function() {
  if (!this.photo) return null;
  
  const match = this.photo.match(/^data:image\/([^;]+);base64,/);
  return match ? match[1] : null;
};

// Method to manually recalculate property stats (utility method)
OwnerSchema.methods.recalculatePropertyStats = async function() {
  const Property = mongoose.model('Property');
  
  const rentProperties = await Property.countDocuments({ 
    ownerId: parseInt(this.ownerId), 
    status: { $in: ['rent', 'both'] } 
  });
  
  const saleProperties = await Property.countDocuments({ 
    ownerId: parseInt(this.ownerId), 
    status: { $in: ['sale', 'both'] } 
  });

  const totalProperties = await Property.countDocuments({ 
    ownerId: parseInt(this.ownerId) 
  });

  this.propertyRent = rentProperties;
  this.propertySold = saleProperties;
  this.propertyOwned = totalProperties;
  this.totalListing = rentProperties + saleProperties;

  return this.save();
};

// Pre-save middleware to validate and process data
OwnerSchema.pre('save', function(next) {
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
  
  // NOTE: We don't auto-calculate totalListing here anymore
  // It's calculated by the updateOwnerStats function based on actual properties
  
  next();
});

// Transform function to control JSON output
OwnerSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret, options) {
    // Remove MongoDB internal fields
    delete ret.__v;
    
    // Add computed fields
    ret.hasPhoto = !!(ret.photo && ret.photo.startsWith('data:'));
    
    // Optionally exclude photo for list views
    if (options.excludePhoto) {
      delete ret.photo;
      delete ret.photoInfo;
    }
    
    return ret;
  }
});

// Static method to find owners without photos
OwnerSchema.statics.findOwnersWithoutPhotos = function() {
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
OwnerSchema.statics.getPhotoStats = async function() {
  const totalOwners = await this.countDocuments();
  const ownersWithPhotos = await this.countDocuments({
    photo: { $exists: true, $ne: null, $ne: '', $regex: /^data:image\// }
  });
  
  return {
    totalOwners,
    ownersWithPhotos,
    ownersWithoutPhotos: totalOwners - ownersWithPhotos,
    photoPercentage: totalOwners > 0 ? Math.round((ownersWithPhotos / totalOwners) * 100) : 0
  };
};

// Static method to recalculate ALL owner stats (for data migration/cleanup)
OwnerSchema.statics.recalculateAllStats = async function() {
  const owners = await this.find();
  console.log(`🔄 Recalculating stats for ${owners.length} owners...`);
  
  let successCount = 0;
  let errorCount = 0;

  for (const owner of owners) {
    try {
      await owner.recalculatePropertyStats();
      successCount++;
    } catch (error) {
      console.error(`❌ Failed to recalculate stats for owner ${owner.ownerId}:`, error.message);
      errorCount++;
    }
  }

  console.log(`✅ Recalculation complete: ${successCount} success, ${errorCount} errors`);
  return { successCount, errorCount, total: owners.length };
};

module.exports = mongoose.model('Owner', OwnerSchema);