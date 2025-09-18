const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

dotenv.config();

const app = express();
const server = http.createServer(app); // ✅ Wrap express in http server

// ✅ CORS configuration - Just add mobile support
app.use(cors({
  origin: [
    "http://localhost:5173",      // existing web frontend
    "http://192.168.0.152:8081",  // mobile app access
    "exp://192.168.0.152:8081"    // expo development
  ],
  credentials: true
}));

// ✅ Increase limit for image uploads
app.use(bodyParser.json({ limit: "50mb" })); // increased from 10mb for images
app.use(bodyParser.urlencoded({ extended: true }));

// ✅ Initialize Socket.IO with mobile support
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "http://192.168.0.152:8081",
      "exp://192.168.0.152:8081"
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  }
});

// ✅ Attach io to app (so routes can use it if needed)
app.set("io", io);

// Static file serving - Just add profiles folder
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use('/uploads/profiles', express.static(path.join(__dirname, 'uploads', 'profiles')));
app.use('/uploads/owners', express.static(path.join(__dirname, 'src', 'uploads', 'owners')));
app.use('/uploads/properties', express.static(path.join(__dirname, 'src', 'uploads', 'properties')));

// MongoDB Connection 
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected successfully'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// Routes - Keep your existing structure
app.use('/api', require('./src/routes/auth'));
app.use('/api/property', require('./src/routes/property'));
app.use('/api/owners', require('./src/routes/ownerRoutes'));
app.use('/api/payment', require('./src/routes/transactionRoutes')); 
app.use('/api/reviews', require('./src/routes/reviews'));
app.use('/api/stats', require('./src/routes/stats'));
app.use('/api/sales', require('./src/routes/sales'));  
app.use('/api/notifications', require('./src/routes/notification'));

// ✅ Profile route - Change to match frontend expectation
app.use('/api/profiles', require('./src/routes/profileRoutes'));

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {   
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Mobile access: http://192.168.0.152:${PORT}`);
});