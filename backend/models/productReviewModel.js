const db = require('../config/db');

function getSummary(productId) {
  return db.prepare(`
    SELECT p.rating_stars, p.review_count, p.quality, COUNT(r.id) AS written_review_count
    FROM products p
    LEFT JOIN product_reviews r ON r.product_id = p.id
    WHERE p.id = ?
    GROUP BY p.id
  `).get(productId);
}

function getReviews(productId) {
  return db.prepare(`
    SELECT r.id, r.rating, r.title, r.body, r.created_at, u.name AS reviewer_name
    FROM product_reviews r
    JOIN users u ON u.id = r.user_id
    WHERE r.product_id = ?
    ORDER BY r.created_at DESC, r.id DESC
    LIMIT 100
  `).all(productId);
}

function createReview({ productId, userId, rating, title, body }) {
  const createReviewTx = db.transaction(() => {
    const product = db.prepare(
      'SELECT rating_stars, review_count FROM products WHERE id = ?'
    ).get(productId);
    if (!product) return undefined;

    const review = db.prepare(`
      INSERT INTO product_reviews (product_id, user_id, rating, title, body)
      VALUES (?, ?, ?, ?, ?)
    `).run(productId, userId, rating, title, body);

    const previousCount = Number(product.review_count) || 0;
    const previousRating = Number(product.rating_stars) || 0;
    const updatedRating = Math.round(((previousRating * previousCount + rating) / (previousCount + 1)) * 10) / 10;
    db.prepare(`
      UPDATE products
      SET rating_stars = ?, review_count = ?
      WHERE id = ?
    `).run(updatedRating, previousCount + 1, productId);

    return db.prepare(`
      SELECT r.id, r.rating, r.title, r.body, r.created_at, u.name AS reviewer_name
      FROM product_reviews r
      JOIN users u ON u.id = r.user_id
      WHERE r.id = ?
    `).get(review.lastInsertRowid);
  });

  return createReviewTx();
}

module.exports = { getSummary, getReviews, createReview };