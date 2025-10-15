const Review = require("../models/Review");
const Transaction = require("../models/Transaction");
const Notification = require("../models/Notification");
const { emitNotification } = require("../utils/socketUtils");

// Add new review
const addReview = async (req, res) => {
  try {
    const { propertyId, rating, comment } = req.body;
    
    // Validate required fields
    if (!propertyId || !rating || !comment) {
      return res.status(400).json({ error: "Missing required fields: propertyId, rating, and comment are required" });
    }

    // Validate rating range
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    // Find the most recent transaction for this property
    const transaction = await Transaction.findOne({ property: propertyId })
      .sort({ createdAt: -1 });
    
    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found for this property" });
    }

    // Create new review
    const newReview = new Review({
      propertyId,
      customerName: transaction.customerName,
      rating,
      comment,
    });
    await newReview.save();
    console.log('✅ Review saved successfully:', newReview._id);

    // Create notification - FIXED with proper validation
    try {
      const notificationData = {
        userId: null,
        type: "review",
        target: "admin", // String target for admin notifications
        message: `New review (${rating}/5) by ${transaction.customerName}`,
        relatedId: newReview._id,
      };

      console.log('🔍 Creating notification with data:', notificationData);
      
      const notification = new Notification(notificationData);
      await notification.save();
      console.log('✅ Review notification created:', notification._id);

      // Emit Socket.io notification
      if (req.app && req.app.get('io')) {
        emitNotification(req, notification);
        console.log('✅ Socket notification emitted');
      } else {
        console.warn('⚠️ Socket.io instance not found on app');
      }
    } catch (notifError) {
      console.error('⚠️ Notification creation failed (non-critical):', notifError.message);
      console.error('Full notification error:', notifError);
      // Don't fail the review creation if notification fails
    }

    res.status(201).json({ 
      success: true, 
      review: newReview,
      message: "Review added successfully"
    });
  } catch (error) {
    console.error("❌ Error saving review:", error);
    res.status(500).json({ 
      error: "Server error", 
      message: error.message 
    });
  }
};

// Get all reviews (Admin)
const getAllReviews = async (req, res) => {
  try {
    const reviews = await Review.find()
      .populate("propertyId", "name address photo")
      .sort({ createdAt: -1 });
    
    console.log(`✅ Fetched ${reviews.length} reviews`);
    res.json(reviews);
  } catch (error) {
    console.error("❌ Error fetching reviews:", error);
    res.status(500).json({ error: "Server error", message: error.message });
  }
};

// Get reviews by property
const getReviewsByProperty = async (req, res) => {
  try {
    const { propertyId } = req.params;

    if (!propertyId) {
      return res.status(400).json({ error: "Property ID is required" });
    }

    const reviews = await Review.find({ propertyId })
      .populate("propertyId", "name address photo")
      .sort({ createdAt: -1 });
    
    console.log(`✅ Fetched ${reviews.length} reviews for property ${propertyId}`);
    res.json(reviews);
  } catch (error) {
    console.error("❌ Error fetching reviews:", error);
    res.status(500).json({ error: "Server error", message: error.message });
  }
};

// Delete review
const deleteReview = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "Review ID is required" });
    }

    const review = await Review.findById(id);
    
    if (!review) {
      return res.status(404).json({ error: "Review not found" });
    }

    // Store review data before deletion
    const deletedReviewData = {
      customerName: review.customerName,
      rating: review.rating,
      id: review._id
    };

    await Review.findByIdAndDelete(id);
    console.log('✅ Review deleted:', id);

    // Create deletion notification - FIXED with proper validation
    try {
      const notificationData = {
        userId: null,
        type: "review_deleted",
        target: "admin", // String target for admin notifications
        message: `Review by ${deletedReviewData.customerName} (${deletedReviewData.rating}/5) was deleted`,
        relatedId: deletedReviewData.id,
      };

      console.log('🔍 Creating deletion notification with data:', notificationData);

      const notification = new Notification(notificationData);
      await notification.save();
      console.log('✅ Deletion notification created:', notification._id);

      if (req.app && req.app.get('io')) {
        emitNotification(req, notification);
        console.log('✅ Socket notification emitted for deletion');
      }
    } catch (notifError) {
      console.error('⚠️ Notification creation failed (non-critical):', notifError.message);
      console.error('Full notification error:', notifError);
    }

    res.json({ 
      success: true, 
      message: "Review deleted successfully" 
    });
  } catch (error) {
    console.error("❌ Error deleting review:", error);
    res.status(500).json({ error: "Server error", message: error.message });
  }
};

module.exports = {
  addReview,
  getAllReviews,
  getReviewsByProperty,
  deleteReview
};