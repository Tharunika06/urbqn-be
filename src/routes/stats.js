// src/routes/stats.js
const express = require("express");
const router = express.Router();
const statsController = require("../controllers/statsController");

// Get dashboard statistics
router.get("/", statsController.getDashboardStats);

module.exports = router;