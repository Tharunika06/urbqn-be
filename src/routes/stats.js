const express = require("express");
const Property = require("../models/Property");
const Owner = require("../models/Owner");
const Transaction = require("../models/Transaction");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    // 1. Count properties
    const propertiesCount = await Property.countDocuments();

    // 2. Count owners
    const ownersCount = await Owner.countDocuments();

    // 3. Count unique customers by phone (since no Customer model yet)
    const customersAgg = await Transaction.distinct("customerPhone");
    const customersCount = customersAgg.length;

    // 4. Calculate total revenue
    const revenueAgg = await Transaction.aggregate([
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const totalRevenue = revenueAgg.length > 0 ? revenueAgg[0].total : 0;

    res.json({
      properties: propertiesCount,
      owners: ownersCount,
      customers: customersCount,
      revenue: totalRevenue
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

module.exports = router;
