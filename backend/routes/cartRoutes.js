// ════════════════════════════════════════════════════════════════
// routes/cartRoutes.js — Shopping Cart Routes (Protected)
// All cart routes require a valid JWT (authenticate middleware).
// Handles: GET/POST/PUT/DELETE /api/cart
// ════════════════════════════════════════════════════════════════
const express          = require('express');
const router           = express.Router();
const cartController   = require('../controllers/cartController');
const { authenticate } = require('../middleware/authMiddleware');

// All cart routes are protected — user must be logged in
router.get('/',    authenticate, cartController.getCart);
router.post('/',   authenticate, cartController.addToCart);
router.put('/:id', authenticate, cartController.updateCartItem);
router.delete('/:id', authenticate, cartController.removeFromCart);

module.exports = router;
