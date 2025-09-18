// controllers/notificationController.js
const Notification = require("../models/Notification");

// Save a new notification
exports.createNotification = async (payload) => {
  try {
    const notif = new Notification(payload);
    await notif.save();
    return notif;
  } catch (err) {
    console.error("Error saving notification:", err.message);
  }
};

// Get recent notifications (last 24 hrs)
exports.getNotifications = async (req, res) => {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // last 24 hrs
    const notifs = await Notification.find({ time: { $gte: cutoff } })
      .sort({ time: -1 })
      .limit(20); // show up to 20
    res.json(notifs);
  } catch (err) {
    console.error("Fetch notifications error:", err.message);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
};

// Mark as read
exports.markAsRead = async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
    res.json({ ok: true });
  } catch (err) {
    console.error("Mark as read error:", err.message);
    res.status(500).json({ error: "Failed to mark notification as read" });
  }
};

// ✅ Clear all notifications
exports.clearAllNotifications = async (req, res) => {
  try {
    await Notification.deleteMany({});
    res.json({ success: true, message: "All notifications cleared" });
  } catch (err) {
    console.error("Clear all notifications error:", err.message);
    res.status(500).json({ error: "Failed to clear notifications" });
  }
};
