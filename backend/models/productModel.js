const db = require('../config/db');

async function getAllProducts(category) {
  let result;
  if (category) {
    result = await db.query('SELECT * FROM products WHERE category = ? ORDER BY created_at DESC', [category]);
  } else {
    result = await db.query('SELECT * FROM products ORDER BY created_at DESC');
  }
  return result.rows;
}

async function getProductById(id) {
  const result = await db.query('SELECT * FROM products WHERE id = ?', [id]);
  return result.rows[0];
}

async function createProduct({ name, description, price, image_url, category, stock }) {
  const result = await db.query(
    `INSERT INTO products (name, description, price, image_url, category, stock)
     VALUES (?, ?, ?, ?, ?, ?) RETURNING *`,
    [name, description || null, price, image_url || null, category, stock]
  );
  return result.rows[0];
}

async function updateProduct(id, { name, description, price, image_url, category, stock }) {
  const existing = await getProductById(id);
  if (!existing) return undefined;

  await db.query(
    `UPDATE products
     SET name = ?, description = ?, price = ?, image_url = ?, category = ?, stock = ?
     WHERE id = ?`,
    [
    name        ?? existing.name,
    description ?? existing.description,
    price       ?? existing.price,
    image_url   ?? existing.image_url,
    category    ?? existing.category,
    stock       ?? existing.stock,
    id
    ]
  );
  return await getProductById(id);
}

async function deleteProduct(id) {
  const existing = await getProductById(id);
  if (!existing) return undefined;
  await db.query('DELETE FROM products WHERE id = ?', [id]);
  return existing;
}

module.exports = { getAllProducts, getProductById, createProduct, updateProduct, deleteProduct };
