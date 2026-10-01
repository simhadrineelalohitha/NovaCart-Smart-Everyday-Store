// ════════════════════════════════════════════════════════════════
// server.js — NovaCart Express Application Entry Point
// This is the main file that starts the entire backend server.
// ════════════════════════════════════════════════════════════════

const express = require('express');
const cors    = require('cors');
const dotenv  = require('dotenv');
const path    = require('path');

// Load environment variables from .env file FIRST, before anything else
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '.env') });

const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';
const jwtSecret = typeof process.env.JWT_SECRET === 'string' ? process.env.JWT_SECRET.trim() : '';
if (!jwtSecret) {
  throw new Error('JWT_SECRET is required for authentication.');
}
if (isProduction && (jwtSecret.length < 32 || jwtSecret === 'replace_this_with_a_long_random_secret_string')) {
  throw new Error('Production JWT_SECRET must be a unique random value with at least 32 characters.');
}
process.env.JWT_SECRET = jwtSecret;

// ── Import route modules ──────────────────────────────────────
const authRoutes    = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const cartRoutes    = require('./routes/cartRoutes');
const orderRoutes   = require('./routes/orderRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');
const compareRoutes  = require('./routes/compareRoutes');

// Create the Express application
const app  = express();

// ── Connect to the database ───────────────────────────────────
const db = require('./config/db');

// ── Global Middleware ─────────────────────────────────────────
// These run on EVERY incoming request, in order.

// 1. Parse JSON request bodies  (e.g. { "email": "a@b.com" })
app.use(express.json());

// 2. Parse URL-encoded form data (traditional HTML form submissions)
app.use(express.urlencoded({ extended: true }));

// 3. CORS — allows the frontend (on port 3000 or via file://) to call this server
app.use(cors({
  origin: isProduction
    ? [process.env.FRONTEND_URL].filter(Boolean)
    : [process.env.FRONTEND_URL || 'http://localhost:3000', 'null'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));

// 4. Request logging is useful locally but too noisy for production asset traffic.
if (!isProduction) {
  app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    next();
  });
}

// ── Health Check Route ────────────────────────────────────────
// The very first route — always available, no auth required.
// Test it with: GET http://localhost:5000/api/health
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status:    'OK',
    message:   'NovaCart API is running 🚀',
    timestamp: new Date().toISOString(),
    version:   '1.0.0',
  });
});

// ── API Routes ────────────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart',     cartRoutes);
app.use('/api/orders',   orderRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/compare',  compareRoutes);

// Serve the frontend from this server so the app has one local URL.
app.get('/', (_req, res) => res.redirect('/pages/index.html'));
app.use(express.static(path.join(__dirname, '../frontend')));

// ── 404 Handler ───────────────────────────────────────────────
// If no route above matched, send a friendly 404 response.
app.use((req, res) => {
  res.status(404).json({
    error:   'Not Found',
    message: `The route ${req.method} ${req.originalUrl} does not exist.`,
  });
});

// ── Global Error Handler ──────────────────────────────────────
// Express calls this automatically when a route throws an error.
// IMPORTANT: It must have exactly 4 parameters (err, req, res, next).
app.use((err, req, res, next) => {
  console.error('❌ Unhandled Error:', err.stack);
  res.status(err.status || 500).json({
    error:   'Internal Server Error',
    message: isProduction ? 'Something went wrong on the server.' : (err.message || 'Something went wrong on the server.'),
  });
});

async function startServer() {
  await db.ensureSchema();
  await db.testConnection();
  console.log(`Database connection ready (${db.isPostgres ? 'PostgreSQL' : 'SQLite'}).`);

  return app.listen(PORT, () => {
    console.log(`NovaCart API listening on port ${PORT}.`);
  });
}

if (require.main === module) {
  startServer().catch(error => {
    console.error(`NovaCart startup failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = app;
module.exports.startServer = startServer;
