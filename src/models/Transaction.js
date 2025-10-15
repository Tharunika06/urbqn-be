// src/models/Transaction.js
const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    // Human-readable, sequential ID (e.g., TNX#001)
    customTransactionId: {
      type: String,
      required: true,
      unique: true,
    },
    // Stripe payment ID (for auditing/reference)
    stripePaymentId: {
      type: String,
      required: true,
      unique: true,
    },
    // Customer details
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
    },
    customerName: {
      type: String,
      required: true,
      trim: true,
    },
    customerPhone: {
      type: String,
      required: true,
      trim: true,
    },
    customerEmail: {
      type: String,
      default: null,
      trim: true,
      lowercase: true
    },
    customerPhoto: {
      type: String,
      default: null
    },
    // Transaction details
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'dollar',
    },
    // NEW: Purchase type field
    purchaseType: {
      type: String,
      enum: ['buy', 'rent'],
      required: true,
      default: 'buy'
    },
    // Reference to property
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      required: true,
    },
    ownerName: {
      type: String,
      required: true,
      trim: true,
    },
    paymentMethod: {
      type: String,
      default: 'card',
    },
    status: {
      type: String,
      enum: ['Completed', 'Pending', 'Failed'],
      default: 'Completed',
    },
  },
  {
    timestamps: true,
  }
);

// Index to quickly find unique customers by phone
transactionSchema.index({ customerPhone: 1 });
// Index for email lookups
transactionSchema.index({ customerEmail: 1 });
// Compound index for customer queries
transactionSchema.index({ customerPhone: 1, createdAt: -1 });
// NEW: Index for purchase type queries
transactionSchema.index({ purchaseType: 1 });
transactionSchema.index({ purchaseType: 1, createdAt: -1 });

const Transaction = mongoose.model('Transaction', transactionSchema);
module.exports = Transaction;