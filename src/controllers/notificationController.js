// server/src/controllers/notificationController.js
const Notification = require("../models/Notification");

// Notification types configuration
const NOTIFICATION_TARGETS = {
  ADMIN_ONLY: [
    'login', 'signup', 'user_deleted', 'user_updated', 'admin_action',
    'transaction_deletion', 'customer_deletion', 'property_deleted',
    'transaction', 'propertySale', 'system', 'review', 'property',
    'transaction_created', 'transaction_updated', 'transaction_completed',
    'transaction_failed', 'review_added', 'review_updated', 'review_deleted',
    'Review', 'Sold', 'property_updated'
  ],
  MOBILE_ONLY: [
    'owner', 'property_created', 'House', 'Villa', 'Rental', 
    'Apartment', 'Commercial', 'Land'
  ]
};

// Helper function to determine target based on notification type
const determineTarget = (type) => {
  if (NOTIFICATION_TARGETS.ADMIN_ONLY.includes(type)) return 'admin';
  if (NOTIFICATION_TARGETS.MOBILE_ONLY.includes(type)) return 'mobile';
  return 'admin'; // Default to admin for unknown types
};

// Helper function to generate mobile-friendly messages
const generateMobileMessage = (payload) => {
  const { type, propertyName, userName } = payload;
  
  const messages = {
    // Property notifications
    'property_created': `New Property Added! ${propertyName || 'A new property'} is now available. Check it out! 🏠`,
    'House': `New House Listed! ${propertyName || 'A beautiful house'} has been added. Take a look! 🏡`,
    'Villa': `New Villa Added! ${propertyName || 'A luxury villa'} is now available for viewing. ✨`,
    'Rental': `New Rental Property! ${propertyName || 'A rental property'} has been listed. Check the details! 🔑`,
    'Apartment': `New Apartment Available! ${propertyName || 'An apartment'} has been added to listings. 🏢`,
    'Commercial': `New Commercial Property! ${propertyName || 'A commercial space'} is now listed. 🏪`,
    'Land': `New Land Listing! ${propertyName || 'A plot of land'} has been added. Explore now! 🌳`,
    // Owner notifications
    'owner': `New Property Owner! ${userName || 'A new owner'} has joined. Welcome to the community! 🎉`
  };
  
  return messages[type] || payload.message || 'You have a new notification.';
};

// Helper function to generate notification title
const generateTitle = (type) => {
  const titles = {
    'property_created': 'New Property',
    'House': 'New House',
    'Villa': 'New Villa',
    'Rental': 'New Rental',
    'Apartment': 'New Apartment',
    'Commercial': 'New Commercial',
    'Land': 'New Land',
    'owner': 'New Owner'
  };
  
  return titles[type] || 'Notification';
};

// ========== CORE NOTIFICATION CREATION FUNCTIONS ==========

// Create single notification
exports.createNotification = async (payload) => {
  try {
    console.log('📢 Creating notification:', payload.type, 'for target:', payload.target);
    
    // Determine target if not provided
    if (!payload.target && payload.type) {
      payload.target = determineTarget(payload.type);
    }
    
    // Generate mobile-friendly content for mobile notifications
    if (payload.target === 'mobile') {
      if (!payload.message) {
        payload.message = generateMobileMessage(payload);
      }
      
      // Set title if not provided
      if (!payload.title) {
        payload.title = generateTitle(payload.type);
      }
    }
    
    // Set time if not provided
    if (!payload.time) {
      payload.time = new Date();
    }
    
    const notif = new Notification(payload);
    await notif.save();
    
    console.log('✅ Notification created successfully:', notif._id);
    return notif;
  } catch (err) {
    console.error("❌ Error saving notification:", err.message);
    return null;
  }
};

// Broadcast notification to all mobile users
exports.broadcastNotification = async (payload) => {
  try {
    console.log('📱 Broadcasting notification to mobile users:', payload.type);
    
    // Force target to mobile
    payload.target = 'mobile';
    
    // Generate mobile-friendly message
    if (!payload.message) {
      payload.message = generateMobileMessage(payload);
    }
    
    // Set title if not provided
    if (!payload.title) {
      payload.title = generateTitle(payload.type);
    }
    
    // Set time if not provided
    if (!payload.time) {
      payload.time = new Date();
    }

    // Initialize readBy as empty array (no one has read it yet)
    payload.readBy = [];
    payload.totalReads = 0;

    const notif = new Notification(payload);
    await notif.save();

    console.log('✅ Broadcast notification created:', notif._id, '-', payload.title);
    return notif;
  } catch (err) {
    console.error('❌ Error broadcasting notification:', err.message);
    return null;
  }
};

