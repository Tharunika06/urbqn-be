// scripts/recalculateOwnerStats.js
// Run this script to recalculate all owner statistics
// Usage: node scripts/recalculateOwnerStats.js

const mongoose = require('mongoose');
const Owner = require('../models/Owner');
const Property = require('../models/Property');
require('dotenv').config();

async function recalculateAllOwnerStats() {
  try {
    console.log('\n🚀 Starting owner statistics recalculation...\n');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB\n');

    // Get all owners
    const owners = await Owner.find();
    console.log(`📊 Found ${owners.length} owners\n`);

    let successCount = 0;
    let errorCount = 0;
    let updatedCount = 0;

    // Process each owner
    for (const owner of owners) {
      try {
        const numericOwnerId = parseInt(owner.ownerId);
        
        // Count properties by status
        const rentProperties = await Property.countDocuments({ 
          ownerId: numericOwnerId, 
          status: { $in: ['rent', 'both'] } 
        });
        
        const saleProperties = await Property.countDocuments({ 
          ownerId: numericOwnerId, 
        status: { $in: ['sale', 'both'] } 
        });

        const totalProperties = await Property.countDocuments({ 
          ownerId: numericOwnerId 
        });

        // Check if stats need updating
        const needsUpdate = 
          owner.propertyRent !== rentProperties ||
          owner.propertySold !== saleProperties ||
          owner.propertyOwned !== totalProperties ||
          owner.totalListing !== (rentProperties + saleProperties);

        if (needsUpdate) {
          // Update owner stats
          owner.propertyRent = rentProperties;
          owner.propertySold = saleProperties;
          owner.propertyOwned = totalProperties;
          owner.totalListing = rentProperties + saleProperties;

          await owner.save();
          updatedCount++;

          console.log(`✅ Updated: ${owner.name} (ID: ${owner.ownerId})`);
          console.log(`   📊 Total: ${totalProperties} | Rent: ${rentProperties} | Sale: ${saleProperties} | Listings: ${owner.totalListing}`);
        } else {
          console.log(`✓  Skipped: ${owner.name} (ID: ${owner.ownerId}) - Stats already correct`);
        }

        successCount++;
      } catch (error) {
        errorCount++;
        console.error(`❌ Error processing owner ${owner.ownerId}:`, error.message);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📈 RECALCULATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Successfully processed: ${successCount}`);
    console.log(`🔄 Updated: ${updatedCount}`);
    console.log(`⏭️  Skipped (already correct): ${successCount - updatedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📊 Total owners: ${owners.length}`);
    console.log('='.repeat(60) + '\n');

    // Disconnect
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n💥 CRITICAL ERROR:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the script
recalculateAllOwnerStats();