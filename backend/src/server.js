// src/server.js
// Main Express application entry point

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const { progressRouter, aiRouter } = require('./routes/index');

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================================
// SECURITY MIDDLEWARE
// ============================================================

// Helmet sets secure HTTP headers
app.use(helmet());

// CORS: allow frontend origins
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:5173',   // Vite dev server
    'https://your-app.vercel.app'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting: max 100 requests per 15 min per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many requests, please try again later.' }
});

// Stricter rate limit for auth endpoints (prevent brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts.' }
});

app.use('/api/', limiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// ============================================================
// BODY PARSING
// ============================================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================================
// LOGGING
// ============================================================
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// ============================================================
// STATIC FILES (uploaded images)
// ============================================================
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ============================================================
// API ROUTES
// ============================================================
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/progress', progressRouter);
app.use('/api/ai', aiRouter);

// ============================================================
// HEALTH CHECK
// ============================================================
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'GIS Infrastructure API',
    version: '1.0.0'
  });
});

// ============================================================
// 404 HANDLER
// ============================================================
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found.` });
});

// ============================================================
// GLOBAL ERROR HANDLER
// ============================================================
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack);

  // Multer file size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, message: 'File too large. Max 10MB.' });
  }

  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error.' : err.message
  });
});

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════════╗
  ║  GIS Infrastructure API                      ║
  ║  Running on http://localhost:${PORT}            ║
  ║  Environment: ${process.env.NODE_ENV || 'development'}               ║
  ╚══════════════════════════════════════════════╝
  `);
});

module.exports = app; // for testing