// ========== ADMIN DASHBOARD ENDPOINTS ==========

// Get notifications for ADMIN dashboard
exports.getNotifications = async (req, res) => {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const notifs = await Notification.find({ 
      time: { $gte: cutoff },
      target: 'admin'
    })
      .sort({ time: -1 })
      .limit(100)
      .lean();
    
    console.log(`📋 Fetched ${notifs.length} admin notifications`);
    res.json(notifs);
  } catch (err) {
    console.error("Fetch notifications error:", err.message);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
};

// Get unread count for ADMIN
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({ 
      isRead: false,
      target: 'admin'
    });
    
    console.log(`📊 Admin unread count: ${count}`);
    res.json({ count });
  } catch (err) {
    console.error("Get unread count error:", err.message);
    res.status(500).json({ error: "Failed to get unread count" });
  }
};

// Clear admin notifications only
exports.clearAdminNotifications = async (req, res) => {
  try {
    const result = await Notification.deleteMany({
      target: 'admin'
    });
    
    console.log(`🗑️ Cleared ${result.deletedCount} admin notifications`);
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

// ========== MOBILE APP ENDPOINTS (UPDATED FOR USER-SPECIFIC READS) ==========

// Get notifications for MOBILE app (USER-SPECIFIC)
exports.getMobileNotifications = async (req, res) => {
  try {
    // Get userId from query params or auth middleware
    const userId = req.query.userId || req.user?._id;
    
    if (!userId) {
      return res.status(400).json({ 
        error: "User ID is required",
        message: "Please provide userId in query params or authenticate"
      });
    }

    console.log(`📱 Fetching mobile notifications for user: ${userId}`);
    
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days
    
    const notifs = await Notification.find({ 
      time: { $gte: cutoff },
      target: 'mobile',
      'metadata.hiddenFromMobile': { $ne: true }
    })
      .sort({ time: -1 })
      .limit(100)
      .populate('propertyId', 'name images location')
      .populate('userId', 'name profileImage')
      .lean();
    
    // Format notifications and add isReadByUser flag
    const formattedNotifs = notifs.map(notif => ({
      _id: notif._id,
      type: notif.type,
      title: notif.title,
      message: notif.message,
      userName: notif.userName,
      userImage: notif.userImage,
      propertyId: notif.propertyId?._id,
      propertyName: notif.propertyName || notif.propertyId?.name,
      propertyImage: notif.propertyId?.images?.[0],
      time: notif.time,
      isRead: notif.readBy?.some(id => id.toString() === userId.toString()) || false, // ← USER-SPECIFIC
      totalReads: notif.totalReads || 0,
      metadata: notif.metadata
    }));
    
    console.log(`📱 Fetched ${formattedNotifs.length} mobile notifications for user ${userId}`);
    res.json(formattedNotifs);
  } catch (err) {
    console.error("Fetch mobile notifications error:", err.message);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
};

// Get unread count for MOBILE (USER-SPECIFIC)
exports.getMobileUnreadCount = async (req, res) => {
  try {
    // Get userId from query params or auth middleware
    const userId = req.query.userId || req.user?._id;
    
    if (!userId) {
      return res.status(400).json({ 
        error: "User ID is required",
        message: "Please provide userId in query params or authenticate"
      });
    }

    const count = await Notification.countDocuments({ 
      target: 'mobile',
      readBy: { $nin: [userId] }, // ← Not in readBy array
      'metadata.hiddenFromMobile': { $ne: true }
    });
    
    console.log(`📱 Mobile unread count for user ${userId}: ${count}`);
    res.json({ count });
  } catch (err) {
    console.error("Get mobile unread count error:", err.message);
    res.status(500).json({ error: "Failed to get unread count" });
  }
};

// Mark single notification as read (USER-SPECIFIC)
exports.markAsRead = async (req, res) => {
  try {
    const { userId } = req.body; // Get userId from request body
    const notificationId = req.params.id;

    if (!userId) {
      return res.status(400).json({ 
        error: "User ID is required",
        message: "Please provide userId in request body"
      });
    }

    const notification = await Notification.findById(notificationId);
    
    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    // If it's a mobile notification, use user-specific read tracking
    if (notification.target === 'mobile') {
      // Add user to readBy array if not already there
      if (!notification.readBy.includes(userId)) {
        notification.readBy.push(userId);
        notification.totalReads = (notification.totalReads || 0) + 1;
        await notification.save();
        console.log(`✅ User ${userId} marked notification ${notificationId} as read`);
      } else {
        console.log(`ℹ️ User ${userId} already read notification ${notificationId}`);
      }
    } else {
      // For admin notifications, use the old isRead flag
      notification.isRead = true;
      await notification.save();
      console.log(`✅ Marked admin notification ${notificationId} as read`);
    }
    
    res.json({ 
      ok: true, 
      notification,
      message: "Notification marked as read"
    });
  } catch (err) {
    console.error("Mark as read error:", err.message);
    res.status(500).json({ error: "Failed to mark notification as read" });
  }
};

// Mark multiple notifications as read (USER-SPECIFIC)
exports.markMultipleAsRead = async (req, res) => {
  try {
    const { notificationIds, userId } = req.body;
    
    if (!notificationIds || !Array.isArray(notificationIds)) {
      return res.status(400).json({ error: "Invalid notification IDs" });
    }

    if (!userId) {
      return res.status(400).json({ 
        error: "User ID is required",
        message: "Please provide userId in request body"
      });
    }
    
    // Update multiple notifications - add user to readBy array
    await Notification.updateMany(
      { 
        _id: { $in: notificationIds },
        target: 'mobile',
        readBy: { $nin: [userId] } // Only update if user hasn't read yet
      },
      { 
        $addToSet: { readBy: userId }, // Add to array (no duplicates)
        $inc: { totalReads: 1 }
      }
    );
    
    console.log(`✅ User ${userId} marked ${notificationIds.length} notifications as read`);
    res.json({ ok: true, message: "Notifications marked as read" });
  } catch (err) {
    console.error("Mark multiple as read error:", err.message);
    res.status(500).json({ error: "Failed to mark notifications as read" });
  }
};

// Mark all mobile notifications as read (USER-SPECIFIC)
exports.markAllMobileAsRead = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ 
        error: "User ID is required",
        message: "Please provide userId in request body"
      });
    }

    const result = await Notification.updateMany(
      { 
        target: 'mobile',
        readBy: { $nin: [userId] } // Only unread notifications
      },
      { 
        $addToSet: { readBy: userId },
        $inc: { totalReads: 1 }
      }
    );
    
    console.log(`✅ User ${userId} marked ${result.modifiedCount} mobile notifications as read`);
    res.json({ 
      ok: true, 
      message: "All mobile notifications marked as read",
      modifiedCount: result.modifiedCount
    });
  } catch (err) {
    console.error("Mark all mobile as read error:", err.message);
    res.status(500).json({ error: "Failed to mark notifications as read" });
  }
};

