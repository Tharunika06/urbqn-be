const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');
const Counter = require('../models/Counter');
const { emitNotification } = require('../utils/socketUtils');

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

// Save transaction details
const saveTransaction = async (req, res) => {
  console.log('Received /save-transaction request with body:', JSON.stringify(req.body, null, 2));

  const { transactionDetails } = req.body;
  if (!transactionDetails) {
    return res.status(400).send({ error: 'Transaction details are missing.' });
  }

  try {
    const sequenceNumber = await getNextSequenceValue('customTransactionId');
    const customId = `TNX#${String(sequenceNumber).padStart(3, '0')}`;

    const newTransaction = new Transaction({
      customTransactionId: customId,
      stripePaymentId: transactionDetails.id,
      customerName: transactionDetails.customerName,
      customerPhone: transactionDetails.customerPhone,
      amount: transactionDetails.amount,
      property: transactionDetails.property.id,
      ownerName: transactionDetails.ownerName,
      paymentMethod: transactionDetails.paymentMethod,
      status: 'Completed',
    });

    await newTransaction.save();
    console.log('Transaction saved to DB:', newTransaction.customTransactionId);

    // Save Notification in DB
    const notification = new Notification({
      userId: null, // or transactionDetails.userId if available
      type: 'transaction',
      message: `New transaction ${newTransaction.customTransactionId} - ₹${newTransaction.amount} by ${newTransaction.customerName}`,
      relatedId: newTransaction._id,
    });
    await notification.save();

    // Emit Socket.io notification
    emitNotification(req, notification);

    res.status(200).send({ success: true, transaction: newTransaction });

  } catch (error) {
    console.error('An error occurred while saving the transaction:', error);
    const errorMessage = error.message || 'Failed to save transaction details.';
    res.status(500).send({ error: errorMessage });
  }
};

// Get all transactions
const getAllTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find()
      .populate('property', 'name type')
      .sort({ createdAt: -1 });
    res.status(200).json(transactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).send({ error: 'Failed to fetch transactions.' });
  }
};

// Get monthly buyers count
const getMonthlyBuyers = async (req, res) => {
  try {
    const monthlyCounts = await Transaction.aggregate([
      {
        $group: {
          _id: { $month: "$createdAt" },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id": 1 } },
    ]);

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    const buyersByMonth = {};
    monthNames.forEach((m) => (buyersByMonth[m] = 0));

    monthlyCounts.forEach((entry) => {
      const monthName = monthNames[entry._id - 1];
      buyersByMonth[monthName] = entry.count;
    });

    res.status(200).json(buyersByMonth);
  } catch (error) {
    console.error("Error fetching monthly buyers count:", error);
    res.status(500).json({ error: "Failed to fetch buyers count" });
  }
};

// Get all unique customers
const getAllCustomers = async (req, res) => {
  try {
    const customers = await Transaction.aggregate([
      {
        $group: {
          _id: "$customerPhone",
          name: { $first: "$customerName" },
          phone: { $first: "$customerPhone" },
          lastTransaction: { $max: "$createdAt" },
          totalTransactions: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
          lastProperty: { $last: "$property" },
          ownerName: { $last: "$ownerName" }
        }
      },
      {
        $lookup: {
          from: 'properties', // Make sure this matches your property collection name
          localField: 'lastProperty',
          foreignField: '_id',
          as: 'propertyInfo'
        }
      },
      {
        $addFields: {
          email: { 
            $concat: [ 
              { $toLower: { $replaceAll: { input: "$name", find: " ", replacement: "." } } }, 
              "@example.com" 
            ] 
          },
          status: "Active",
          interestedProperties: { 
            $ifNull: [ 
              { $arrayElemAt: ["$propertyInfo.name", 0] }, 
              "N/A" 
            ] 
          },
          proptype: { 
            $ifNull: [ 
              { $arrayElemAt: ["$propertyInfo.type", 0] }, 
              "Apartment" 
            ] 
          },
          averageAmount: { $round: [{ $divide: ["$totalAmount", "$totalTransactions"] }, 0] }
        }
      },
      {
        $project: {
          name: 1,
          phone: 1,
          email: 1,
          status: 1,
          proptype: 1,
          interestedProperties: 1,
          lastContacted: "$lastTransaction",
          totalTransactions: 1,
          totalAmount: 1,
          averageAmount: 1,
          ownerName: 1,
          photo: null // Will be handled by frontend with placeholder
        }
      },
      {
        $sort: { lastContacted: -1 }
      }
    ]);
    
    console.log(`Found ${customers.length} unique customers`);
    res.status(200).json(customers);
    
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: 'Failed to fetch customers.' });
  }
};

