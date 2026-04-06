// src/routes/auth.js
const express = require('express');
const { body } = require('express-validator');
const { register, login, getMe, listUsers } = require('../controllers/authController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Validation rules
const registerRules = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
];

const loginRules = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
];

router.post('/register', registerRules, register);
router.post('/login', loginRules, login);
router.get('/me', authenticate, getMe);
router.get('/users', authenticate, authorize('admin'), listUsers);

module.exports = router;
