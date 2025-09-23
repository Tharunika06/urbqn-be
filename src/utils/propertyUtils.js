const Owner = require('../models/Owner');

// Clean price input
exports.cleanPrice = (priceInput) => {
  if (!priceInput) return null;
  if (typeof priceInput === 'number') return priceInput;
  if (typeof priceInput === 'string') {
    const cleaned = priceInput.replace(/[^\d.-]/g, '');
    const numericValue = parseFloat(cleaned);
    return !isNaN(numericValue) ? numericValue : null;
  }
  return null;
};

// Populate owner details for properties
exports.populateOwnerDetails = async (properties) => {
  if (!Array.isArray(properties)) {
    if (properties.ownerId) {
      const owner = await Owner.findOne({ ownerId: properties.ownerId });
      return {
        ...properties.toObject(),
        ownerDetails: owner || null
      };
    }
    return properties.toObject();
  }

  const propertiesWithOwners = await Promise.all(
    properties.map(async (property) => {
      if (property.ownerId) {
        const owner = await Owner.findOne({ ownerId: property.ownerId });
        return {
          ...property.toObject(),
          ownerDetails: owner || null
        };
      }
      return property.toObject();
    })
  );

  return propertiesWithOwners;
};
