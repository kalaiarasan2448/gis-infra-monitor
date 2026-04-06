// src/middleware/errorHandler.js
// Centralized error handling middleware

const errorHandler = (err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}:`, err.message);

  // PostgreSQL errors
  if (err.code === '23505') {
    return res.status(409).json({ success: false, message: 'A record with that value already exists.' });
  }
  if (err.code === '23503') {
    return res.status(400).json({ success: false, message: 'Referenced record does not exist.' });
  }
  if (err.code === '22P02') {
    return res.status(400).json({ success: false, message: 'Invalid UUID format.' });
  }

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, message: 'File too large. Maximum 10MB per file.' });
  }
  if (err.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({ success: false, message: 'Too many files. Maximum 10 images.' });
  }

  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred.' : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
};

// Wrapper to catch async errors without try/catch in every controller
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { errorHandler, asyncHandler };
