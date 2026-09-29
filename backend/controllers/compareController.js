const db = require('../config/db');
const MAX_COMPARE_ITEMS = 4;

const compareSelect = `
  SELECT
    c.product_id,
    c.created_at,
    p.name,
    p.description,
    p.price,
    p.image_url,
    p.category,
    p.stock,
    p.rating_stars,
    p.review_count,
    p.quality,
    p.brand,
    p.subcategory,
    p.variant_specification,
    p.mrp_inr,
    p.discount_percent,
    p.warranty
  FROM compare_items c
  JOIN products p ON p.id = c.product_id
  WHERE c.user_id = ?
  ORDER BY c.created_at ASC
`;

async function getCompareItems(req, res, next) {
  try {
    const result = await db.query(compareSelect, [req.user.id]);
    res.status(200).json({ success: true, count: result.rows.length, data: result.rows });
  } catch (error) {
    next(error);
  }
}

async function addToCompare(req, res, next) {
  try {
    const productId = Number.parseInt(req.body.product_id, 10);
    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({ message: 'product_id must be a positive integer.' });
    }

    const product = await db.query('SELECT id FROM products WHERE id = ?', [productId]);
    if (!product.rows[0]) return res.status(404).json({ message: 'Product not found.' });

    const existing = await db.query(
      'SELECT id FROM compare_items WHERE user_id = ? AND product_id = ?',
      [req.user.id, productId]
    );
    if (existing.rows[0]) return res.status(409).json({ message: 'Product is already in comparison.' });

    const count = await db.query('SELECT COUNT(*) AS count FROM compare_items WHERE user_id = ?', [req.user.id]);
    if (Number(count.rows[0].count) >= MAX_COMPARE_ITEMS) {
      return res.status(400).json({ message: `You can compare up to ${MAX_COMPARE_ITEMS} products.` });
    }

    await db.query('INSERT INTO compare_items (user_id, product_id) VALUES (?, ?)', [req.user.id, productId]);
    res.status(201).json({ success: true, message: 'Product added to comparison.' });
  } catch (error) {
    next(error);
  }
}

async function removeFromCompare(req, res, next) {
  try {
    const productId = Number.parseInt(req.params.productId, 10);
    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({ message: 'Product ID must be a positive number.' });
    }

    const result = await db.query(
      'DELETE FROM compare_items WHERE user_id = ? AND product_id = ?',
      [req.user.id, productId]
    );
    if (result.rowCount === 0) return res.status(404).json({ message: 'Product is not in comparison.' });
    res.status(200).json({ success: true, message: 'Product removed from comparison.' });
  } catch (error) {
    next(error);
  }
}

async function clearCompare(req, res, next) {
  try {
    await db.query('DELETE FROM compare_items WHERE user_id = ?', [req.user.id]);
    res.status(200).json({ success: true, message: 'Comparison list cleared.' });
  } catch (error) {
    next(error);
  }
}

module.exports = { getCompareItems, addToCompare, removeFromCompare, clearCompare };
