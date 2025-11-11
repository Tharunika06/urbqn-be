// User.js
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true,
    trim: true
  },
  password: { 
    type: String, 
    required: true 
  },
  firstName: { 
    type: String,
    trim: true
  },
  lastName: { 
    type: String,
    trim: true
  },
  otp: { 
    type: String 
  },
  otpExpires: { 
    type: Date 
  },
  role: { 
    type: String, 
    enum: ['user', 'admin'], 
    default: 'user'
  },
  isVerified: {
    type: Boolean,
    default: false
  }
}, { 
  timestamps: true 
});

// Index for faster queries
UserSchema.index({ email: 1 });

module.exports = mongoose.model('User', UserSchema);