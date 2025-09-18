// routes/reviews.js
const express = require("express");
const router = express.Router();
const Review = require("../models/Review");
const Transaction = require("../models/Transaction");
const Notification = require("../models/Notification"); // ✅ Import Notification model

// POST: Add review
router.post("/", async (req, res) => {
  try {
    const { propertyId, rating, comment } = req.body;

    if (!propertyId || !rating || !comment) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const transaction = await Transaction.findOne({ property: propertyId })
      .sort({ createdAt: -1 });

    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found for this property" });
    }

    const newReview = new Review({
      propertyId,
      customerName: transaction.customerName,
      rating,
      comment,
    });

    await newReview.save();

    // ✅ Save Notification in DB
    const notification = new Notification({
      userId: null, // or transaction.userId if available
      type: "review",
      message: `New review (${rating}/5) by ${newReview.customerName}`,
      relatedId: newReview._id,
    });
    await notification.save();

    // ✅ Emit Socket.io notification
    const io = req.app.get("io");
    io.emit("new-notification", notification);

    res.status(201).json({ success: true, review: newReview });
  } catch (error) {
    console.error("Error saving review:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// GET: All reviews (Admin)
router.get("/", async (req, res) => {
  try {
    const reviews = await Review.find()
      .populate("propertyId", "name address photo") // bring property details
      .sort({ createdAt: -1 });

    res.json(reviews);
  } catch (error) {
    console.error("Error fetching reviews:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// GET: Reviews by property
router.get("/:propertyId", async (req, res) => {
  try {
    const reviews = await Review.find({ propertyId: req.params.propertyId })
      .populate("propertyId", "name address photo")
      .sort({ createdAt: -1 });

    res.json(reviews);
  } catch (error) {
    console.error("Error fetching reviews:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE: Remove a review
router.delete("/:id", async (req, res) => {
  try {
    await Review.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Review deleted" });
  } catch (error) {
    console.error("Error deleting review:", error);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
