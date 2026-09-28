// ════════════════════════════════════════════════════════════════
// routes/productRoutes.js — Product API Routes
// Base path: /api/products   (mounted in server.js)
// ════════════════════════════════════════════════════════════════
//
// Public routes (no login required):
//   GET  /api/products          → list all (filter with ?category=)
//   GET  /api/products/:id      → single product
//
// Admin routes (no auth protection yet — added in Stage 2):
//   POST   /api/products        → create product
//   PUT    /api/products/:id    → update product
//   DELETE /api/products/:id    → delete product
// ════════════════════════════════════════════════════════════════

const express           = require('express');
const router            = express.Router();
const productController = require('../controllers/productController');
const { authenticate }  = require('../middleware/authMiddleware');

// ── Public routes ─────────────────────────────────────────────

// GET /api/products
// GET /api/products?category=Electronics
router.get('/', productController.getAllProducts);

// Product ratings and written reviews
router.get('/:id/reviews', productController.getProductReviews);
router.post('/:id/reviews', authenticate, productController.createProductReview);

// GET /api/products/12
router.get('/:id', productController.getProductById);

// ── Admin routes (will add authenticate middleware in Stage 2) ─

// POST /api/products
router.post('/', productController.createProduct);

// PUT /api/products/12
router.put('/:id', productController.updateProduct);

// DELETE /api/products/12
router.delete('/:id', productController.deleteProduct);

module.exports = router;
