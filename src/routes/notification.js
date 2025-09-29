// server/src/routes/notification.js
const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notificationController");

// ✅ Get all notifications (works for both admin & mobile)
// Admin: GET /api/notifications
// Mobile: GET /api/notifications?type=House
router.get("/", notificationController.getNotifications);

// ✅ Get unread count (NEW - for mobile app badge)
router.get("/unread-count", notificationController.getUnreadCount);

// ✅ Mark a single notification as read
// IMPORTANT: Changed from PATCH to PUT to match mobile app
router.put("/:id/read", notificationController.markAsRead);

// Also keep PATCH for backward compatibility with admin dashboard
router.patch("/:id/read", notificationController.markAsRead);

// ✅ Delete single notification (NEW - for mobile app swipe-to-delete)
// Must be BEFORE the DELETE "/" route to avoid route conflicts
router.delete("/:id", notificationController.deleteNotification);

// ✅ Clear all notifications (existing - for admin dashboard)
router.delete("/", notificationController.clearAllNotifications);

module.exports = router;