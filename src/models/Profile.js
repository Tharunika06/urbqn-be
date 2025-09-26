const mongoose = require("mongoose");

const profileSchema = new mongoose.Schema({
 userId: { type: String, unique:false},
  firstName: {
    type: String,
    required: [true, "First name is required"],
    trim: true,
    maxlength: [50, "First name cannot exceed 50 characters"]
  },
  lastName: {
    type: String,
    required: [true, "Last name is required"],
    trim: true,
    maxlength: [50, "Last name cannot exceed 50 characters"]
  },
  dob: {
    type: Date,
    required: false
  },
  email: {
    type: String,
    required: [true, "Email is required"],
    unique: true, // This ensures each email can only be used once
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, "Please enter a valid email"]
  },
  phone: {
    type: String,
    trim: true,
    match: [/^\+?[\d\s\-\(\)]+$/, "Please enter a valid phone number"]
  },
  gender: {
    type: String,
    enum: ["male", "female", "other"],
    lowercase: true
  },
  photo: {
    type: String, // Store base64 string
    required: false, // Make photo optional
    validate: {
      validator: function(v) {
        // Allow empty/null values
        if (!v) return true;
        
        // More flexible validation for base64 data URLs
        const base64Regex = /^data:image\/(jpeg|jpg|png|gif|webp|bmp|svg\+xml);base64,/i;
        return base64Regex.test(v);
      },
      message: "Photo must be a valid base64 image data URL (supported formats: jpeg, jpg, png, gif, webp, bmp, svg)"
    }
  }
}, {
  timestamps: true // Adds createdAt and updatedAt fields
});

// Add index for better query performance
profileSchema.index({ email: 1 });

// Virtual for full name
profileSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Transform output to include virtuals and clean up
profileSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model("Profile", profileSchema);