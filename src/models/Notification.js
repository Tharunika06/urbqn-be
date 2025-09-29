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
    enum: [
      // Admin dashboard types
      "login", "signup", "transaction", "propertySale", "system", "review", 
      "property", "owner", "user_deleted", "user_updated", "admin_action",
      // Mobile app types
      "Review", "Sold", "House", "Villa", "Rental", "Apartment", "Commercial", 
      "Land", "property_created", "property_updated", "property_deleted",
      "review_added", "review_updated", "review_deleted", "transaction_created",
      "transaction_updated", "transaction_completed", "transaction_failed"
    ]
  },
  // Target platform: 'admin', 'mobile', or 'both'
  target: {
    type: String,
    enum: ['admin', 'mobile', 'both'],
    required: true,
    default: function() {
      // Auto-determine target based on type
      const adminTypes = ['login', 'signup', 'user_deleted', 'user_updated', 'admin_action', 'owner'];
      const mobileTypes = ['Review', 'Sold', 'House', 'Villa', 'Rental', 'Apartment', 
                          'Commercial', 'Land', 'property_created', 'property_updated', 
                          'property_deleted', 'review_added', 'review_updated', 'review_deleted'];
      const bothTypes = ['transaction', 'propertySale', 'system', 'review', 'property',
                        'transaction_created', 'transaction_updated', 'transaction_completed', 
                        'transaction_failed'];
      
      if (adminTypes.includes(this.type)) return 'admin';
      if (mobileTypes.includes(this.type)) return 'mobile';
      if (bothTypes.includes(this.type)) return 'both';
      return 'admin'; // Default fallback
    },
    index: true
  },
  // Admin dashboard field
  message: {
    type: String,
    required: true
  },
  // Mobile app fields
  title: {
    type: String,
    required: false,
    default: function() {
      return this.type || "Notification";
    }
  },
  // userName: {
  //   type: String,
  //   required: false,
  //   default: null
  // },
  // userImage: {
  //   type: String,
  //   required: false,
  //   default: null
  // },
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
  // Admin dashboard field
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
notificationSchema.index({ target: 1, time: -1 });
notificationSchema.index({ target: 1, isRead: 1 });

module.exports = mongoose.model("Notification", notificationSchema);