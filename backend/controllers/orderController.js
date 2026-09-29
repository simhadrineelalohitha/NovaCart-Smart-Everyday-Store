// ════════════════════════════════════════════════════════════════
// controllers/orderController.js — Order Processing Logic
// ════════════════════════════════════════════════════════════════
//
// All order routes require the user to be logged in (JWT).
//
// POST /api/orders      — place an order from the user's cart
// GET  /api/orders      — get order history for the logged-in user
// GET  /api/orders/:id  — get details of a specific order
// ════════════════════════════════════════════════════════════════

const db = require('../config/db');

// ── POST /api/orders ─────────────────────────────────────────
// Converts the user's current cart into a completed order.
// Uses a database transaction for atomicity (all-or-nothing).
const placeOrder = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Get the user's cart with product info
    const cartResult = await db.query(`
      SELECT ci.product_id, ci.quantity, p.price, p.stock, p.name
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.user_id = ?
    `, [userId]);
    const cartItems = cartResult.rows;

    if (cartItems.length === 0) {
      return res.status(400).json({ message: 'Your cart is empty. Add items before placing an order.' });
    }

    // 2. Validate stock
    for (const item of cartItems) {
      if (item.stock < item.quantity) {
        return res.status(400).json({
          message: `"${item.name}" only has ${item.stock} unit(s) in stock, but you ordered ${item.quantity}.`,
        });
      }
    }

    const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    // 3. Everything in a transaction — if any step fails, all changes roll back
    const orderId = await db.withTransaction(async transaction => {
      // Insert order header
      const orderResult = await transaction.query(
        'INSERT INTO orders (user_id, total_amount, status) VALUES (?, ?, ?) RETURNING id',
        [userId, parseFloat(total.toFixed(2)), 'pending']
      );
      const createdOrderId = orderResult.rows[0].id;

      // Insert order_items (one row per product)
      for (const item of cartItems) {
        await transaction.query(
          'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
          [createdOrderId, item.product_id, item.quantity, item.price]
        );
      }

      // Reduce stock for each product
      for (const item of cartItems) {
        await transaction.query('UPDATE products SET stock = stock - ? WHERE id = ?', [item.quantity, item.product_id]);
      }

      // Clear the user's cart
      await transaction.query('DELETE FROM cart_items WHERE user_id = ?', [userId]);

      return createdOrderId;
    });

    // 4. Return the new order with its items
    const orderResult = await db.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    const order = orderResult.rows[0];
    const itemResult = await db.query(`
      SELECT oi.*, p.name, p.image_url
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `, [orderId]);
    const items = itemResult.rows;

    res.status(201).json({
      success: true,
      message: 'Order placed successfully!',
      data: { ...order, items },
    });
  } catch (err) {
    console.error('placeOrder error:', err.message);
    res.status(500).json({ message: 'Could not place order.' });
  }
};

// ── GET /api/orders ───────────────────────────────────────────
// Returns all orders for the logged-in user, newest first.
const getUserOrders = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC'
      , [req.user.id]
    );
    const orders = result.rows;
    res.status(200).json({ success: true, count: orders.length, data: orders });
  } catch (err) {
    console.error('getUserOrders error:', err.message);
    res.status(500).json({ message: 'Could not fetch orders.' });
  }
};

// ── GET /api/orders/:id ───────────────────────────────────────
// Returns a single order with its line items.
// Only the order's owner can view it.
const getOrderById = async (req, res) => {
  try {
    const orderId = parseInt(req.params.id, 10);
    if (isNaN(orderId)) return res.status(400).json({ message: 'Invalid order ID.' });

    const orderResult = await db.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    const order = orderResult.rows[0];
    if (!order) return res.status(404).json({ message: 'Order not found.' });
    if (order.user_id !== req.user.id) {
      return res.status(403).json({ message: 'You do not have access to this order.' });
    }

    const itemResult = await db.query(`
      SELECT oi.*, p.name, p.image_url, p.category
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `, [orderId]);
    const items = itemResult.rows;

    res.status(200).json({ success: true, data: { ...order, items } });
  } catch (err) {
    console.error('getOrderById error:', err.message);
    res.status(500).json({ message: 'Could not fetch order.' });
  }
};

const getOrderTracking = async (req, res, next) => {
  try {
    const orderId = parseInt(req.params.id, 10);
    if (isNaN(orderId)) return res.status(400).json({ message: 'Invalid order ID.' });

    const result = await db.query(
      'SELECT id, status, created_at FROM orders WHERE id = ? AND user_id = ?',
      [orderId, req.user.id]
    );
    const order = result.rows[0];
    if (!order) return res.status(404).json({ message: 'Order not found.' });

    const statuses = order.status === 'cancelled'
      ? ['cancelled']
      : ['pending', 'confirmed', 'shipped', 'delivered'];
    const currentIndex = order.status === 'cancelled' ? 0 : statuses.indexOf(order.status);
    const timeline = statuses.map((status, index) => ({
      status,
      completed: currentIndex >= index,
      current: currentIndex === index,
    }));
    res.status(200).json({
      success: true,
      data: { order_id: order.id, status: order.status, created_at: order.created_at, timeline },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { placeOrder, getUserOrders, getOrderById, getOrderTracking };
