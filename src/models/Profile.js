const mongoose = require("mongoose");

const profileSchema = new mongoose.Schema({
  // userId: { 
  //   type: String, 
  //   unique: false
  // },
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
    type: String, // Store as string in YYYY-MM-DD format
    required: false,
    validate: {
      validator: function(v) {
        if (!v) return true; // Allow empty
        // Validate YYYY-MM-DD format
        return /^\d{4}-\d{2}-\d{2}$/.test(v);
      },
      message: "Date of birth must be in YYYY-MM-DD format"
    }
  },
  email: {
    type: String,
    required: [true, "Email is required"],
    unique: true,
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
    enum: ["male", "female", "other", ""],
    lowercase: true
  },
  photo: {
    type: String,
    required: false,
    validate: {
      validator: function(v) {
        if (!v) return true;
        const base64Regex = /^data:image\/(jpeg|jpg|png|gif|webp|bmp|svg\+xml);base64,/i;
        return base64Regex.test(v);
      },
      message: "Photo must be a valid base64 image data URL"
    }
  }
}, {
  timestamps: true
});

// Indexes for better query performance
profileSchema.index({ email: 1 });
profileSchema.index({ userId: 1 });

// Virtual for full name
profileSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Transform output
profileSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model("Profile", profileSchema);