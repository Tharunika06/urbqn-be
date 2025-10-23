// models/PendingReview.js
const mongoose = require("mongoose");

const PendingReviewSchema = new mongoose.Schema({
  propertyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Property",
    required: true,
  },
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Transaction",
    required: true,
  },
  // Store customer identifier (email or phone)
  customerEmail: {
    type: String,
    trim: true,
    lowercase: true,
  },
  customerPhone: {
    type: String,
    required: true,
    trim: true,
  },
  customerName: {
    type: String,
    required: true,
    trim: true,
  },
  purchaseType: {
    type: String,
    enum: ['buy', 'rent'],
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'completed'],
    default: 'pending',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  }
});

// Compound index to prevent duplicate pending reviews
PendingReviewSchema.index({ propertyId: 1, customerPhone: 1, status: 1 });
PendingReviewSchema.index({ customerEmail: 1, status: 1 });
PendingReviewSchema.index({ transactionId: 1 });

// Update the updatedAt timestamp before saving
PendingReviewSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("PendingReview", PendingReviewSchema);