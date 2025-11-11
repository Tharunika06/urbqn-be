//  src/routes/sales.js
const express = require("express");
const router = express.Router();
const analyticsController = require("../controllers/analyticsController");

// Get monthly sales/earnings for the current year
router.get("/monthly", analyticsController.getMonthlySales);

// Get weekly sales with offset support
router.get("/weekly", analyticsController.getWeeklySales);

module.exports = router;