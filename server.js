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

// ✅ Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Mobile access: http://192.168.0.152:${PORT}`);
});
