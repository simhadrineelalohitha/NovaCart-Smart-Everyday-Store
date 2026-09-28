// ════════════════════════════════════════════════════════════════
// controllers/orderController.js — Order Processing Logic (SQLite)
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
// Uses a SQLite transaction for atomicity (all-or-nothing).
const placeOrder = (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Get the user's cart with product info
    const cartItems = db.prepare(`
      SELECT ci.product_id, ci.quantity, p.price, p.stock, p.name
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.user_id = ?
    `).all(userId);

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
    const placeOrderTx = db.transaction(() => {
      // Insert order header
      const orderInfo = db.prepare(
        'INSERT INTO orders (user_id, total_amount, status) VALUES (?, ?, ?)'
      ).run(userId, parseFloat(total.toFixed(2)), 'pending');

      const orderId = orderInfo.lastInsertRowid;

      // Insert order_items (one row per product)
      const insertItem = db.prepare(
        'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)'
      );
      for (const item of cartItems) {
        insertItem.run(orderId, item.product_id, item.quantity, item.price);
      }

      // Reduce stock for each product
      const reduceStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');
      for (const item of cartItems) {
        reduceStock.run(item.quantity, item.product_id);
      }

      // Clear the user's cart
      db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(userId);

      return orderId;
    });

    const orderId = placeOrderTx();

    // 4. Return the new order with its items
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    const items = db.prepare(`
      SELECT oi.*, p.name, p.image_url
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).all(orderId);

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
const getUserOrders = (req, res) => {
  try {
    const orders = db.prepare(
      'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC'
    ).all(req.user.id);
    res.status(200).json({ success: true, count: orders.length, data: orders });
  } catch (err) {
    console.error('getUserOrders error:', err.message);
    res.status(500).json({ message: 'Could not fetch orders.' });
  }
};

// ── GET /api/orders/:id ───────────────────────────────────────
// Returns a single order with its line items.
// Only the order's owner can view it.
const getOrderById = (req, res) => {
  try {
    const orderId = parseInt(req.params.id, 10);
    if (isNaN(orderId)) return res.status(400).json({ message: 'Invalid order ID.' });

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found.' });
    if (order.user_id !== req.user.id) {
      return res.status(403).json({ message: 'You do not have access to this order.' });
    }

    const items = db.prepare(`
      SELECT oi.*, p.name, p.image_url, p.category
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).all(orderId);

    res.status(200).json({ success: true, data: { ...order, items } });
  } catch (err) {
    console.error('getOrderById error:', err.message);
    res.status(500).json({ message: 'Could not fetch order.' });
  }
};

module.exports = { placeOrder, getUserOrders, getOrderById };
