// server/src/routes/notification.js
const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notificationController");

// ========== ADMIN DASHBOARD ROUTES ==========
// IMPORTANT: Specific routes MUST come before generic routes to avoid conflicts

// Get admin unread count (specific route first)
router.get("/unread-count", notificationController.getUnreadCount);

// Clear only admin notifications (specific route)
router.delete("/admin/clear", notificationController.clearAdminNotifications);

// Get admin notifications (less specific)
router.get("/", notificationController.getNotifications);

// ========== MOBILE APP ROUTES ==========
// Get mobile unread count (specific route first)
router.get("/mobile/unread-count", notificationController.getMobileUnreadCount);

// Mark multiple notifications as read (specific route)
router.post("/mobile/mark-read", notificationController.markMultipleAsRead);

// Mark all mobile notifications as read (specific route)
router.post("/mobile/mark-all-read", notificationController.markAllMobileAsRead);

// Clear only mobile notifications (specific route)
router.delete("/mobile/clear", notificationController.clearMobileNotifications);

// Hide notification from mobile (specific with ID parameter)
router.delete("/mobile/:id", notificationController.hideNotificationFromMobile);

// Get mobile notifications (less specific)
router.get("/mobile", notificationController.getMobileNotifications);

// ========== SHARED ROUTES (Admin & Mobile) ==========
// Mark notification as read (supports both PUT and PATCH)
router.put("/:id/read", notificationController.markAsRead);
router.patch("/:id/read", notificationController.markAsRead);

// Delete single notification permanently
router.delete("/:id", notificationController.deleteNotification);

// Clear all notifications (MUST be last - catches DELETE /)
router.delete("/", notificationController.clearAllNotifications);

module.exports = router;