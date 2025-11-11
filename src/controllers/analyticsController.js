// src/controllers/analyticsController.js
const Transaction = require("../models/Transaction");

// Get monthly sales/earnings for the current year
const getMonthlySales = async (req, res) => {
  try {
    const year = new Date().getFullYear();
    const salesData = await Transaction.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(`${year}-01-01`),
            $lt: new Date(`${year + 1}-01-01`)
          }
        }
      },
      {
        $group: {
          _id: { $month: "$createdAt" },
          totalEarnings: { $sum: "$amount" }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    // Format response for all 12 months
    const monthlyData = Array.from({ length: 12 }, (_, i) => {
      const monthData = salesData.find((s) => s._id === i + 1);
      return {
        month: new Date(0, i).toLocaleString("en", { month: "short" }),
        earnings: monthData ? monthData.totalEarnings : 0
      };
    });

    res.json(monthlyData);
  } catch (err) {
    console.error("❌ Error fetching sales data:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get weekly sales with offset support
const getWeeklySales = async (req, res) => {
  try {
    const offset = parseInt(req.query.offset) || 0; // 0 = this week, -1 = last week, +1 = next week

    // Start of week (Sunday) with offset
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + offset * 7);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    // If you only want to count 'sale' transactions, add a filter like: { type: "sale" }
    const matchFilter = {
      createdAt: { $gte: startOfWeek, $lt: endOfWeek }
    };

    const sales = await Transaction.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: { $dayOfWeek: "$createdAt" }, // 1 = Sunday, 7 = Saturday
          count: { $sum: 1 } // <-- count documents (properties sold)
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Map $dayOfWeek → labels for chart; result `sales` field is the **count**
    const dayMap = ["S", "M", "T", "W", "T", "F", "S"];
    const result = Array.from({ length: 7 }, (_, i) => {
      const found = sales.find((s) => s._id === i + 1);
      return { day: dayMap[i], sales: found ? found.count : 0 };
    });

    res.json(result);
  } catch (err) {
    console.error("❌ Error fetching weekly sales:", err);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  getMonthlySales,
  getWeeklySales
};
