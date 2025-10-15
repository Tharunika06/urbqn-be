// createAdmin.js - Run this once to create your first admin
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('./models/User');

async function createAdmin() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Admin details
    const adminEmail = 'tharunika106"gmail.com'; // Change this
    const adminPassword = 'Tharunika234'; // Change this
    const adminFirstName = 'Admin';
    const adminLastName = 'User';

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: adminEmail });
    if (existingAdmin) {
      console.log('❌ Admin user already exists');
      process.exit(0);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    // Create admin user
    const admin = new User({
      email: adminEmail,
      password: hashedPassword,
      firstName: adminFirstName,
      lastName: adminLastName,
      role: 'admin',
      isVerified: true
    });

    await admin.save();

    console.log('✅ Admin user created successfully!');
    console.log(`Email: ${adminEmail}`);
    console.log(`Password: ${adminPassword}`);
    console.log('⚠️ Please change the password after first login!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin:', error);
    process.exit(1);
  }
}

createAdmin();