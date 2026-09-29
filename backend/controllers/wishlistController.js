const db = require('../config/db');

const wishlistSelect = `
  SELECT
    w.product_id,
    w.created_at,
    p.name,
    p.description,
    p.price,
    p.image_url,
    p.category,
    p.stock,
    p.rating_stars,
    p.review_count,
    p.quality
  FROM wishlist_items w
  JOIN products p ON p.id = w.product_id
  WHERE w.user_id = ?
  ORDER BY w.created_at DESC
`;

async function getWishlist(req, res, next) {
  try {
    const result = await db.query(wishlistSelect, [req.user.id]);
    res.status(200).json({ success: true, count: result.rows.length, data: result.rows });
  } catch (error) {
    next(error);
  }
}

async function addToWishlist(req, res, next) {
  try {
    const productId = Number.parseInt(req.body.product_id, 10);
    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({ message: 'product_id must be a positive integer.' });
    }

    const product = await db.query('SELECT id FROM products WHERE id = ?', [productId]);
    if (!product.rows[0]) return res.status(404).json({ message: 'Product not found.' });

    await db.query('INSERT INTO wishlist_items (user_id, product_id) VALUES (?, ?)', [req.user.id, productId]);
    res.status(201).json({ success: true, message: 'Product added to wishlist.' });
  } catch (error) {
    if (error.code === '23505' || error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ message: 'Product is already in your wishlist.' });
    }
    next(error);
  }
}

async function removeFromWishlist(req, res, next) {
  try {
    const productId = Number.parseInt(req.params.productId, 10);
    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({ message: 'Product ID must be a positive number.' });
    }

    const result = await db.query(
      'DELETE FROM wishlist_items WHERE user_id = ? AND product_id = ?',
      [req.user.id, productId]
    );
    if (result.rowCount === 0) return res.status(404).json({ message: 'Product is not in your wishlist.' });
    res.status(200).json({ success: true, message: 'Product removed from wishlist.' });
  } catch (error) {
    next(error);
  }
}

module.exports = { getWishlist, addToWishlist, removeFromWishlist };
