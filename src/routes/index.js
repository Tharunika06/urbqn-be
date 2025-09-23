// routes/index.js
const express = require('express');
const router = express.Router();

// Import all routes
router.use('/', require('./auth'));
router.use('/property', require('./property'));
router.use('/owners', require('./ownerRoutes'));
router.use('/payment', require('./transactionRoutes'));
router.use('/reviews', require('./reviews'));
router.use('/stats', require('./stats'));
router.use('/sales', require('./sales'));
router.use('/notifications', require('./notification'));
router.use('/profiles', require('./profileRoutes'));

// ✅ Add this line
router.use('/admin', require('./adminRoutes'));

module.exports = router;
