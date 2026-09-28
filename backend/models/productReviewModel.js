const db = require('../config/db');

async function getSummary(productId) {
  const result = await db.query(`
    SELECT p.rating_stars, p.review_count, p.quality, COUNT(r.id) AS written_review_count
    FROM products p
    LEFT JOIN product_reviews r ON r.product_id = p.id
    WHERE p.id = ?
    GROUP BY p.id
  `, [productId]);
  return result.rows[0];
}

async function getReviews(productId) {
  const result = await db.query(`
    SELECT r.id, r.rating, r.title, r.body, r.created_at, u.name AS reviewer_name
    FROM product_reviews r
    JOIN users u ON u.id = r.user_id
    WHERE r.product_id = ?
    ORDER BY r.created_at DESC, r.id DESC
    LIMIT 100
  `, [productId]);
  return result.rows;
}

async function createReview({ productId, userId, rating, title, body }) {
  return db.withTransaction(async transaction => {
    const productResult = await transaction.query(
      'SELECT rating_stars, review_count FROM products WHERE id = ?',
      [productId]
    );
    const product = productResult.rows[0];
    if (!product) return undefined;

    const reviewResult = await transaction.query(`
      INSERT INTO product_reviews (product_id, user_id, rating, title, body)
      VALUES (?, ?, ?, ?, ?) RETURNING id
    `, [productId, userId, rating, title, body]);

    const previousCount = Number(product.review_count) || 0;
    const previousRating = Number(product.rating_stars) || 0;
    const updatedRating = Math.round(((previousRating * previousCount + rating) / (previousCount + 1)) * 10) / 10;
    await transaction.query(`
      UPDATE products
      SET rating_stars = ?, review_count = ?
      WHERE id = ?
    `, [updatedRating, previousCount + 1, productId]);

    const result = await transaction.query(`
      SELECT r.id, r.rating, r.title, r.body, r.created_at, u.name AS reviewer_name
      FROM product_reviews r
      JOIN users u ON u.id = r.user_id
      WHERE r.id = ?
    `, [reviewResult.rows[0].id]);
    return result.rows[0];
  });
}

module.exports = { getSummary, getReviews, createReview };