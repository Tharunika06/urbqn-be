// src/routes/transactionRoutes.js

const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// Create payment intent
router.post('/create-payment-intent', paymentController.createPaymentIntent);

// Save transaction details
router.post('/save-transaction', paymentController.saveTransaction);

// Get all transactions
router.get('/transactions', paymentController.getAllTransactions);

// Delete a specific transaction by customTransactionId
router.delete('/transactions/:transactionId', paymentController.deleteTransaction);

// Get monthly buyers count
router.get('/buyers', paymentController.getMonthlyBuyers);

// Get all unique customers
router.get('/customers', paymentController.getAllCustomers);

// Get customer details by phone
router.get('/customer/:phone', paymentController.getCustomerByPhone);

// Delete customer (removes all their transactions)
router.delete('/customer/:phone', paymentController.deleteCustomer);

// Get customer transaction statistics
router.get('/customer/:phone/stats', paymentController.getCustomerStats);

module.exports = router;