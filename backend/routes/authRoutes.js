// ════════════════════════════════════════════════════════════════
// routes/authRoutes.js — Authentication Routes
// Handles: POST /api/auth/register  and  POST /api/auth/login
// ════════════════════════════════════════════════════════════════
const express        = require('express');
const router         = express.Router();
const authController = require('../controllers/authController');

// Register a new user account
router.post('/register', authController.register);

// Log in with email and password, receive a JWT
router.post('/login', authController.login);

// Google OAuth 2.0 login
router.get('/google', authController.googleStart);
router.get('/google/callback', authController.googleCallback);

module.exports = router;
