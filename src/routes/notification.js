// server/src/routes/notification.js
const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notificationController");

// ========== ADMIN DASHBOARD ROUTES ==========
// Get admin notifications (existing)
router.get("/", notificationController.getNotifications);

// Get admin unread count (existing)
router.get("/unread-count", notificationController.getUnreadCount);

// Mark notification as read (existing - works for both admin and mobile)
router.put("/:id/read", notificationController.markAsRead);
router.patch("/:id/read", notificationController.markAsRead);

// Clear all notifications (existing)
router.delete("/", notificationController.clearAllNotifications);

// Clear only admin notifications (new)
router.delete("/admin/clear", notificationController.clearAdminNotifications);

// ========== MOBILE APP ROUTES ==========
// Get mobile notifications (new)
router.get("/mobile", notificationController.getMobileNotifications);

// Get mobile unread count (new)
router.get("/mobile/unread-count", notificationController.getMobileUnreadCount);

// Mark multiple notifications as read (new)
router.post("/mobile/mark-read", notificationController.markMultipleAsRead);

// Mark all mobile notifications as read (new)
router.post("/mobile/mark-all-read", notificationController.markAllMobileAsRead);

// Clear only mobile notifications (new)
router.delete("/mobile/clear", notificationController.clearMobileNotifications);

module.exports = router;