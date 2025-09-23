const Property = require("../models/Property");
const Owner = require("../models/Owner");
const Transaction = require("../models/Transaction");

// Get dashboard statistics
const getDashboardStats = async (req, res) => {
  try {
    // Execute all queries in parallel for better performance
    const [
      propertiesCount,
      ownersCount,
      customersAgg,
      revenueAgg
    ] = await Promise.all([
      // 1. Count properties
      Property.countDocuments(),
      
      // 2. Count owners
      Owner.countDocuments(),
      
      // 3. Count unique customers by phone (since no Customer model yet)
      Transaction.distinct("customerPhone"),
      
      // 4. Calculate total revenue
      Transaction.aggregate([
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ])
    ]);

    const customersCount = customersAgg.length;
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
};

module.exports = {
  getDashboardStats
};