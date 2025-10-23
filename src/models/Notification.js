// models/Notification.js
const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    type: {
      type: String,
      required: true,
      enum: [
        // Admin events
        "login", "signup", "user_deleted", "user_updated", "admin_action",
        "transaction_deletion", "customer_deletion", "property_deleted",
        "transaction", "propertySale", "system", "review", "property",
        "transaction_created", "transaction_updated", "transaction_completed",
        "transaction_failed", "review_added", "review_updated", "review_deleted",
        "Review", "Sold", "property_updated", "property_sold", // ✅ ADDED: property_sold
        // Mobile events
        "owner", "property_created", "House", "Villa", "Rental", 
        "Apartment", "Commercial", "Land",
        // General
        "booking", "payment", "cancellation", "message", "alert",
        "owner_added", "owner_updated", "owner_deleted", "customer"
      ],
    },
    target: {
      type: String,
      required: true,
      enum: ["admin", "mobile", "user", "customer", "vendor", "owner"],
      default: "admin",
    },
    title: {
      type: String,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    // Property-related fields (for mobile)
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      default: null,
    },
    propertyName: {
      type: String,
      trim: true,
    },
    // User-related fields (for mobile)
    userName: {
      type: String,
      trim: true,
    },
    userImage: {
      type: String,
    },
    relatedId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    
    // ========== NEW: Multi-user read tracking ==========
    // For admin notifications (backward compatible)
    isRead: {
      type: Boolean,
      default: false,
    },
    
    // For mobile notifications (user-specific read tracking)
    readBy: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: [],
      index: true, // ← Important for query performance
    },
    
    // Optional: Track total reads for analytics
    totalReads: {
      type: Number,
      default: 0,
    },
    // ===================================================
    
    priority: {
      type: String,
      enum: ["low", "normal", "high", "urgent"],
      default: "normal",
    },
    metadata: {
      type: Object,
      default: {},
    },
    time: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ target: 1, isRead: 1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ time: -1 });
notificationSchema.index({ propertyId: 1 });
notificationSchema.index({ readBy: 1 }); // ← NEW: Index for readBy queries

// Virtual for time ago
notificationSchema.virtual("timeAgo").get(function () {
  const now = new Date();
  const diff = now - (this.time || this.createdAt);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
});

// ========== NEW: Instance Methods ==========
notificationSchema.methods.markAsRead = async function () {
  this.isRead = true;
  return await this.save();
};

// NEW: Mark as read for specific user
notificationSchema.methods.markAsReadByUser = async function (userId) {
  if (!this.readBy.includes(userId)) {
    this.readBy.push(userId);
    this.totalReads = (this.totalReads || 0) + 1;
    return await this.save();
  }
  return this;
};

// NEW: Check if user has read this notification
notificationSchema.methods.isReadByUser = function (userId) {
  return this.readBy.some(id => id.toString() === userId.toString());
};

// ========== NEW: Static Methods ==========
notificationSchema.statics.getUnreadCount = async function (userId) {
  return await this.countDocuments({ userId, isRead: false });
};

// NEW: Get unread count for mobile user
notificationSchema.statics.getUnreadCountForUser = async function (userId) {
  return await this.countDocuments({
    target: 'mobile',
    readBy: { $nin: [userId] }, // Not in readBy array
    'metadata.hiddenFromMobile': { $ne: true }
  });
};

notificationSchema.statics.getAdminNotifications = async function (limit = 50) {
  return await this.find({ target: "admin" })
    .sort({ time: -1, createdAt: -1 })
    .limit(limit);
};

// NEW: Get mobile notifications for specific user
notificationSchema.statics.getMobileNotificationsForUser = async function (userId, limit = 100) {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days
  
  return await this.find({
    target: 'mobile',
    time: { $gte: cutoff },
    readBy: { $nin: [userId] }, // Not read by this user
    'metadata.hiddenFromMobile': { $ne: true }
  })
    .sort({ time: -1 })
    .limit(limit)
    .populate('propertyId', 'name images location')
    .populate('userId', 'name profileImage')
    .lean();
};

notificationSchema.statics.markAllAsRead = async function (userId) {
  return await this.updateMany(
    { userId, isRead: false },
    { $set: { isRead: true } }
  );
};

// NEW: Mark all mobile notifications as read for specific user
notificationSchema.statics.markAllAsReadForUser = async function (userId) {
  return await this.updateMany(
    { 
      target: 'mobile',
      readBy: { $nin: [userId] }
    },
    { 
      $addToSet: { readBy: userId },
      $inc: { totalReads: 1 }
    }
  );
};

module.exports = mongoose.model("Notification", notificationSchema);