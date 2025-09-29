// server/src/controllers/notificationController.js
const Notification = require("../models/Notification");

// Save a new notification (used by both admin and mobile app)
exports.createNotification = async (payload) => {
  try {
    const notif = new Notification(payload);
    await notif.save();
    return notif;
  } catch (err) {
    console.error("Error saving notification:", err.message);
    return null;
  }
};

// Get notifications with optional type filter
// ✅ Works for BOTH admin dashboard (no filter) AND mobile app (with filter)
exports.getNotifications = async (req, res) => {
  try {
    const { type } = req.query;
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // last 24 hrs
    
    // Build query
    const query = { time: { $gte: cutoff } };
    
    // ✅ Add type filter ONLY if provided (mobile app feature)
    // Admin dashboard won't send 'type', so it gets all notifications
    if (type && type !== 'All') {
      query.type = type;
    }
    
    // ✅ Increased limit to 50 for mobile app, doesn't affect admin dashboard
    const notifs = await Notification.find(query)
      .sort({ time: -1 })
      .limit(50);
    
    res.json(notifs);
  } catch (err) {
    console.error("Fetch notifications error:", err.message);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
};

// Mark as read (works for both)
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
    
    // ✅ Returns both formats for compatibility
    res.json({ 
      ok: true, // Admin dashboard expects this
      notification // Mobile app can use this
    });
  } catch (err) {
    console.error("Mark as read error:", err.message);
    res.status(500).json({ error: "Failed to mark notification as read" });
  }
};

// ✅ Delete single notification (NEW - for mobile app only)
exports.deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findByIdAndDelete(req.params.id);
    
    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }
    
    res.json({ success: true, message: "Notification deleted" });
  } catch (err) {
    console.error("Delete notification error:", err.message);
    res.status(500).json({ error: "Failed to delete notification" });
  }
};

// ✅ Clear all notifications (existing - for admin dashboard)
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

// ✅ Get unread count (NEW - useful for mobile app badge)
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({ isRead: false });
    res.json({ count });
  } catch (err) {
    console.error("Get unread count error:", err.message);
    res.status(500).json({ error: "Failed to get unread count" });
  }
};