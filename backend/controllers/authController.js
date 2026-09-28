// ════════════════════════════════════════════════════════════════
// controllers/authController.js — Register & Login Logic
// ════════════════════════════════════════════════════════════════
//
// POST /api/auth/register  — create a new account
// POST /api/auth/login     — authenticate and get a JWT
//
// Security:
//   - Passwords are hashed with bcryptjs (never stored as plain text)
//   - A JWT is issued on success (signed with JWT_SECRET from .env)
// ════════════════════════════════════════════════════════════════

const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const db     = require('../config/db');

// Helper — sign a JWT for a user
function signToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// ── POST /api/auth/register ───────────────────────────────────
// Body: { name, email, password }
// Returns: { token, user: { id, name, email } }
const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    // Check if email is already registered
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
    if (existing) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    // Hash the password (10 rounds)
    const password_hash = await bcrypt.hash(password, 10);

    // Insert the new user
    const info = db.prepare(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)'
    ).run(name.trim(), email.toLowerCase().trim(), password_hash);

    const user  = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(info.lastInsertRowid);
    const token = signToken(user);

    res.status(201).json({ success: true, message: 'Account created successfully.', token, user });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ message: 'Server error during registration.' });
  }
};

// ── POST /api/auth/login ──────────────────────────────────────
// Body: { email, password }
// Returns: { token, user: { id, name, email } }
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const safeUser = { id: user.id, name: user.name, email: user.email };
    const token    = signToken(safeUser);

    res.status(200).json({ success: true, message: 'Login successful.', token, user: safeUser });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ message: 'Server error during login.' });
  }
};

module.exports = { register, login };
