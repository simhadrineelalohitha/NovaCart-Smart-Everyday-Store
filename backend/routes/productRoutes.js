// ════════════════════════════════════════════════════════════════
// routes/productRoutes.js — Product API Routes
// Base path: /api/products   (mounted in server.js)
// ════════════════════════════════════════════════════════════════
//
// Public routes (no login required):
//   GET  /api/products          → list all (filter with ?category=)
//   GET  /api/products/:id      → single product
//
// Admin routes (require a valid admin user):
//   POST   /api/products        → create product
//   PUT    /api/products/:id    → update product
//   DELETE /api/products/:id    → delete product
// ════════════════════════════════════════════════════════════════

const express           = require('express');
const router            = express.Router();
const productController = require('../controllers/productController');
const { authenticate, requireAdmin }  = require('../middleware/authMiddleware');

// ── Public routes ─────────────────────────────────────────────

// GET /api/products
// GET /api/products?category=Electronics
router.get('/categories', productController.getProductCategories);
router.get('/', productController.getAllProducts);

// Product ratings and written reviews
router.get('/:id/reviews', productController.getProductReviews);
router.post('/:id/reviews', authenticate, productController.createProductReview);

// GET /api/products/12
router.get('/:id', productController.getProductById);

// ── Admin routes ──────────────────────────────────────────────

// POST /api/products
router.post('/', authenticate, requireAdmin, productController.createProduct);

// PUT /api/products/12
router.put('/:id', authenticate, requireAdmin, productController.updateProduct);

// DELETE /api/products/12
router.delete('/:id', authenticate, requireAdmin, productController.deleteProduct);

module.exports = router;
