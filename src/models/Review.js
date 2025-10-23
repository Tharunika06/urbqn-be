// models/Review.js
const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
    },
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
    },
    customerName: {
      type: String,
      required: true,
    },
    customerPhone: {
      type: String,
      required: true,
      trim: true,
    },
    customerEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    comment: {
      type: String,
      required: true,
    },
    verified: {
      type: Boolean,
      default: true, // True if they completed a transaction
    },
  },
  { timestamps: true }
);

// Index for quick lookups
reviewSchema.index({ propertyId: 1, customerPhone: 1 });
reviewSchema.index({ customerEmail: 1 });

const Review = mongoose.model("Review", reviewSchema);

module.exports = Review;