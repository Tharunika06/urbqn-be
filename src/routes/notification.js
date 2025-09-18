// server/src/routes/notification.js
const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notificationController");

// Get all notifications for the logged-in user
router.get("/", notificationController.getNotifications);

// Mark a single notification as read
router.patch("/:id/read", notificationController.markAsRead);

// ✅ Clear all notifications for the logged-in user
router.delete("/", notificationController.clearAllNotifications);

module.exports = router;
