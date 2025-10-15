// controllers/favoriteController.js
const Favorite = require('../models/Favorites');

class FavoriteController {
  // GET /api/favorites/:userId - Get all favorites for a user
  static async getUserFavorites(req, res) {
    try {
      const { userId } = req.params;
      
      console.log('Getting favorites for userId:', userId); // Debug log
      
      if (!userId || userId === 'undefined' || userId === 'null') {
        return res.status(400).json({
          success: false,
          message: 'Valid User ID is required',
          receivedUserId: userId
        });
      }

      const favorites = await Favorite.findByUser(userId);
      
      console.log(`Found ${favorites?.length || 0} favorites for user ${userId}`); // Debug log

      res.json({
        success: true,
        favorites: favorites || []
      });
    } catch (error) {
      console.error('Error fetching favorites:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch favorites',
        error: error.message
      });
    }
  }

  // POST /api/favorites - Add a property to favorites
  static async addFavorite(req, res) {
    try {
      const { userId, propertyId, property } = req.body;

      console.log('Adding favorite:', { userId, propertyId, hasProperty: !!property }); // Debug log

      // Validate required fields
      if (!userId || userId === 'undefined' || userId === 'null') {
        return res.status(400).json({
          success: false,
          message: 'Valid userId is required',
          received: {
            userId: userId,
            propertyId: !!propertyId,
            property: !!property
          }
        });
      }

      if (!propertyId || propertyId === 'undefined' || propertyId === 'null') {
        return res.status(400).json({
          success: false,
          message: 'Valid propertyId is required',
          received: {
            userId: !!userId,
            propertyId: propertyId,
            property: !!property
          }
        });
      }

      if (!property) {
        return res.status(400).json({
          success: false,
          message: 'Property data is required',
          received: {
            userId: !!userId,
            propertyId: !!propertyId,
            property: property
          }
        });
      }

      // Check if already favorited
      const existingFavorite = await Favorite.findUserFavorite(userId, propertyId);
      if (existingFavorite) {
        console.log('Property already favorited:', { userId, propertyId });
        return res.status(409).json({
          success: false,
          message: 'Property already in favorites'
        });
      }

      // Create new favorite
      const favorite = new Favorite({
        userId,
        propertyId,
        property
      });

      await favorite.save();
      
      console.log('Successfully added favorite:', { userId, propertyId }); // Debug log

      res.status(201).json({
        success: true,
        message: 'Property added to favorites',
        favorite: favorite.toJSON()
      });
    } catch (error) {
      console.error('Error adding favorite:', error);
      
      // Handle duplicate key error (in case the index catches it)
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: 'Property already in favorites'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to add favorite',
        error: error.message
      });
    }
  }

  // DELETE /api/favorites/:userId/:propertyId - Remove a property from favorites
  static async removeFavorite(req, res) {
    try {
      const { userId, propertyId } = req.params;

      console.log('Removing favorite:', { userId, propertyId }); // Debug log

      if (!userId || userId === 'undefined' || userId === 'null') {
        return res.status(400).json({
          success: false,
          message: 'Valid User ID is required',
          receivedUserId: userId
        });
      }

      if (!propertyId || propertyId === 'undefined' || propertyId === 'null') {
        return res.status(400).json({
          success: false,
          message: 'Valid Property ID is required',
          receivedPropertyId: propertyId
        });
      }

      const result = await Favorite.removeUserFavorite(userId, propertyId);

      if (!result) {
        console.log('Favorite not found:', { userId, propertyId });
        return res.status(404).json({
          success: false,
          message: 'Favorite not found'
        });
      }

      console.log('Successfully removed favorite:', { userId, propertyId }); // Debug log

      res.json({
        success: true,
        message: 'Property removed from favorites'
      });
    } catch (error) {
      console.error('Error removing favorite:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to remove favorite',
        error: error.message
      });
    }
  }

  // DELETE /api/favorites/:userId - Remove all favorites for a user
  static async removeAllFavorites(req, res) {
    try {
      const { userId } = req.params;

      if (!userId || userId === 'undefined' || userId === 'null') {
        return res.status(400).json({
          success: false,
          message: 'Valid User ID is required',
          receivedUserId: userId
        });
      }

      const result = await Favorite.removeAllUserFavorites(userId);

      res.json({
        success: true,
        message: `Removed ${result.deletedCount} favorites`,
        deletedCount: result.deletedCount
      });
    } catch (error) {
      console.error('Error removing all favorites:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to remove favorites',
        error: error.message
      });
    }
  }

  // GET /api/favorites/:userId/count - Get favorite count for a user
  static async getFavoriteCount(req, res) {
    try {
      const { userId } = req.params;
      
      if (!userId || userId === 'undefined' || userId === 'null') {
        return res.status(400).json({
          success: false,
          message: 'Valid User ID is required',
          receivedUserId: userId
        });
      }

      const count = await Favorite.countUserFavorites(userId);

      res.json({
        success: true,
        count: count
      });
    } catch (error) {
      console.error('Error counting favorites:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to count favorites',
        error: error.message
      });
    }
  }

  // POST /api/favorites/:userId/bulk - Add multiple properties to favorites
  static async bulkAddFavorites(req, res) {
    try {
      const { userId } = req.params;
      const { properties } = req.body; // Array of { propertyId, property }

      if (!userId || userId === 'undefined' || userId === 'null') {
        return res.status(400).json({
          success: false,
          message: 'Valid User ID is required',
          receivedUserId: userId
        });
      }

      if (!properties || !Array.isArray(properties)) {
        return res.status(400).json({
          success: false,
          message: 'Properties array is required'
        });
      }

      const favorites = properties.map(item => ({
        userId,
        propertyId: item.propertyId,
        property: item.property
      }));

      // Use insertMany with ordered: false to continue on duplicates
      const result = await Favorite.insertMany(favorites, { ordered: false });

      res.status(201).json({
        success: true,
        message: `Added ${result.length} properties to favorites`,
        addedCount: result.length
      });
    } catch (error) {
      console.error('Error bulk adding favorites:', error);
      
      // Handle bulk write errors (some might succeed, some might fail due to duplicates)
      if (error.writeErrors) {
        const successCount = error.result.insertedCount || 0;
        return res.status(207).json({ // 207 Multi-Status
          success: true,
          message: `Added ${successCount} properties to favorites (${error.writeErrors.length} duplicates skipped)`,
          addedCount: successCount,
          duplicates: error.writeErrors.length
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to add favorites',
        error: error.message
      });
    }
  }

  // GET /api/favorites/:userId/check/:propertyId - Check if property is favorited
  static async checkFavorite(req, res) {
    try {
      const { userId, propertyId } = req.params;

      if (!userId || userId === 'undefined' || userId === 'null') {
        return res.status(400).json({
          success: false,
          message: 'Valid User ID is required',
          receivedUserId: userId
        });
      }

      if (!propertyId || propertyId === 'undefined' || propertyId === 'null') {
        return res.status(400).json({
          success: false,
          message: 'Valid Property ID is required',
          receivedPropertyId: propertyId
        });
      }

      const favorite = await Favorite.findUserFavorite(userId, propertyId);

      res.json({
        success: true,
        isFavorited: !!favorite,
        favorite: favorite ? favorite.toJSON() : null
      });
    } catch (error) {
      console.error('Error checking favorite:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check favorite',
        error: error.message
      });
    }
  }

  // GET /api/favorites/popular/:limit? - Get most favorited properties
  static async getPopularProperties(req, res) {
    try {
      const limit = parseInt(req.params.limit) || 10; // Default to 10 properties

      console.log(`Getting top ${limit} popular properties`); // Debug log

      // Aggregate to count favorites per property
      const popularProperties = await Favorite.aggregate([
        {
          $group: {
            _id: '$propertyId',
            favoriteCount: { $sum: 1 },
            property: { $first: '$property' } // Get property details from first occurrence
          }
        },
        {
          $sort: { favoriteCount: -1 } // Sort by favorite count descending
        },
        {
          $limit: limit
        },
        {
          $project: {
            _id: 0,
            propertyId: '$_id',
            favoriteCount: 1,
            property: 1
          }
        }
      ]);

      console.log(`Found ${popularProperties.length} popular properties`); // Debug log

      res.json({
        success: true,
        properties: popularProperties,
        count: popularProperties.length
      });
    } catch (error) {
      console.error('Error fetching popular properties:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch popular properties',
        error: error.message
      });
    }
  }

  // GET /api/favorites/popular/detailed/:limit? - Get detailed popular properties
  static async getPopularPropertiesDetailed(req, res) {
    try {
      const limit = parseInt(req.params.limit) || 10;
      const minFavorites = parseInt(req.query.minFavorites) || 1; // Optional: minimum favorites filter

      console.log(`Getting popular properties (limit: ${limit}, minFavorites: ${minFavorites})`);

      const popularProperties = await Favorite.aggregate([
        {
          $group: {
            _id: '$propertyId',
            favoriteCount: { $sum: 1 },
            property: { $first: '$property' },
            favoritedBy: { $push: '$userId' } // Track which users favorited it
          }
        },
        {
          $match: {
            favoriteCount: { $gte: minFavorites }
          }
        },
        {
          $sort: { favoriteCount: -1, _id: 1 } // Secondary sort by ID for consistency
        },
        {
          $limit: limit
        },
        {
          $project: {
            _id: 0,
            propertyId: '$_id',
            favoriteCount: 1,
            property: 1,
            userCount: { $size: '$favoritedBy' }
            // Optionally include favoritedBy if you need to show user info
          }
        }
      ]);

      res.json({
        success: true,
        properties: popularProperties,
        count: popularProperties.length,
        totalFavorites: popularProperties.reduce((sum, p) => sum + p.favoriteCount, 0)
      });
    } catch (error) {
      console.error('Error fetching popular properties:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch popular properties',
        error: error.message
      });
    }
  }
}

// ✅ CORRECT MODULE EXPORTS
module.exports = {
  getUserFavorites: FavoriteController.getUserFavorites,
  addFavorite: FavoriteController.addFavorite,
  removeFavorite: FavoriteController.removeFavorite,
  removeAllFavorites: FavoriteController.removeAllFavorites,
  getFavoriteCount: FavoriteController.getFavoriteCount,
  bulkAddFavorites: FavoriteController.bulkAddFavorites,
  checkFavorite: FavoriteController.checkFavorite,
  getPopularProperties: FavoriteController.getPopularProperties,
  getPopularPropertiesDetailed: FavoriteController.getPopularPropertiesDetailed
};