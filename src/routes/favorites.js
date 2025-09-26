// routes/favorites.js
const express = require('express');
const router = express.Router();
const FavoriteController = require('../controllers/favoriteController');

// Middleware for request logging (optional)
const requestLogger = (req, res, next) => {
  console.log(`${req.method} ${req.originalUrl}`, {
    params: req.params,
    body: req.method !== 'GET' ? req.body : undefined,
    timestamp: new Date().toISOString()
  });
  next();
};

// Apply logging middleware to all routes
router.use(requestLogger);

// Validation middleware
const validateUserId = (req, res, next) => {
  const userId = req.params.userId || req.body.userId;
  if (!userId) {
    return res.status(400).json({
      success: false,
      message: 'User ID is required'
    });
  }
  next();
};

// Routes
// GET /api/favorites/:userId - Get all favorites for a user
router.get('/:userId', validateUserId, FavoriteController.getUserFavorites);

// GET /api/favorites/:userId/count - Get favorite count for a user
router.get('/:userId/count', validateUserId, FavoriteController.getFavoriteCount);

// GET /api/favorites/:userId/check/:propertyId - Check if property is favorited
router.get('/:userId/check/:propertyId', validateUserId, FavoriteController.checkFavorite);

// POST /api/favorites - Add a property to favorites
router.post('/', FavoriteController.addFavorite);

// POST /api/favorites/:userId/bulk - Add multiple properties to favorites
router.post('/:userId/bulk', validateUserId, FavoriteController.bulkAddFavorites);

// DELETE /api/favorites/:userId/:propertyId - Remove a property from favorites
router.delete('/:userId/:propertyId', validateUserId, FavoriteController.removeFavorite);

// DELETE /api/favorites/:userId - Remove all favorites for a user
router.delete('/:userId', validateUserId, FavoriteController.removeAllFavorites);

// Error handling middleware for this router
router.use((error, req, res, next) => {
  console.error('Favorites route error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

module.exports = router;

// Register this router in your main app.js file:
// const favoriteRoutes = require('./routes/favorites');
// app.use('/api/favorites', favoriteRoutes);