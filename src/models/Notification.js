// server/src/models/Notification.js
const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: false 
  },
  type: { 
    type: String, 
    required: true, 
    // ✅ Combined enum for both admin dashboard AND mobile app
    enum: [
      // Admin dashboard types (existing)
      "login", "signup", "transaction", "propertySale", "system", "review", "property", "owner",
      // Mobile app types (new)
      "Review", "Sold", "House", "Villa", "Rental", "Apartment", "Commercial", "Land"
    ]
  },
  // Admin dashboard message (existing - technical/detailed)
  message: { 
    type: String, 
    required: true 
  },
  // Mobile app fields (new - all optional for backward compatibility)
  title: {
    type: String,
    required: false,
    default: function() {
      // Auto-generate title from type if not provided
      return this.type || "Notification";
    }
  },
  // User-friendly message for mobile app (optional)
  userMessage: {
    type: String,
    required: false,
    default: null
  },
  userName: {
    type: String,
    required: false,
    default: null
  },
  userImage: {
    type: String,
    required: false,
    default: null
  },
  propertyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: false,
    default: null
  },
  propertyName: {
    type: String,
    required: false,
    default: null
  },
  // Admin dashboard field (existing)
  relatedId: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: false 
  },
  time: { 
    type: Date, 
    default: Date.now,
    index: true
  },
  isRead: { 
    type: Boolean, 
    default: false,
    index: true
  },
  // Extra metadata for flexibility
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Indexes for better performance
notificationSchema.index({ time: -1, isRead: 1 });
notificationSchema.index({ type: 1, time: -1 });
notificationSchema.index({ userId: 1, isRead: 1 });

module.exports = mongoose.model("Notification", notificationSchema);