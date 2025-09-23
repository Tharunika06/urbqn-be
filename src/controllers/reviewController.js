const Review = require("../models/Review");
const Transaction = require("../models/Transaction");
const Notification = require("../models/Notification");
const { emitNotification } = require("../utils/socketUtils");

// Add new review
const addReview = async (req, res) => {
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

    // Save Notification in DB
    const notification = new Notification({
      userId: null, // or transaction.userId if available
      type: "review",
      message: `New review (${rating}/5) by ${newReview.customerName}`,
      relatedId: newReview._id,
    });
    await notification.save();

    // Emit Socket.io notification
    emitNotification(req, notification);

    res.status(201).json({ success: true, review: newReview });
  } catch (error) {
    console.error("Error saving review:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// Get all reviews (Admin)
const getAllReviews = async (req, res) => {
  try {
    const reviews = await Review.find()
      .populate("propertyId", "name address photo") // bring property details
      .sort({ createdAt: -1 });

    res.json(reviews);
  } catch (error) {
    console.error("Error fetching reviews:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// Get reviews by property
const getReviewsByProperty = async (req, res) => {
  try {
    const reviews = await Review.find({ propertyId: req.params.propertyId })
      .populate("propertyId", "name address photo")
      .sort({ createdAt: -1 });

    res.json(reviews);
  } catch (error) {
    console.error("Error fetching reviews:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// Delete review
const deleteReview = async (req, res) => {
  try {
    await Review.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Review deleted" });
  } catch (error) {
    console.error("Error deleting review:", error);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  addReview,
  getAllReviews,
  getReviewsByProperty,
  deleteReview
};