const db = require('../config/db');

async function getAllProducts({ category, search, sort, limit, offset }) {
  const conditions = [];
  const params = [];
  if (category) {
    conditions.push('category = ?');
    params.push(category);
  }
  if (search) {
    conditions.push("(LOWER(name) LIKE ? ESCAPE '!' OR LOWER(COALESCE(description, '')) LIKE ? ESCAPE '!')");
    const pattern = `%${search.toLowerCase().replace(/[!%_]/g, '!$&')}%`;
    params.push(pattern, pattern);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const orderBy = {
    default: 'created_at DESC, id DESC',
    'price-asc': 'price ASC, id ASC',
    'price-desc': 'price DESC, id DESC',
    'name-asc': 'name ASC, id ASC',
    'name-desc': 'name DESC, id DESC',
  }[sort] || 'created_at DESC, id DESC';

  const [countResult, productResult] = await Promise.all([
    db.query(`SELECT COUNT(*) AS total FROM products ${where}`, params),
    db.query(`SELECT * FROM products ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`, [...params, limit, offset]),
  ]);
  return { rows: productResult.rows, total: Number(countResult.rows[0].total) };
}

async function getProductCategories() {
  const result = await db.query("SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND TRIM(category) <> '' ORDER BY category");
  return result.rows.map(row => row.category);
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

module.exports = { getAllProducts, getProductCategories, getProductById, createProduct, updateProduct, deleteProduct };
