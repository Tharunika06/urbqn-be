// src/controllers/paymentController.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Transaction = require('../models/Transaction');
const Property = require('../models/Property');
const Owner = require('../models/Owner');
const Profile = require('../models/Profile');
const Notification = require('../models/Notification');
const Counter = require('../models/Counter');
const { emitNotification } = require('../utils/socketUtils');
const PendingReview = require('../models/PendingReview');
const Review = require('../models/Review');

// ============ HELPER: UPDATE OWNER STATS AFTER TRANSACTION ============
async function updateOwnerStatsAfterTransaction(propertyId, purchaseType) {
  try {
    console.log('\n📊 Updating owner stats after transaction...');
    console.log(`🏠 Property ID: ${propertyId}`);
    console.log(`📦 Purchase Type: ${purchaseType}`);

    // Get property details
    const property = await Property.findById(propertyId);
    if (!property) {
      console.error('❌ Property not found');
      return null;
    }

    // Get owner
    const owner = await Owner.findOne({ ownerId: property.ownerId });
    if (!owner) {
      console.error(`❌ Owner not found for ownerId: ${property.ownerId}`);
      return null;
    }

    console.log(`👤 Owner: ${owner.name} (ID: ${owner.ownerId})`);

    // Recalculate ALL stats from scratch based on actual properties
    const numericOwnerId = parseInt(owner.ownerId);

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
    
    // ✅ NEW: Count sold properties
    const soldProperties = await Property.countDocuments({ 
      ownerId: numericOwnerId, 
      status: 'sold' 
    });

    // Update owner stats
    owner.propertyRent = rentProperties;
    owner.propertySold = saleProperties;
    owner.propertyOwned = totalProperties;
    owner.totalListing = rentProperties + saleProperties; // Exclude sold from listings

    await owner.save();

    console.log('✅ Owner stats updated:');
    console.log(`   📊 Total Properties: ${totalProperties}`);
    console.log(`   🏠 For Rent: ${rentProperties}`);
    console.log(`   💰 For Sale: ${saleProperties}`);
    console.log(`   ✅ Sold: ${soldProperties}`);
    console.log(`   📈 Total Listings: ${owner.totalListing}`);

    return owner;
  } catch (error) {
    console.error('❌ Error updating owner stats:', error.message);
    return null;
  }
}

// Helper function for sequence generation
async function getNextSequenceValue(sequenceName) {
  const counter = await Counter.findByIdAndUpdate(
    sequenceName,
    { $inc: { seq: 1 } },
    {
      new: true,
      upsert: true
    }
  );
  return counter.seq;
}

// Helper function to fetch profile by EMAIL with phone validation
async function getProfileByEmailAndPhone(email, phoneNumber) {
  try {
    if (!email) {
      console.log('⚠️ No email provided, cannot fetch profile');
      return null;
    }

    const cleanPhone = phoneNumber ? phoneNumber.trim().replace(/[\s-()]/g, '') : null;

    console.log(`🔍 Searching for profile with email: ${email}`);
    console.log(`📱 Expected phone: ${cleanPhone}`);

    const profile = await Profile.findOne({ 
      email: email.toLowerCase() 
    });

    if (profile) {
      console.log(`✅ Profile found for email: ${profile.email}`);
      console.log(`👤 Name: ${profile.firstName} ${profile.lastName}`);
      console.log(`📱 Profile phone: ${profile.phone}`);
      console.log(`📸 Has photo: ${!!profile.photo}`);

      if (cleanPhone && profile.phone) {
        const profileCleanPhone = profile.phone.trim().replace(/[\s-()]/g, '');
        if (profileCleanPhone !== cleanPhone) {
          console.log(`⚠️ WARNING: Phone mismatch!`);
          console.log(`   Transaction phone: ${cleanPhone}`);
          console.log(`   Profile phone: ${profileCleanPhone}`);
        }
      }

      return profile;
    } else {
      console.log(`⚠️ No profile found for email: ${email}`);
      return null;
    }
  } catch (error) {
    console.error('❌ Error fetching profile by email:', error);
    return null;
  }
}

