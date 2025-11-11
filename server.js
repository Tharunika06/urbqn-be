require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser'); // ✅ ADD THIS
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const listEndpoints = require('express-list-endpoints');

const app = express();
const server = http.createServer(app);

// ✅ Load allowed origins from .env
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : ['http://localhost:3000'];

// ✅ CORS configuration - UPDATED for cookies
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('⚠️ CORS blocked origin:', origin);
      callback(null, true); // Allow all in development, restrict in production
    }
  },
  credentials: true, // ✅ CRITICAL: Enable credentials (cookies)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['set-cookie']
}));

// ✅ Trust proxy (important for cookies behind reverse proxy/load balancer)
app.set('trust proxy', 1);

// ✅ Cookie parser middleware - ADD THIS BEFORE body parser
app.use(cookieParser());

// ✅ Body parser middleware (increase limit for image uploads)
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));

// ✅ Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ✅ DEBUG MIDDLEWARE (only in development)
if (process.env.NODE_ENV === 'development') {
  const debugMiddleware = (req, res, next) => {
    if (req.path.includes('/favorites') || req.path.includes('/admin')) {
      console.log('\n=== REQUEST DEBUG ===');
      console.log('Method:', req.method);
      console.log('Path:', req.path);
      console.log('Original URL:', req.originalUrl);
      console.log('Params:', JSON.stringify(req.params, null, 2));
      console.log('Body:', JSON.stringify(req.body, null, 2));
      console.log('Query:', JSON.stringify(req.query, null, 2));
      console.log('Authorization:', req.headers.authorization ? 'Present' : 'Missing');
      console.log('Cookies:', req.cookies.authToken ? 'Cookie Present' : 'No Cookie'); // ✅ ADD THIS
      console.log('====================\n');
    }
    next();
  };
  app.use(debugMiddleware);
}

// ✅ Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true
  }
});

// ✅ Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('✅ Client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('❌ Client disconnected:', socket.id);
  });
});

// ✅ Attach io to app (so routes can use it)
app.set("io", io);

// ✅ Static file serving
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/uploads/profiles", express.static(path.join(__dirname, "uploads", "profiles")));
app.use("/uploads/owners", express.static(path.join(__dirname, "uploads", "owners")));
app.use("/uploads/properties", express.static(path.join(__dirname, "uploads", "properties")));

// ✅ MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('✅ MongoDB connected successfully'))
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// ✅ Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    cookieSupport: req.cookies ? 'Enabled' : 'Disabled' // ✅ ADD THIS
  });
});

// ✅ Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Urban Properties API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      api: '/api',
      docs: '/api-docs'
    }
  });
});

// ✅ Import and use routes
const routes = require('./src/routes');
app.use('/api', routes);

// ✅ List all registered endpoints (only in development)
if (process.env.NODE_ENV === 'development') {
  console.log("\n📋 Registered Endpoints:");
  const endpoints = listEndpoints(app);
  endpoints.forEach(endpoint => {
    console.log(`${endpoint.methods.join(',')} ${endpoint.path}`);
  });
  console.log('');
}

// ✅ Error handling middleware
app.use((error, req, res, next) => {
  console.error('❌ Global error handler:', error);
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { 
      stack: error.stack,
      details: error 
    })
  });
});

// ✅ 404 handler (must be last)
app.use((req, res) => {
  console.log('⚠️ 404 - Route not found:', req.method, req.path);
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path,
    method: req.method
  });
});

// ✅ Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n⚠️ Shutting down gracefully...');
  server.close(() => {
    console.log('✅ HTTP server closed');
  });
  await mongoose.connection.close();
  console.log('✅ MongoDB connection closed');
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// ✅ Start server
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Local: http://localhost:${PORT}`);
  console.log(`📱 Network: http://localhost:${PORT}`);
  console.log(`🍪 Cookie support: Enabled`); // ✅ ADD THIS
  console.log('');
});