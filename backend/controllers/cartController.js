// ════════════════════════════════════════════════════════════════
// controllers/cartController.js — Shopping Cart Logic
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
async function fetchCart(userId, database = db) {
  const result = await database.query(`
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
  `, [userId]);
  const items = result.rows;

  const total = items.reduce((sum, item) => sum + item.subtotal, 0);
  return { items, total: parseFloat(total.toFixed(2)) };
}

// ── GET /api/cart ─────────────────────────────────────────────
const getCart = async (req, res) => {
  try {
    const { items, total } = await fetchCart(req.user.id);
    res.status(200).json({ success: true, data: items, total });
  } catch (err) {
    console.error('getCart error:', err.message);
    res.status(500).json({ message: 'Could not fetch cart.' });
  }
};

// ── POST /api/cart ────────────────────────────────────────────
// Body: { product_id, quantity? }
// If the product is already in the cart, increments its quantity.
const addToCart = async (req, res) => {
  try {
    const { product_id, quantity = 1 } = req.body;

    if (!product_id) return res.status(400).json({ message: 'product_id is required.' });
    const qty = Number(quantity);
    if (!Number.isSafeInteger(qty) || qty < 1) return res.status(400).json({ message: 'quantity must be a positive integer.' });

    const cartError = await db.withTransaction(async transaction => {
      const lock = db.isPostgres ? ' FOR UPDATE' : '';
      const productResult = await transaction.query(`SELECT * FROM products WHERE id = ?${lock}`, [product_id]);
      const product = productResult.rows[0];
      if (!product) return { status: 404, message: 'Product not found.' };

      const existingResult = await transaction.query(
        'SELECT id, quantity FROM cart_items WHERE user_id = ? AND product_id = ?',
        [req.user.id, product_id]
      );
      const existing = existingResult.rows[0];
      const updatedQuantity = qty + (existing?.quantity || 0);
      if (updatedQuantity > product.stock) {
        const available = Math.max(product.stock - (existing?.quantity || 0), 0);
        return { status: 400, message: `Only ${available} additional unit(s) in stock.` };
      }

      if (existing) {
        await transaction.query('UPDATE cart_items SET quantity = ? WHERE id = ?', [updatedQuantity, existing.id]);
      } else {
        await transaction.query('INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)', [req.user.id, product_id, qty]);
      }
      return null;
    });
    if (cartError) return res.status(cartError.status).json({ message: cartError.message });

    const { items, total } = await fetchCart(req.user.id);
    res.status(200).json({ success: true, data: items, total });
  } catch (err) {
    console.error('addToCart error:', err.message);
    res.status(500).json({ message: 'Could not add item to cart.' });
  }
};

// ── PUT /api/cart/:id ─────────────────────────────────────────
// :id is the cart_item id. Body: { quantity }
const updateCartItem = async (req, res) => {
  try {
    const cartItemId = Number(req.params.id);
    const quantity   = Number(req.body.quantity);

    if (!Number.isSafeInteger(cartItemId) || cartItemId < 1) return res.status(400).json({ message: 'Invalid cart item ID.' });
    if (!Number.isSafeInteger(quantity) || quantity < 1) return res.status(400).json({ message: 'quantity must be a positive integer.' });

    const itemResult = await db.query('SELECT * FROM cart_items WHERE id = ? AND user_id = ?', [cartItemId, req.user.id]);
    const item = itemResult.rows[0];
    if (!item) return res.status(404).json({ message: 'Cart item not found.' });

    const productResult = await db.query('SELECT stock FROM products WHERE id = ?', [item.product_id]);
    const product = productResult.rows[0];
    if (product && product.stock < quantity) {
      return res.status(400).json({ message: `Only ${product.stock} unit(s) in stock.` });
    }

    await db.query('UPDATE cart_items SET quantity = ? WHERE id = ?', [quantity, cartItemId]);

    const { items, total } = await fetchCart(req.user.id);
    res.status(200).json({ success: true, data: items, total });
  } catch (err) {
    console.error('updateCartItem error:', err.message);
    res.status(500).json({ message: 'Could not update cart item.' });
  }
};

// ── DELETE /api/cart/:id ──────────────────────────────────────
const removeFromCart = async (req, res) => {
  try {
    const cartItemId = parseInt(req.params.id, 10);
    if (isNaN(cartItemId)) return res.status(400).json({ message: 'Invalid cart item ID.' });

    const result = await db.query('DELETE FROM cart_items WHERE id = ? AND user_id = ?', [cartItemId, req.user.id]);
    if (result.rowCount === 0) return res.status(404).json({ message: 'Cart item not found.' });

    const { items, total } = await fetchCart(req.user.id);
    res.status(200).json({ success: true, data: items, total });
  } catch (err) {
    console.error('removeFromCart error:', err.message);
    res.status(500).json({ message: 'Could not remove cart item.' });
  }
};

module.exports = { getCart, addToCart, updateCartItem, removeFromCart };
