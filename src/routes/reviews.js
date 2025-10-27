// src/routes/review.js
const express = require("express");
const router = express.Router();
const reviewController = require("../controllers/reviewController");
router.post("/pending", reviewController.markReviewPending);

// GET: Check if customer has pending review for a property
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