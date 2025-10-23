// src/controllers/reviewController.js
const Review = require("../models/Review");
const Transaction = require("../models/Transaction");
const Notification = require("../models/Notification");
const PendingReview = require("../models/PendingReview");
const { emitNotification } = require("../utils/socketUtils");

// Add new review
const addReview = async (req, res) => {
  try {
    const { 
      propertyId, 
      customerPhone, 
      customerEmail,
      customerName,
      rating, 
      comment 
    } = req.body;
    
    // Validate required fields
    if (!propertyId || !rating || !comment || !customerPhone) {
      return res.status(400).json({ 
        error: "Missing required fields: propertyId, rating, comment, and customerPhone are required" 
      });
    }

    // Validate rating range
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    // Check if user already reviewed this property
    const existingReview = await Review.findOne({
      propertyId,
      $or: [
        { customerPhone },
        ...(customerEmail ? [{ customerEmail: customerEmail.toLowerCase() }] : [])
      ]
    });

    if (existingReview) {
      return res.status(400).json({ 
        error: "You have already reviewed this property" 
      });
    }

    // Find the transaction for this customer and property
    const transaction = await Transaction.findOne({ 
      property: propertyId,
      $or: [
        { customerPhone },
        ...(customerEmail ? [{ customerEmail: customerEmail.toLowerCase() }] : [])
      ]
    }).sort({ createdAt: -1 });
    
    if (!transaction) {
      return res.status(404).json({ 
        error: "No transaction found. Only customers who have completed a transaction can review." 
      });
    }

    // Create new review
    const newReview = new Review({
      propertyId,
      transactionId: transaction._id,
      customerName: customerName || transaction.customerName,
      customerPhone,
      customerEmail: customerEmail ? customerEmail.toLowerCase() : transaction.customerEmail,
      rating,
      comment,
      verified: true,
    });
    
    await newReview.save();
    console.log('✅ Review saved successfully:', newReview._id);

    // Auto-complete pending review
    try {
      const completedCount = await PendingReview.updateMany(
        {
          propertyId,
          status: 'pending',
          $or: [
            { customerPhone },
            ...(customerEmail ? [{ customerEmail: customerEmail.toLowerCase() }] : [])
          ]
        },
        { 
          status: 'completed',
          updatedAt: Date.now()
        }
      );
      
      if (completedCount.modifiedCount > 0) {
        console.log(`✅ Pending review completed for customer: ${customerPhone}`);
      }
    } catch (pendingError) {
      console.error('⚠️ Failed to complete pending review:', pendingError.message);
    }

    // Create notification
    try {
      const notificationData = {
        userId: null,
        type: "review",
        target: "admin",
        message: `New review (${rating}/5) by ${newReview.customerName}`,
        relatedId: newReview._id,
      };

      const notification = new Notification(notificationData);
      await notification.save();
      console.log('✅ Review notification created:', notification._id);

      if (req.app && req.app.get('io')) {
        emitNotification(req, notification);
        console.log('✅ Socket notification emitted');
      }
    } catch (notifError) {
      console.error('⚠️ Notification creation failed (non-critical):', notifError.message);
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

// Mark review as pending (called when user clicks "Review Later")
const markReviewPending = async (req, res) => {
  try {
    const { propertyId, customerPhone, customerEmail } = req.body;

    if (!propertyId || !customerPhone) {
      return res.status(400).json({ 
        error: 'Property ID and customer phone are required' 
      });
    }

    // Find the transaction for this customer and property
    const transaction = await Transaction.findOne({ 
      property: propertyId,
      $or: [
        { customerPhone },
        ...(customerEmail ? [{ customerEmail: customerEmail.toLowerCase() }] : [])
      ]
    }).sort({ createdAt: -1 });

    if (!transaction) {
      return res.status(404).json({ 
        error: 'No transaction found for this customer and property' 
      });
    }

    // Check if pending review already exists
    const existingPending = await PendingReview.findOne({ 
      propertyId, 
      customerPhone,
      status: 'pending'
    });

    if (existingPending) {
      existingPending.updatedAt = new Date();
      await existingPending.save();
      
      console.log('✅ Pending review updated:', existingPending._id);
      return res.status(200).json({
        success: true,
        message: 'Pending review updated',
        pendingReview: existingPending
      });
    }

    // Create new pending review
    const newPendingReview = new PendingReview({
      propertyId,
      transactionId: transaction._id,
      customerEmail: customerEmail ? customerEmail.toLowerCase() : transaction.customerEmail,
      customerPhone,
      customerName: transaction.customerName,
      purchaseType: transaction.purchaseType || 'buy',
      status: 'pending',
    });

    await newPendingReview.save();
    console.log('✅ Review marked as pending:', newPendingReview._id);

    res.status(201).json({
      success: true,
      message: 'Review marked as pending',
      pendingReview: newPendingReview
    });

  } catch (error) {
    console.error('❌ Error marking review as pending:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: error.message 
    });
  }
};

// Check if customer has pending review for a property
const checkPendingReview = async (req, res) => {
  try {
    const { propertyId, customerIdentifier } = req.params;

    if (!propertyId || !customerIdentifier) {
      return res.status(400).json({ 
        error: "Property ID and customer identifier are required" 
      });
    }

    // Check for pending review (by phone or email)
    const pendingReview = await PendingReview.findOne({ 
      propertyId, 
      $or: [
        { customerPhone: customerIdentifier },
        { customerEmail: customerIdentifier.toLowerCase() }
      ],
      status: 'pending'
    });

    // Check if customer has already completed a review
    const completedReview = await Review.findOne({ 
      propertyId,
      $or: [
        { customerPhone: customerIdentifier },
        { customerEmail: customerIdentifier.toLowerCase() }
      ]
    });

    // Check if there's a transaction for this customer and property
    const hasTransaction = await Transaction.findOne({ 
      property: propertyId,
      $or: [
        { customerPhone: customerIdentifier },
        { customerEmail: customerIdentifier.toLowerCase() }
      ]
    });

    console.log('🔍 Review status check:', {
      propertyId,
      customerIdentifier,
      hasPendingReview: !!pendingReview,
      hasCompletedReview: !!completedReview,
      hasTransaction: !!hasTransaction
    });

    res.status(200).json({
      success: true,
      hasPendingReview: !!pendingReview,
      hasCompletedReview: !!completedReview,
      hasTransaction: !!hasTransaction,
      shouldShowReviewPrompt: !!pendingReview && !completedReview,
      pendingReview: pendingReview,
      customerInfo: hasTransaction ? {
        name: hasTransaction.customerName,
        phone: hasTransaction.customerPhone,
        email: hasTransaction.customerEmail
      } : null
    });

  } catch (error) {
    console.error('❌ Error checking pending review:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: error.message 
    });
  }
};

// Delete pending review
const deletePendingReview = async (req, res) => {
  try {
    const { propertyId, customerIdentifier } = req.params;

    if (!propertyId || !customerIdentifier) {
      return res.status(400).json({ 
        error: "Property ID and customer identifier are required" 
      });
    }

    const result = await PendingReview.deleteOne({ 
      propertyId, 
      $or: [
        { customerPhone: customerIdentifier },
        { customerEmail: customerIdentifier.toLowerCase() }
      ]
    });
    
    if (result.deletedCount > 0) {
      console.log('✅ Pending review deleted for customer:', customerIdentifier);
      res.status(200).json({
        success: true,
        message: 'Pending review removed'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Pending review not found'
      });
    }

  } catch (error) {
    console.error('❌ Error deleting pending review:', error);
    res.status(500).json({ 
      error: 'Server error',
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

    const deletedReviewData = {
      customerName: review.customerName,
      rating: review.rating,
      id: review._id
    };

    await Review.findByIdAndDelete(id);
    console.log('✅ Review deleted:', id);

    try {
      const notificationData = {
        userId: null,
        type: "review_deleted",
        target: "admin",
        message: `Review by ${deletedReviewData.customerName} (${deletedReviewData.rating}/5) was deleted`,
        relatedId: deletedReviewData.id,
      };

      const notification = new Notification(notificationData);
      await notification.save();

      if (req.app && req.app.get('io')) {
        emitNotification(req, notification);
      }
    } catch (notifError) {
      console.error('⚠️ Notification creation failed (non-critical):', notifError.message);
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
  markReviewPending,
  checkPendingReview,
  deletePendingReview,
  getAllReviews,
  getReviewsByProperty,
  deleteReview
};