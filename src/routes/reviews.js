const express = require("express");
const router = express.Router();
const reviewController = require("../controllers/reviewController");

// POST: Add review
router.post("/", reviewController.addReview);

// GET: All reviews (Admin)
router.get("/", reviewController.getAllReviews);

// GET: Reviews by property
router.get("/:propertyId", reviewController.getReviewsByProperty);

// DELETE: Remove a review
router.delete("/:id", reviewController.deleteReview);

module.exports = router;