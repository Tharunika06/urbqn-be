const express = require('express');
const router = express.Router();
const FavoriteController = require('../controllers/favoriteController');

// Request logger middleware
const requestLogger = (req, res, next) => {
  console.log(`${req.method} ${req.originalUrl}`, {
    params: req.params,
    body: req.method !== 'GET' ? req.body : undefined,
    timestamp: new Date().toISOString()
  });
  next();
};

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

// ⭐ NEW ROUTES - Must be BEFORE /:userId to avoid route conflicts
// GET /api/favorites/popular/detailed/:limit - Get detailed popular properties with limit
router.get('/popular/detailed/:limit', FavoriteController.getPopularPropertiesDetailed);

// GET /api/favorites/popular/detailed - Get detailed popular properties (no limit)
router.get('/popular/detailed', FavoriteController.getPopularPropertiesDetailed);

// GET /api/favorites/popular/:limit - Get most favorited properties with limit
router.get('/popular/:limit', FavoriteController.getPopularProperties);

// GET /api/favorites/popular - Get most favorited properties (no limit)
router.get('/popular', FavoriteController.getPopularProperties);

// EXISTING ROUTES
// GET /api/favorites/:userId/count - Get favorite count for a user
router.get('/:userId/count', validateUserId, FavoriteController.getFavoriteCount);

// GET /api/favorites/:userId/check/:propertyId - Check if property is favorited
router.get('/:userId/check/:propertyId', validateUserId, FavoriteController.checkFavorite);

// GET /api/favorites/:userId - Get all favorites for a user
router.get('/:userId', validateUserId, FavoriteController.getUserFavorites);

// POST /api/favorites - Add a property to favorites
router.post('/', FavoriteController.addFavorite);

// POST /api/favorites/:userId/bulk - Add multiple properties to favorites
router.post('/:userId/bulk', validateUserId, FavoriteController.bulkAddFavorites);

// DELETE /api/favorites/:userId/:propertyId - Remove a property from favorites
router.delete('/:userId/:propertyId', validateUserId, FavoriteController.removeFavorite);

// DELETE /api/favorites/:userId - Remove all favorites for a user
router.delete('/:userId', validateUserId, FavoriteController.removeAllFavorites);

// Error handling middleware
router.use((error, req, res, next) => {
  console.error('Favorites route error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

module.exports = router;