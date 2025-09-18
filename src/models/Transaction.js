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
      ref: "Customer", // Optional: if you create a Customer model later
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

    // Transaction details
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'inr',
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

// Index to quickly find unique customers by phone (avoids duplicates)
transactionSchema.index({ customerPhone: 1 });

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;
