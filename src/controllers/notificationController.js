// server/src/controllers/notificationController.js
const Notification = require("../models/Notification");

// Notification types configuration
const NOTIFICATION_TARGETS = {
  ADMIN_ONLY: [
    'login', 'signup', 'user_deleted', 'user_updated', 'admin_action', 'owner'
  ],
  MOBILE_ONLY: [
    'Review', 'Sold', 'House', 'Villa', 'Rental', 'Apartment', 'Commercial', 'Land',
    'property_created', 'property_updated', 'property_deleted',
    'review_added', 'review_updated', 'review_deleted'
  ],
  BOTH: [
    'transaction', 'propertySale', 'system', 'review', 'property',
    'transaction_created', 'transaction_updated', 'transaction_completed', 'transaction_failed'
  ]
};

// Helper function to determine target based on notification type
const determineTarget = (type) => {
  if (NOTIFICATION_TARGETS.ADMIN_ONLY.includes(type)) return 'admin';
  if (NOTIFICATION_TARGETS.MOBILE_ONLY.includes(type)) return 'mobile';
  if (NOTIFICATION_TARGETS.BOTH.includes(type)) return 'both';
  return 'admin'; // Default to admin for unknown types
};

// Helper function to generate mobile-friendly messages
const generateMobileMessage = (payload) => {
  const { type, propertyName, userName, metadata = {} } = payload;
  
  switch (type) {
    // Property notifications
    case 'property_created':
    case 'House':
    case 'Villa':
    case 'Rental':
    case 'Apartment':
    case 'Commercial':
    case 'Land':
      return `New ${type === 'property_created' ? 'Property' : type} - A new ${propertyName || 'property'} has been added. Check out the latest listing!`;
    
    case 'property_updated':
      return `Property Updated - ${propertyName || 'A property'} details have been updated. Take a look at the changes!`;
    
    case 'property_deleted':
      return `Property Removed - ${propertyName || 'A property'} is no longer available.`;
    
    case 'Sold':
    case 'propertySale':
      return `Property Sold - ${propertyName || 'A property'} has been successfully sold!`;
    
    // Review notifications
    case 'review_added':
    case 'Review':
      return `Review Submitted - Your review for ${propertyName || 'the property'} has been successfully submitted. Thank you for your feedback!`;
    
    case 'review_updated':
      return `Review Updated - Your review for ${propertyName || 'the property'} has been updated successfully.`;
    
    case 'review_deleted':
      return `Review Removed - Your review for ${propertyName || 'the property'} has been removed.`;
    
    case 'review':
      if (metadata.action === 'received') {
        return `New Review - ${userName || 'Someone'} left a review on ${propertyName || 'your property'}.`;
      }
      return `Review Notification - Activity on ${propertyName || 'a property'} review.`;
    
    // Transaction notifications
    case 'transaction_completed':
    case 'transaction':
      return `Transaction Successful - Your transaction for ${propertyName || 'the property'} was completed successfully! 🎉`;
    
    case 'transaction_failed':
      return `Transaction Failed - Your transaction for ${propertyName || 'the property'} could not be completed. Please try again or contact support.`;
    
    case 'transaction_created':
      return `Transaction Initiated - Your transaction for ${propertyName || 'the property'} has been started. Please complete the payment.`;
    
    case 'transaction_updated':
      return `Transaction Update - Your transaction for ${propertyName || 'the property'} status has been updated.`;
    
    // System notifications
    case 'system':
      return metadata.message || 'System notification - Please check the app for updates.';
    
    default:
      return payload.message || 'You have a new notification.';
  }
};

exports.createNotification = async (payload) => {
  try {
    // Automatically set target based on type if not provided
    if (!payload.target && payload.type) {
      payload.target = determineTarget(payload.type);
    }
    
    // Generate mobile-friendly message if target is mobile or both
    if (payload.target === 'mobile' || payload.target === 'both') {
      // Store original admin message if provided
      const originalMessage = payload.message;
      
      // Generate mobile message
      payload.message = generateMobileMessage(payload);
      
      // Store admin message in metadata for reference
      if (originalMessage && payload.target === 'both') {
        payload.metadata = {
          ...payload.metadata,
          adminMessage: originalMessage
        };
      }
    }
    
    const notif = new Notification(payload);
    await notif.save();
    return notif;
  } catch (err) {
    console.error("Error saving notification:", err.message);
    return null;
  }
};

