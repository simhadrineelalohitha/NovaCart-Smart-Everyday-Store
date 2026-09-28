// ════════════════════════════════════════════════════════════════
// routes/orderRoutes.js — Order Routes (Protected)
// All order routes require a valid JWT (authenticate middleware).
// Handles: GET/POST /api/orders  and  GET /api/orders/:id
// ════════════════════════════════════════════════════════════════
const express           = require('express');
const router            = express.Router();
const orderController   = require('../controllers/orderController');
const { authenticate }  = require('../middleware/authMiddleware');

// Place a new order from the current cart
router.post('/', authenticate, orderController.placeOrder);

// Get all orders for the logged-in user
router.get('/',  authenticate, orderController.getUserOrders);

// Get details of a specific order
router.get('/:id', authenticate, orderController.getOrderById);

module.exports = router;
