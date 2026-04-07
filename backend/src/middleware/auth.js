// src/middleware/auth.js
// JWT authentication + role-based authorization middleware

const jwt = require('jsonwebtoken');
const db = require('../config/database');

// -------------------------------------------------------
// authenticate: Verifies the Bearer JWT token in headers
// Attaches decoded user payload to req.user
// -------------------------------------------------------
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const token = authHeader.split(' ')[1];

    // Verify and decode the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "change_this_to_a_long_random_secret_in_production_min_32_chars");

    // Fetch fresh user data (in case role/status changed)
    const result = await db.query(
      'SELECT id, name, email, role, is_active FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'User not found.' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'Account is deactivated.' });
    }

    // Attach user to request for use in controllers
    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired.' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token.' });
  }
};

// -------------------------------------------------------
// authorize: Role-based access control
// Usage: authorize('admin') or authorize('admin', 'engineer')
// -------------------------------------------------------
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated.' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(' or ')}`
      });
    }

    next();
  };
};

module.exports = { authenticate, authorize };
