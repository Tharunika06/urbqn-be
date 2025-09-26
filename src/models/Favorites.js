// models/Favorites.js
const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  propertyId: {
    type: String,
    required: true,
    index: true
  },
  property: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Create compound index to prevent duplicates
favoriteSchema.index({ userId: 1, propertyId: 1 }, { unique: true });

// Static methods that your controller expects
favoriteSchema.statics.findByUser = function(userId) {
  return this.find({ userId }).sort({ createdAt: -1 });
};

favoriteSchema.statics.findUserFavorite = function(userId, propertyId) {
  return this.findOne({ userId, propertyId });
};

favoriteSchema.statics.removeUserFavorite = function(userId, propertyId) {
  return this.findOneAndDelete({ userId, propertyId });
};

favoriteSchema.statics.removeAllUserFavorites = function(userId) {
  return this.deleteMany({ userId });
};

favoriteSchema.statics.countUserFavorites = function(userId) {
  return this.countDocuments({ userId });
};

// Instance method for JSON conversion
favoriteSchema.methods.toJSON = function() {
  const favorite = this.toObject();
  return {
    id: favorite._id,
    userId: favorite.userId,
    propertyId: favorite.propertyId,
    property: favorite.property,
    createdAt: favorite.createdAt
  };
};

const Favorite = mongoose.model('Favorite', favoriteSchema);

module.exports = Favorite;