// Create payment intent
const createPaymentIntent = async (req, res) => {
  const { amount } = req.body;
  if (!amount || amount <= 0) {
    return res.status(400).send({ error: 'Invalid amount provided.' });
  }
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'inr',
      automatic_payment_methods: { enabled: true },
    });
    res.send({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error('Stripe Error:', error.message);
    res.status(500).send({ error: error.message });
  }
};

// ✅ UPDATED: Save transaction and mark property as sold if purchaseType is 'buy'
const saveTransaction = async (req, res) => {
  console.log('\n' + '='.repeat(60));
  console.log('📥 NEW TRANSACTION REQUEST');
  console.log('='.repeat(60));
  console.log('📄 Request body:', JSON.stringify(req.body, null, 2));

  const { transactionDetails } = req.body;
  if (!transactionDetails) {
    return res.status(400).send({ error: 'Transaction details are missing.' });
  }

  try {
    // Validate purchase type
    const purchaseType = transactionDetails.purchaseType || 'buy';
    if (!['buy', 'rent'].includes(purchaseType)) {
      return res.status(400).send({ 
        error: 'Invalid purchase type. Must be either "buy" or "rent".' 
      });
    }

    console.log(`\n🏠 Purchase Type: ${purchaseType.toUpperCase()}`);

    // ✅ CHECK: Verify property exists and is available for sale
    const property = await Property.findById(transactionDetails.property.id);
    if (!property) {
      return res.status(404).send({ 
        error: 'Property not found',
        message: 'The property you are trying to purchase does not exist.'
      });
    }

    // ✅ CHECK: If buying, verify property is not already sold
    if (purchaseType === 'buy') {
      if (property.status === 'sold') {
        console.log('❌ Property already sold!');
        return res.status(400).send({ 
          error: 'Property already sold',
          message: 'This property has already been purchased and is no longer available.'
        });
      }

      // Check if property can be sold
      if (!['sale', 'both'].includes(property.status)) {
        console.log('❌ Property not available for sale!');
        return res.status(400).send({ 
          error: 'Property not for sale',
          message: 'This property is only available for rent.'
        });
      }
    }

    // Fetch profile using EMAIL first, then validate phone
    const profile = await getProfileByEmailAndPhone(
      transactionDetails.customerEmail,
      transactionDetails.customerPhone
    );

    // Prepare customer data with profile information
    let customerData = {
      customerName: transactionDetails.customerName,
      customerPhone: transactionDetails.customerPhone,
      customerEmail: transactionDetails.customerEmail || null,
      customerPhoto: null
    };

    if (profile) {
      const profileFullName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim();
      
      customerData = {
        customerName: profileFullName || transactionDetails.customerName,
        customerPhone: profile.phone || transactionDetails.customerPhone,
        customerEmail: profile.email,
        customerPhoto: profile.photo || null
      };
      
      console.log('✅ Using profile data for transaction');
      console.log(`   Name from profile: ${customerData.customerName}`);
      console.log(`   Phone from profile: ${customerData.customerPhone}`);
      console.log(`   Email from profile: ${customerData.customerEmail}`);
      console.log(`   Has photo: ${!!customerData.customerPhoto}`);
    } else {
      console.log('⚠️ No profile found for email, using transaction details only');
      console.log(`   Email searched: ${transactionDetails.customerEmail}`);
    }

    // Generate custom transaction ID
    const sequenceNumber = await getNextSequenceValue('customTransactionId');
    const customId = `TNX#${String(sequenceNumber).padStart(3, '0')}`;

    // Create new transaction with purchase type
    const newTransaction = new Transaction({
      customTransactionId: customId,
      stripePaymentId: transactionDetails.id,
      customerName: customerData.customerName,
      customerPhone: customerData.customerPhone,
      customerEmail: customerData.customerEmail,
      customerPhoto: customerData.customerPhoto,
      amount: transactionDetails.amount,
      purchaseType: purchaseType,
      property: transactionDetails.property.id,
      ownerName: transactionDetails.ownerName,
      paymentMethod: transactionDetails.paymentMethod,
      status: 'Completed',
    });

    await newTransaction.save();
    console.log('\n✅ Transaction saved to DB:', newTransaction.customTransactionId);
    console.log('🏠 Purchase type:', newTransaction.purchaseType);
    console.log('💰 Amount: ₹', newTransaction.amount);
    console.log('📧 Customer email:', newTransaction.customerEmail || 'N/A');
    console.log('📸 Customer photo saved:', !!newTransaction.customerPhoto);

    // ========== MARK PROPERTY AS SOLD IF PURCHASE TYPE IS 'BUY' ==========
    if (purchaseType === 'buy') {
      console.log('\n🔒 MARKING PROPERTY AS SOLD...');
      
      try {
        await property.markAsSold({
          customerName: customerData.customerName,
          transactionId: newTransaction._id
        });
        
        console.log('✅ Property successfully marked as SOLD');
        console.log(`   Property: "${property.name}"`);
        console.log(`   Sold to: ${customerData.customerName}`);
        console.log(`   Transaction ID: ${customId}`);
        console.log(`   Sold Date: ${property.soldDate}`);
        
        // Emit socket event for property sold
        if (req.app && req.app.get('io')) {
          const io = req.app.get('io');
          io.emit('property-sold', {
            propertyId: property._id.toString(),
            propertyName: property.name,
            soldTo: customerData.customerName,
            soldDate: property.soldDate,
            transactionId: customId
          });
          console.log('🔔 Property sold event emitted via socket');
        }
        
      } catch (markSoldError) {
        console.error('❌ Failed to mark property as sold:', markSoldError.message);
        // Don't fail the transaction if this fails, but log it
      }
    }

    // ========== CREATE PENDING REVIEW ENTRY ==========
    try {
      console.log('\n📝 Creating pending review entry...');
      
      // Check if customer already reviewed this property
      const existingReview = await Review.findOne({
        propertyId: transactionDetails.property.id,
        $or: [
          { customerPhone: customerData.customerPhone },
          ...(customerData.customerEmail ? [{ customerEmail: customerData.customerEmail }] : [])
        ]
      });

      if (existingReview) {
        console.log('ℹ️ Customer already reviewed this property, skipping pending review');
      } else {
        // Check if customer already has a pending review for this property
        const existingPendingReview = await PendingReview.findOne({
          propertyId: transactionDetails.property.id,
          customerPhone: customerData.customerPhone,
          status: 'pending'
        });

        if (!existingPendingReview) {
          const pendingReview = new PendingReview({
            propertyId: transactionDetails.property.id,
            transactionId: newTransaction._id,
            customerEmail: customerData.customerEmail,
            customerPhone: customerData.customerPhone,
            customerName: customerData.customerName,
            purchaseType: purchaseType,
            status: 'pending'
          });

          await pendingReview.save();
          console.log('✅ Pending review created successfully');
          console.log(`   Customer: ${customerData.customerName}`);
          console.log(`   Phone: ${customerData.customerPhone}`);
          console.log(`   Property ID: ${transactionDetails.property.id}`);
        } else {
          console.log('ℹ️ Pending review already exists for this customer and property');
        }
      }
    } catch (reviewError) {
      console.error('⚠️ Failed to create pending review:', reviewError.message);
      // Don't fail the transaction if pending review creation fails
    }

    // ========== UPDATE OWNER STATS AFTER TRANSACTION ==========
    const updatedOwner = await updateOwnerStatsAfterTransaction(
      transactionDetails.property.id,
      purchaseType
    );

    if (updatedOwner) {
      console.log(`\n✅ Owner stats successfully updated for: ${updatedOwner.name}`);
    } else {
      console.warn('\n⚠️ Warning: Owner stats could not be updated');
    }

    // Save Notification in DB
    const transactionType = purchaseType === 'rent' ? 'Rental' : 'Purchase';
    const notificationMessage = purchaseType === 'buy' 
      ? `🏠 Property "${property.name}" SOLD! Transaction ${newTransaction.customTransactionId} - ₹${newTransaction.amount} by ${newTransaction.customerName}`
      : `New ${transactionType} transaction ${newTransaction.customTransactionId} - ₹${newTransaction.amount} by ${newTransaction.customerName}`;
    
    const notification = new Notification({
      userId: null,
      type: purchaseType === 'buy' ? 'property_sold' : 'transaction',
      message: notificationMessage,
      relatedId: newTransaction._id,
    });
    await notification.save();

    // Emit Socket.io notification
    if (req.app && req.app.get('io')) {
      emitNotification(req, notification);
      
      // Emit owner stats update event
      if (updatedOwner) {
        const io = req.app.get('io');
        io.emit('update-analytics', {
          type: 'owner-stats-updated',
          ownerId: updatedOwner.ownerId,
          name: updatedOwner.name,
          stats: {
            propertyOwned: updatedOwner.propertyOwned,
            propertyRent: updatedOwner.propertyRent,
            propertySold: updatedOwner.propertySold,
            totalListing: updatedOwner.totalListing
          }
        });
        console.log('🔔 Owner stats update event emitted via socket');
      }
    } else {
      console.warn('⚠️ Socket.io instance not found. Notification not emitted via socket.');
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅✅✅ TRANSACTION COMPLETED SUCCESSFULLY ✅✅✅');
    console.log('='.repeat(60) + '\n');

    res.status(200).send({
      success: true,
      transaction: {
        ...newTransaction.toObject(),
        profileFound: !!profile,
        profileMatchedByEmail: !!profile,
        hasPhoto: !!newTransaction.customerPhoto,
        ownerStatsUpdated: !!updatedOwner,
        propertyMarkedAsSold: purchaseType === 'buy'
      }
    });

  } catch (error) {
    console.error('\n💥 CRITICAL ERROR:', error.message);
    console.error('Stack:', error.stack);
    const errorMessage = error.message || 'Failed to save transaction details.';
    res.status(500).send({ error: errorMessage });
  }
};

// Get all transactions with populated profile data
const getAllTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find()
      .populate('property', 'name type status')
      .sort({ createdAt: -1 });

    // Add hasPhoto flag for frontend
    const enhancedTransactions = transactions.map(t => ({
      ...t.toObject(),
      hasPhoto: !!t.customerPhoto
    }));

    res.status(200).json(enhancedTransactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).send({ error: 'Failed to fetch transactions.' });
  }
};