// Clear mobile notifications only
exports.clearMobileNotifications = async (req, res) => {
  try {
    const result = await Notification.deleteMany({
      target: 'mobile'
    });
    
    console.log(`🗑️ Cleared ${result.deletedCount} mobile notifications`);
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

// Hide notification from mobile (soft delete - USER-SPECIFIC)
exports.hideNotificationFromMobile = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ 
        error: "User ID is required",
        message: "Please provide userId in request body"
      });
    }

    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { 
        $set: { 
          [`metadata.hiddenBy.${userId}`]: true 
        }
      },
      { new: true }
    );
    
    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }
    
    console.log(`👁️ User ${userId} hidden notification ${req.params.id} from mobile`);
    res.json({ 
      success: true, 
      message: "Notification hidden from mobile",
      notification
    });
  } catch (err) {
    console.error("Hide notification from mobile error:", err.message);
    res.status(500).json({ error: "Failed to hide notification" });
  }
};

// ========== SHARED ENDPOINTS ==========

// Delete notification permanently
exports.deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findByIdAndDelete(req.params.id);
    
    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }
    
    console.log(`🗑️ Deleted notification ${req.params.id} permanently`);
    res.json({ 
      success: true, 
      message: "Notification deleted permanently",
      deletedNotification: notification
    });
  } catch (err) {
    console.error("Delete notification error:", err.message);
    res.status(500).json({ error: "Failed to delete notification" });
  }
};

// Clear all notifications (both admin and mobile)
exports.clearAllNotifications = async (req, res) => {
  try {
    const result = await Notification.deleteMany({});
    
    console.log(`🗑️ Cleared ALL ${result.deletedCount} notifications`);
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