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

function orderError(status, message) {
  return Object.assign(new Error(message), { status });
}

// ── POST /api/orders ─────────────────────────────────────────
// Converts the user's current cart into a completed order.
// Uses a database transaction for atomicity (all-or-nothing).
const placeOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const requestedItems = req.body.items;
    const usesClientCart = requestedItems !== undefined;
    const shipping = req.body.shipping;
    let shippingDetails = { name: null, address: null, phone: null };

    if (usesClientCart) {
      if (!Array.isArray(requestedItems) || requestedItems.length === 0) {
        return res.status(400).json({ message: 'Your cart is empty. Add items before placing an order.' });
      }
      const productIds = new Set();
      for (const item of requestedItems) {
        const productId = Number(item?.product_id);
        const quantity = Number(item?.quantity);
        if (!Number.isSafeInteger(productId) || productId <= 0 || !Number.isSafeInteger(quantity) || quantity <= 0) {
          return res.status(400).json({ message: 'Each order item needs a valid product_id and positive integer quantity.' });
        }
        if (productIds.has(productId)) {
          return res.status(400).json({ message: 'An order cannot contain duplicate product IDs.' });
        }
        productIds.add(productId);
      }
    }

    if (shipping !== undefined) {
      if (!shipping || typeof shipping !== 'object' || Array.isArray(shipping)) {
        return res.status(400).json({ message: 'Shipping details are invalid.' });
      }
      shippingDetails = {
        name: typeof shipping.name === 'string' ? shipping.name.trim() : '',
        address: typeof shipping.address === 'string' ? shipping.address.trim() : '',
        phone: typeof shipping.phone === 'string' ? shipping.phone.trim() : '',
      };
      const phoneDigits = shippingDetails.phone.replace(/\D/g, '');
      if (shippingDetails.name.length < 2 || shippingDetails.name.length > 120
        || shippingDetails.address.length < 5 || shippingDetails.address.length > 500
        || !/^[+()\d.\-\s]+$/.test(shippingDetails.phone)
        || phoneDigits.length < 7 || phoneDigits.length > 15) {
        return res.status(400).json({ message: 'Enter a valid name, delivery address, and phone number.' });
      }
    }

    const orderId = await db.withTransaction(async transaction => {
      let cartItems;
      if (usesClientCart) {
        cartItems = [];
        for (const requestedItem of requestedItems) {
          const productId = Number(requestedItem.product_id);
          const quantity = Number(requestedItem.quantity);
          const productResult = await transaction.query(
            'SELECT id AS product_id, name, price, stock FROM products WHERE id = ?',
            [productId]
          );
          const product = productResult.rows[0];
          if (!product) throw orderError(404, `Product ${productId} was not found.`);
          if (Number(product.stock) < quantity) {
            throw orderError(409, `"${product.name}" only has ${product.stock} unit(s) in stock, but you ordered ${quantity}.`);
          }
          cartItems.push({ ...product, quantity });
        }
      } else {
        const cartResult = await transaction.query(`
          SELECT ci.product_id, ci.quantity, p.price, p.stock, p.name
          FROM cart_items ci
          JOIN products p ON ci.product_id = p.id
          WHERE ci.user_id = ?
        `, [userId]);
        cartItems = cartResult.rows;
        if (cartItems.length === 0) {
          throw orderError(400, 'Your cart is empty. Add items before placing an order.');
        }
        for (const item of cartItems) {
          if (Number(item.stock) < Number(item.quantity)) {
            throw orderError(409, `"${item.name}" only has ${item.stock} unit(s) in stock, but you ordered ${item.quantity}.`);
          }
        }
      }

      const total = cartItems.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
      const orderResult = await transaction.query(
        `INSERT INTO orders (user_id, total_amount, status, shipping_name, shipping_address, shipping_phone)
         VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
        [userId, Number(total.toFixed(2)), 'pending', shippingDetails.name, shippingDetails.address, shippingDetails.phone]
      );
      const createdOrderId = orderResult.rows[0].id;

      for (const item of cartItems) {
        await transaction.query(
          'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
          [createdOrderId, item.product_id, item.quantity, item.price]
        );
        const stockUpdate = await transaction.query(
          'UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?',
          [item.quantity, item.product_id, item.quantity]
        );
        if (stockUpdate.rowCount !== 1) {
          throw orderError(409, `"${item.name}" no longer has enough stock to complete this order.`);
        }
      }

      if (!usesClientCart) {
        await transaction.query('DELETE FROM cart_items WHERE user_id = ?', [userId]);
      }

      return createdOrderId;
    });

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
    if (err.status) return res.status(err.status).json({ message: err.message });
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