// Get customer details by phone
const getCustomerByPhone = async (req, res) => {
  try {
    const { phone } = req.params;
    const decodedPhone = decodeURIComponent(phone);
    
    console.log(`Fetching customer details for phone: ${decodedPhone}`);
    
    // Find all transactions for this customer
    const customerTransactions = await Transaction.find({ 
      customerPhone: decodedPhone 
    })
    .populate('property', 'name type location')
    .sort({ createdAt: -1 });
    
    if (customerTransactions.length === 0) {
      console.log(`No transactions found for phone: ${decodedPhone}`);
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    // Get the most recent transaction for primary customer info
    const latestTransaction = customerTransactions[0];
    
    // Calculate customer statistics
    const totalTransactions = customerTransactions.length;
    const totalAmount = customerTransactions.reduce((sum, t) => sum + t.amount, 0);
    const propertyTypes = [...new Set(customerTransactions
      .map(t => t.property?.type)
      .filter(Boolean)
    )];
    
    // Get unique properties the customer has transacted for
    const uniqueProperties = [...new Set(customerTransactions
      .map(t => t.property?.name)
      .filter(Boolean)
    )];
    
    // Calculate monthly transaction pattern
    const monthlyTransactions = customerTransactions.reduce((acc, transaction) => {
      const month = new Date(transaction.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      acc[month] = (acc[month] || 0) + 1;
      return acc;
    }, {});
    
    // Build customer response
    const customerData = {
      name: latestTransaction.customerName,
      phone: decodedPhone,
      email: latestTransaction.customerName.toLowerCase().replace(/\s+/g, '.') + '@example.com',
      status: 'Active',
      address: latestTransaction.property?.location || 'Schoolstraat 161 5151 HH Drunen',
      totalTransactions,
      totalAmount,
      averageAmount: Math.round(totalAmount / totalTransactions),
      propertyTypes,
      uniqueProperties,
      monthlyTransactions,
      lastTransactionDate: latestTransaction.createdAt,
      ownerName: latestTransaction.ownerName,
      preferences: {
        line1: propertyTypes.length > 0 ? propertyTypes.join(', ') : '3-4 bedrooms, 2-3 bathrooms',
        line2: 'Close to public transportation, good school district, backyard, modern kitchen'
      },
      transactions: customerTransactions.slice(0, 10) // Return latest 10 transactions
    };
    
    console.log(`Customer data prepared for: ${customerData.name}`);
    res.status(200).json(customerData);
    
  } catch (error) {
    console.error('Error fetching customer details:', error);
    res.status(500).json({ error: 'Failed to fetch customer details.' });
  }
};

// Delete customer (removes all their transactions)
const deleteCustomer = async (req, res) => {
  try {
    const { phone } = req.params;
    const decodedPhone = decodeURIComponent(phone);
    
    console.log(`Attempting to delete customer with phone: ${decodedPhone}`);
    
    // Find all transactions for this customer first
    const customerTransactions = await Transaction.find({ 
      customerPhone: decodedPhone 
    });
    
    if (customerTransactions.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    const customerName = customerTransactions[0].customerName;
    const transactionCount = customerTransactions.length;
    
    // Delete all transactions for this customer
    const deleteResult = await Transaction.deleteMany({ 
      customerPhone: decodedPhone 
    });
    
    console.log(`Deleted ${deleteResult.deletedCount} transactions for customer: ${customerName}`);
    
    // Create notification for deletion
    const notification = new Notification({
      userId: null,
      type: 'customer_deletion',
      message: `Customer ${customerName} and ${transactionCount} transactions deleted`,
      relatedId: null,
    });
    await notification.save();
    
    // Emit Socket.io notification
    emitNotification(req, notification);
    
    res.status(200).json({ 
      success: true, 
      message: `Successfully deleted customer ${customerName} and ${deleteResult.deletedCount} associated transactions`,
      deletedCount: deleteResult.deletedCount
    });
    
  } catch (error) {
    console.error('Error deleting customer:', error);
    res.status(500).json({ error: 'Failed to delete customer.' });
  }
};

// Get customer transaction statistics
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
          lastTransaction: { $max: "$createdAt" }
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
          }
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

module.exports = {
  createPaymentIntent,
  saveTransaction,
  getAllTransactions,
  getMonthlyBuyers,
  getAllCustomers,
  getCustomerByPhone,
  deleteCustomer,
  getCustomerStats
};