// Get monthly buyers count (unique customers per month)
const getMonthlyBuyers = async (req, res) => {
  try {
    const year = new Date().getFullYear();

    const monthlyBuyers = await Transaction.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(`${year}-01-01`),
            $lt: new Date(`${year + 1}-01-01`)
          }
        }
      },
      {
        $group: {
          _id: {
            month: { $month: "$createdAt" },
            customerEmail: "$customerEmail"
          }
        }
      },
      {
        $group: {
          _id: "$_id.month",
          uniqueBuyers: { $sum: 1 }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    const buyersByMonth = {};
    monthNames.forEach((m) => (buyersByMonth[m] = 0));

    monthlyBuyers.forEach((entry) => {
      const monthName = monthNames[entry._id - 1];
      buyersByMonth[monthName] = entry.uniqueBuyers;
    });

    console.log('Buyers by month:', buyersByMonth);
    res.status(200).json(buyersByMonth);
  } catch (error) {
    console.error("Error fetching monthly buyers count:", error);
    res.status(500).json({ error: "Failed to fetch buyers count" });
  }
};

// Get all unique customers with purchase type info
const getAllCustomers = async (req, res) => {
  try {
    const customers = await Transaction.aggregate([
      {
        $group: {
          _id: "$customerEmail",
          name: { $first: "$customerName" },
          phone: { $first: "$customerPhone" },
          email: { $first: "$customerEmail" },
          photo: { $first: "$customerPhoto" },
          lastTransaction: { $max: "$createdAt" },
          totalTransactions: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
          purchaseTypes: { $addToSet: "$purchaseType" },
          rentTransactions: { 
            $sum: { $cond: [{ $eq: ["$purchaseType", "rent"] }, 1, 0] } 
          },
          buyTransactions: { 
            $sum: { $cond: [{ $eq: ["$purchaseType", "buy"] }, 1, 0] } 
          },
          lastProperty: { $last: "$property" },
          ownerName: { $last: "$ownerName" }
        }
      },
      {
        $lookup: {
          from: 'properties',
          localField: 'lastProperty',
          foreignField: '_id',
          as: 'propertyInfo'
        }
      },
      {
        $addFields: {
          status: "Active",
          interestedProperties: {
            $ifNull:
              [{ $arrayElemAt: ["$propertyInfo.name", 0] },
                "N/A"
              ]
          },
          proptype: {
            $ifNull:
              [{ $arrayElemAt: ["$propertyInfo.type", 0] },
                "Apartment"
              ]
          },
          averageAmount: { $round: [{ $divide: ["$totalAmount", "$totalTransactions"] }, 0] },
          hasPhoto: { $cond: [{ $ifNull: ["$photo", false] }, true, false] }
        }
      },
      {
        $project: {
          name: 1,
          phone: 1,
          email: 1,
          photo: 1,
          hasPhoto: 1,
          status: 1,
          proptype: 1,
          interestedProperties: 1,
          lastContacted: "$lastTransaction",
          totalTransactions: 1,
          totalAmount: 1,
          averageAmount: 1,
          ownerName: 1,
          purchaseTypes: 1,
          rentTransactions: 1,
          buyTransactions: 1
        }
      },
      {
        $sort: { lastContacted: -1 }
      }
    ]);

    console.log(`✅ Found ${customers.length} unique customers`);
    console.log(`📧 Customers with email: ${customers.filter(c => c.email).length}`);
    console.log(`📸 Customers with photo: ${customers.filter(c => c.hasPhoto).length}`);

    res.status(200).json(customers);

  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: 'Failed to fetch customers.' });
  }
};