// Get notifications for ADMIN dashboard (existing endpoint)
exports.getNotifications = async (req, res) => {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const notifs = await Notification.find({ 
      time: { $gte: cutoff },
      target: { $in: ['admin', 'both'] }
    })
      .sort({ time: -1 })
      .limit(100)
      .lean();
    
    // For 'both' type notifications, use adminMessage if available
    const processedNotifs = notifs.map(notif => {
      if (notif.target === 'both' && notif.metadata?.adminMessage) {
        return {
          ...notif,
          message: notif.metadata.adminMessage
        };
      }
      return notif;
    });
    
    res.json(processedNotifs);
  } catch (err) {
    console.error("Fetch notifications error:", err.message);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
};

// Get notifications for MOBILE app (new endpoint)
exports.getMobileNotifications = async (req, res) => {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const notifs = await Notification.find({ 
      time: { $gte: cutoff },
      target: { $in: ['mobile', 'both'] }
    })
      .sort({ time: -1 })
      .limit(100)
      .populate('propertyId', 'name images location')
      .populate('userId', 'name profileImage')
      .lean();
    
    // Format notifications for mobile display
    const formattedNotifs = notifs.map(notif => ({
      _id: notif._id,
      type: notif.type,
      title: notif.title,
      message: notif.message, // Already mobile-friendly from generateMobileMessage
      userName: notif.userName,
      userImage: notif.userImage,
      propertyId: notif.propertyId?._id,
      propertyName: notif.propertyName || notif.propertyId?.name,
      propertyImage: notif.propertyId?.images?.[0],
      time: notif.time,
      isRead: notif.isRead,
      metadata: notif.metadata
    }));
    
    res.json(formattedNotifs);
  } catch (err) {
    console.error("Fetch mobile notifications error:", err.message);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id, 
      { isRead: true },
      { new: true }
    );
    
    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }
    
    res.json({ ok: true, notification });
  } catch (err) {
    console.error("Mark as read error:", err.message);
    res.status(500).json({ error: "Failed to mark notification as read" });
  }
};

// Mark multiple notifications as read (new - useful for mobile)
exports.markMultipleAsRead = async (req, res) => {
  try {
    const { notificationIds } = req.body;
    
    if (!notificationIds || !Array.isArray(notificationIds)) {
      return res.status(400).json({ error: "Invalid notification IDs" });
    }
    
    await Notification.updateMany(
      { _id: { $in: notificationIds } },
      { isRead: true }
    );
    
    res.json({ ok: true, message: "Notifications marked as read" });
  } catch (err) {
    console.error("Mark multiple as read error:", err.message);
    res.status(500).json({ error: "Failed to mark notifications as read" });
  }
};

// Mark all notifications as read for mobile
exports.markAllMobileAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { 
        target: { $in: ['mobile', 'both'] },
        isRead: false
      },
      { isRead: true }
    );
    
    res.json({ ok: true, message: "All mobile notifications marked as read" });
  } catch (err) {
    console.error("Mark all mobile as read error:", err.message);
    res.status(500).json({ error: "Failed to mark notifications as read" });
  }
};

exports.clearAllNotifications = async (req, res) => {
  try {
    const result = await Notification.deleteMany({});
    res.json({ 
      success: true, 
      message: "All notifications cleared",
      deletedCount: result.deletedCount
    });
  } catch (err) {
    console.error("Clear all notifications error:", err.message);
    res.status(500).json({ error: "Failed to clear notifications" });
  }
};

// Get unread count for ADMIN (existing endpoint)
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({ 
      isRead: false,
      target: { $in: ['admin', 'both'] }
    });
    res.json({ count });
  } catch (err) {
    console.error("Get unread count error:", err.message);
    res.status(500).json({ error: "Failed to get unread count" });
  }
};

// Get unread count for MOBILE (new endpoint)
exports.getMobileUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({ 
      isRead: false,
      target: { $in: ['mobile', 'both'] }
    });
    res.json({ count });
  } catch (err) {
    console.error("Get mobile unread count error:", err.message);
    res.status(500).json({ error: "Failed to get unread count" });
  }
};

// Clear admin notifications only (new endpoint)
exports.clearAdminNotifications = async (req, res) => {
  try {
    const result = await Notification.deleteMany({
      target: { $in: ['admin', 'both'] }
    });
    res.json({ 
      success: true, 
      message: "Admin notifications cleared",
      deletedCount: result.deletedCount
    });
  } catch (err) {
    console.error("Clear admin notifications error:", err.message);
    res.status(500).json({ error: "Failed to clear notifications" });
  }
};

// Clear mobile notifications only (new endpoint)
exports.clearMobileNotifications = async (req, res) => {
  try {
    const result = await Notification.deleteMany({
      target: { $in: ['mobile', 'both'] }
    });
    res.json({ 
      success: true, 
      message: "Mobile notifications cleared",
      deletedCount: result.deletedCount
    });
  } catch (err) {
    console.error("Clear mobile notifications error:", err.message);
    res.status(500).json({ error: "Failed to clear notifications" });
  }
};