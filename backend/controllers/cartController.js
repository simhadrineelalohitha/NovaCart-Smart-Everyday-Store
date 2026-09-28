// ════════════════════════════════════════════════════════════════
// controllers/cartController.js — Shopping Cart Logic (SQLite)
// ════════════════════════════════════════════════════════════════
//
// All cart routes require the user to be logged in (JWT).
// The authenticated user's ID comes from req.user.id (set by authMiddleware).
//
// GET    /api/cart       — get all items in the user's cart
// POST   /api/cart       — add a product to the cart
// PUT    /api/cart/:id   — update quantity of a cart item
// DELETE /api/cart/:id   — remove a product from the cart
// ════════════════════════════════════════════════════════════════

const db = require('../config/db');

// ── Helper: fetch the full cart for a user ────────────────────
function fetchCart(userId) {
  const items = db.prepare(`
    SELECT
      ci.id         AS cart_item_id,
      ci.quantity,
      p.id          AS product_id,
      p.name,
      p.price,
      p.image_url,
      p.category,
      p.stock,
      (ci.quantity * p.price) AS subtotal
    FROM cart_items ci
    JOIN products p ON ci.product_id = p.id
    WHERE ci.user_id = ?
    ORDER BY ci.id ASC
  `).all(userId);

  const total = items.reduce((sum, item) => sum + item.subtotal, 0);
  return { items, total: parseFloat(total.toFixed(2)) };
}

// ── GET /api/cart ─────────────────────────────────────────────
const getCart = (req, res) => {
  try {
    const { items, total } = fetchCart(req.user.id);
    res.status(200).json({ success: true, data: items, total });
  } catch (err) {
    console.error('getCart error:', err.message);
    res.status(500).json({ message: 'Could not fetch cart.' });
  }
};

// ── POST /api/cart ────────────────────────────────────────────
// Body: { product_id, quantity? }
// If the product is already in the cart, increments its quantity.
const addToCart = (req, res) => {
  try {
    const { product_id, quantity = 1 } = req.body;

    if (!product_id) return res.status(400).json({ message: 'product_id is required.' });
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 1) return res.status(400).json({ message: 'quantity must be a positive integer.' });

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
    if (!product) return res.status(404).json({ message: 'Product not found.' });
    if (product.stock < qty) return res.status(400).json({ message: `Only ${product.stock} unit(s) in stock.` });

    // Check if already in cart — if so, increment; otherwise insert
    const existing = db.prepare(
      'SELECT id, quantity FROM cart_items WHERE user_id = ? AND product_id = ?'
    ).get(req.user.id, product_id);

    if (existing) {
      db.prepare('UPDATE cart_items SET quantity = quantity + ? WHERE id = ?').run(qty, existing.id);
    } else {
      db.prepare('INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)').run(req.user.id, product_id, qty);
    }

    const { items, total } = fetchCart(req.user.id);
    res.status(200).json({ success: true, data: items, total });
  } catch (err) {
    console.error('addToCart error:', err.message);
    res.status(500).json({ message: 'Could not add item to cart.' });
  }
};

// ── PUT /api/cart/:id ─────────────────────────────────────────
// :id is the cart_item id. Body: { quantity }
const updateCartItem = (req, res) => {
  try {
    const cartItemId = parseInt(req.params.id, 10);
    const quantity   = parseInt(req.body.quantity, 10);

    if (isNaN(cartItemId)) return res.status(400).json({ message: 'Invalid cart item ID.' });
    if (isNaN(quantity) || quantity < 1) return res.status(400).json({ message: 'quantity must be a positive integer.' });

    const item = db.prepare('SELECT * FROM cart_items WHERE id = ? AND user_id = ?').get(cartItemId, req.user.id);
    if (!item) return res.status(404).json({ message: 'Cart item not found.' });

    const product = db.prepare('SELECT stock FROM products WHERE id = ?').get(item.product_id);
    if (product && product.stock < quantity) {
      return res.status(400).json({ message: `Only ${product.stock} unit(s) in stock.` });
    }

    db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(quantity, cartItemId);

    const { items, total } = fetchCart(req.user.id);
    res.status(200).json({ success: true, data: items, total });
  } catch (err) {
    console.error('updateCartItem error:', err.message);
    res.status(500).json({ message: 'Could not update cart item.' });
  }
};

// ── DELETE /api/cart/:id ──────────────────────────────────────
const removeFromCart = (req, res) => {
  try {
    const cartItemId = parseInt(req.params.id, 10);
    if (isNaN(cartItemId)) return res.status(400).json({ message: 'Invalid cart item ID.' });

    const info = db.prepare('DELETE FROM cart_items WHERE id = ? AND user_id = ?').run(cartItemId, req.user.id);
    if (info.changes === 0) return res.status(404).json({ message: 'Cart item not found.' });

    const { items, total } = fetchCart(req.user.id);
    res.status(200).json({ success: true, data: items, total });
  } catch (err) {
    console.error('removeFromCart error:', err.message);
    res.status(500).json({ message: 'Could not remove cart item.' });
  }
};

module.exports = { getCart, addToCart, updateCartItem, removeFromCart };
