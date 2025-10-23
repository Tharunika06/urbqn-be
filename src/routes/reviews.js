// src/routes/review.js
const express = require("express");
const router = express.Router();
const reviewController = require("../controllers/reviewController");

// ============= PENDING REVIEW ROUTES (Must come FIRST) =============
// POST: Mark review as pending
router.post("/pending", reviewController.markReviewPending);

// GET: Check if customer has pending review for a property
// Changed to use customerIdentifier (phone or email) instead of userId
router.get("/pending/:propertyId/:customerIdentifier", reviewController.checkPendingReview);

// DELETE: Remove pending review
router.delete("/pending/:propertyId/:customerIdentifier", reviewController.deletePendingReview);

// ============= STANDARD REVIEW ROUTES =============
// POST: Add review
router.post("/", reviewController.addReview);

// GET: All reviews (Admin)
router.get("/", reviewController.getAllReviews);

// GET: Reviews by property
router.get("/property/:propertyId", reviewController.getReviewsByProperty);

// DELETE: Remove a review
router.delete("/:id", reviewController.deleteReview);

module.exports = router;