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
const server = http.createServer(app);

// ✅ Load allowed origins from .env
const allowedOrigins = process.env.ALLOWED_ORIGINS.split(',');

// ✅ CORS configuration
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

// ✅ Increase limit for image uploads
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ extended: true }));

// ✅ DEBUG MIDDLEWARE - Add this section
const debugMiddleware = (req, res, next) => {
  if (req.path.includes('/favorites')) {
    console.log('\n=== FAVORITES REQUEST DEBUG ===');
    console.log('Method:', req.method);
    console.log('Path:', req.path);
    console.log('Original URL:', req.originalUrl);
    console.log('Params:', JSON.stringify(req.params, null, 2));
    console.log('Body:', JSON.stringify(req.body, null, 2));
    console.log('Query:', JSON.stringify(req.query, null, 2));
    console.log('Headers Content-Type:', req.get('Content-Type'));
    console.log('Body type:', typeof req.body);
    console.log('Body keys:', req.body ? Object.keys(req.body) : 'No body');
    console.log('================================\n');
  }
  next();
};

// Apply debug middleware BEFORE routes
app.use(debugMiddleware);

// ✅ Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  }
});

// ✅ Attach io to app (so routes can use it if needed)
app.set("io", io);

// ✅ Static file serving
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/uploads/profiles", express.static(path.join(__dirname, "uploads", "profiles")));
app.use("/uploads/owners", express.static(path.join(__dirname, "uploads", "owners")));
app.use("/uploads/properties", express.static(path.join(__dirname, "uploads", "properties")));

// ✅ MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected successfully'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// ✅ Import routes from routes/index.js
const routes = require('./src/routes');
app.use('/api', routes);

// ✅ Error handling middleware (optional but recommended)
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// ✅ 404 handler
app.use((req, res) => {
  console.log('404 - Route not found:', req.method, req.path);
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path
  });
});

// ✅ Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Mobile access: http://192.168.0.152:${PORT}`);
});