// Get customer by phone with purchase type details
const getCustomerByPhone = async (req, res) => {
  try {
    const { phone } = req.params;
    const decodedPhone = decodeURIComponent(phone);

    console.log(`🔍 Fetching customer details for phone: ${decodedPhone}`);

    const customerTransactions = await Transaction.find({
      customerPhone: decodedPhone
    })
      .populate('property', 'name type location')
      .sort({ createdAt: -1 });

    if (customerTransactions.length === 0) {
      console.log(`❌ No transactions found for phone: ${decodedPhone}`);
      return res.status(404).json({ error: 'Customer not found' });
    }

    const latestTransaction = customerTransactions[0];
    const totalTransactions = customerTransactions.length;
    const totalAmount = customerTransactions.reduce((sum, t) => sum + t.amount, 0);
    
    const rentTransactions = customerTransactions.filter(t => t.purchaseType === 'rent');
    const buyTransactions = customerTransactions.filter(t => t.purchaseType === 'buy');
    const rentAmount = rentTransactions.reduce((sum, t) => sum + t.amount, 0);
    const buyAmount = buyTransactions.reduce((sum, t) => sum + t.amount, 0);
    
    const propertyTypes = [...new Set(customerTransactions
      .map(t => t.property?.type)
      .filter(Boolean)
    )];

    const uniqueProperties = [...new Set(customerTransactions
      .map(t => t.property?.name)
      .filter(Boolean)
    )];

    const monthlyTransactions = customerTransactions.reduce((acc, transaction) => {
      const month = new Date(transaction.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      acc[month] = (acc[month] || 0) + 1;
      return acc;
    }, {});

    const customerData = {
      name: latestTransaction.customerName,
      phone: decodedPhone,
      email: latestTransaction.customerEmail || 'N/A',
      photo: latestTransaction.customerPhoto || null,
      hasPhoto: !!latestTransaction.customerPhoto,
      status: 'Active',
      address: latestTransaction.property?.location || 'N/A',
      totalTransactions,
      totalAmount,
      averageAmount: Math.round(totalAmount / totalTransactions),
      purchaseTypeStats: {
        rentCount: rentTransactions.length,
        buyCount: buyTransactions.length,
        rentAmount,
        buyAmount,
        preferredType: rentTransactions.length > buyTransactions.length ? 'rent' : 'buy'
      },
      propertyTypes,
      uniqueProperties,
      monthlyTransactions,
      lastTransactionDate: latestTransaction.createdAt,
      ownerName: latestTransaction.ownerName,
      preferences: {
        line1: propertyTypes.length > 0 ? propertyTypes.join(', ') : '3-4 bedrooms, 2-3 bathrooms',
        line2: 'Close to public transportation, good school district, backyard, modern kitchen'
      },
      transactions: customerTransactions.slice(0, 10)
    };

    console.log(`✅ Customer data prepared for: ${customerData.name}`);
    console.log(`📧 Email: ${customerData.email}`);
    console.log(`📸 Has photo: ${customerData.hasPhoto}`);
    console.log(`🏠 Rent: ${rentTransactions.length}, Buy: ${buyTransactions.length}`);

    res.status(200).json(customerData);

  } catch (error) {
    console.error('Error fetching customer details:', error);
    res.status(500).json({ error: 'Failed to fetch customer details.' });
  }
};

// Delete customer and recalculate owner stats
const deleteCustomer = async (req, res) => {
  try {
    const { phone } = req.params;
    const decodedPhone = decodeURIComponent(phone);

    console.log(`🗑️ Attempting to delete customer with phone: ${decodedPhone}`);

    const customerTransactions = await Transaction.find({
      customerPhone: decodedPhone
    }).populate('property');

    if (customerTransactions.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const customerName = customerTransactions[0].customerName;
    const transactionCount = customerTransactions.length;

    // Get unique owner IDs affected by this deletion
    const affectedOwnerIds = [...new Set(
      customerTransactions
        .map(t => t.property?.ownerId)
        .filter(Boolean)
    )];

    console.log(`🔄 Will recalculate stats for ${affectedOwnerIds.length} owners`);

    const deleteResult = await Transaction.deleteMany({
      customerPhone: decodedPhone
    });

    console.log(`✅ Deleted ${deleteResult.deletedCount} transactions for customer: ${customerName}`);

    // Recalculate stats for all affected owners
    for (const ownerId of affectedOwnerIds) {
      await updateOwnerStatsAfterTransaction(null, null, ownerId);
    }

    const notification = new Notification({
      userId: null,
      type: 'customer_deletion',
      message: `Customer ${customerName} and ${transactionCount} transactions deleted`,
      relatedId: null,
    });
    await notification.save();

    if (req.app && req.app.get('io')) {
      emitNotification(req, notification);
    }

    res.status(200).json({
      success: true,
      message: `Successfully deleted customer ${customerName} and ${deleteResult.deletedCount} associated transactions`,
      deletedCount: deleteResult.deletedCount,
      affectedOwners: affectedOwnerIds.length
    });

  } catch (error) {
    console.error('Error deleting customer:', error);
    res.status(500).json({ error: 'Failed to delete customer.' });
  }
};

const getCustomerStats = async (req, res) => {
  try {
    const { phone } = req.params;
    const decodedPhone = decodeURIComponent(phone);

    const stats = await Transaction.aggregate([
      { $match: { customerPhone: decodedPhone } },
      {
        $group: {
          _id: null,
          totalTransactions: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
          averageAmount: { $avg: "$amount" },
          maxAmount: { $max: "$amount" },
          minAmount: { $min: "$amount" },
          firstTransaction: { $min: "$createdAt" },
          lastTransaction: { $max: "$createdAt" },
          rentCount: { 
            $sum: { $cond: [{ $eq: ["$purchaseType", "rent"] }, 1, 0] } 
          },
          buyCount: { 
            $sum: { $cond: [{ $eq: ["$purchaseType", "buy"] }, 1, 0] } 
          },
          rentAmount: {
            $sum: { $cond: [{ $eq: ["$purchaseType", "rent"] }, "$amount", 0] }
          },
          buyAmount: {
            $sum: { $cond: [{ $eq: ["$purchaseType", "buy"] }, "$amount", 0] }
          }
        }
      },
      {
        $project: {
          _id: 0,
          totalTransactions: 1,
          totalAmount: 1,
          averageAmount: { $round: ["$averageAmount", 2] },
          maxAmount: 1,
          minAmount: 1,
          firstTransaction: 1,
          lastTransaction: 1,
          customerLifetime: {
            $dateDiff: {
              startDate: "$firstTransaction",
              endDate: "$lastTransaction",
              unit: "day"
            }
          },
          rentCount: 1,
          buyCount: 1,
          rentAmount: 1,
          buyAmount: 1
        }
      }
    ]);

    if (stats.length === 0) {
      return res.status(404).json({ error: 'Customer statistics not found' });
    }

    res.status(200).json(stats[0]);

  } catch (error) {
    console.error('Error fetching customer statistics:', error);
    res.status(500).json({ error: 'Failed to fetch customer statistics.' });
  }
};

// Delete transaction and recalculate owner stats
const deleteTransaction = async (req, res) => {
  try {
    const { transactionId } = req.params;
    console.log(`🗑️ Attempting to delete transaction with ID: "${transactionId}"`);

    if (!transactionId) {
      console.error('❌ Error: transactionId is undefined or empty.');
      return res.status(400).json({
        success: false,
        message: 'Transaction ID is required for deletion.'
      });
    }

    const transaction = await Transaction.findOne({ customTransactionId: transactionId })
                                       .populate('property', 'name ownerId');

    if (!transaction) {
      console.log(`❌ Transaction not found with customTransactionId: "${transactionId}"`);
      return res.status(404).json({
        success: false,
        message: 'Transaction not found or already deleted.'
      });
    }

    const propertyOwnerId = transaction.property?.ownerId;

    await Transaction.deleteOne({ customTransactionId: transactionId });

    console.log(`✅ Transaction successfully deleted: "${transaction.customTransactionId}"`);

    // Recalculate owner stats after transaction deletion
    if (propertyOwnerId) {
      console.log(`🔄 Recalculating stats for owner ID: ${propertyOwnerId}`);
      const owner = await Owner.findOne({ ownerId: propertyOwnerId });
      if (owner) {
        const numericOwnerId = parseInt(owner.ownerId);
        
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

        owner.propertyRent = rentProperties;
        owner.propertySold = saleProperties;
        owner.propertyOwned = totalProperties;
        owner.totalListing = rentProperties + saleProperties;

        await owner.save();
        console.log(`✅ Owner stats recalculated for: ${owner.name}`);
      }
    }

    const notification = new Notification({
      userId: null,
      type: 'transaction_deletion',
      message: `Transaction "${transaction.customTransactionId}" (${transaction.property?.name || 'N/A'}) - ₹${transaction.amount} by ${transaction.customerName} was deleted.`,
      relatedId: transaction._id,
    });
    await notification.save();

    if (req.app && req.app.get('io')) {
      emitNotification(req, notification);
    }

    res.status(200).json({
      success: true,
      message: 'Transaction deleted successfully',
      data: {
        transactionId: transaction.customTransactionId,
        customerName: transaction.customerName,
        amount: transaction.amount,
        propertyName: transaction.property?.name || 'N/A'
      }
    });

  } catch (error) {
    console.error(`❌ Error deleting transaction: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting transaction',
      error: error.message
    });
  }
};

module.exports = {
  createPaymentIntent,
  saveTransaction,
  getAllTransactions,
  deleteTransaction,
  getMonthlyBuyers,
  getAllCustomers,
  getCustomerByPhone,
  deleteCustomer,
  getCustomerStats
};