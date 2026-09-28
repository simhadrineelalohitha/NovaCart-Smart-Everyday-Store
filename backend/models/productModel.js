// ════════════════════════════════════════════════════════════════
// models/productModel.js — Product Database Functions (SQLite)
// ════════════════════════════════════════════════════════════════
//
// This file ONLY talks to the database.
// node-sqlite3-wasm is synchronous — no async/await needed.
//
// Route → Controller (HTTP logic) → Model (DB logic) ← this file
// ════════════════════════════════════════════════════════════════

const db = require('../config/db');

// ── getAllProducts ─────────────────────────────────────────────
// Returns all products, newest first. Optionally filter by category.
function getAllProducts(category) {
  if (category) {
    return db.prepare(
      'SELECT * FROM products WHERE category = ? ORDER BY created_at DESC'
    ).all(category);
  }
  return db.prepare('SELECT * FROM products ORDER BY created_at DESC').all();
}

// ── getProductById ────────────────────────────────────────────
// Returns one product row by ID, or undefined if not found.
function getProductById(id) {
  return db.prepare('SELECT * FROM products WHERE id = ?').get(id);
}

// ── createProduct ─────────────────────────────────────────────
// Inserts a new product and returns the created row.
function createProduct({ name, description, price, image_url, category, stock }) {
  const info = db.prepare(
    `INSERT INTO products (name, description, price, image_url, category, stock)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(name, description || null, price, image_url || null, category, stock);
  return getProductById(info.lastInsertRowid);
}

// ── updateProduct ─────────────────────────────────────────────
// Updates only the fields provided, keeps old values for missing fields.
function updateProduct(id, { name, description, price, image_url, category, stock }) {
  const existing = getProductById(id);
  if (!existing) return undefined;

  db.prepare(
    `UPDATE products
     SET name = ?, description = ?, price = ?, image_url = ?, category = ?, stock = ?
     WHERE id = ?`
  ).run(
    name        ?? existing.name,
    description ?? existing.description,
    price       ?? existing.price,
    image_url   ?? existing.image_url,
    category    ?? existing.category,
    stock       ?? existing.stock,
    id
  );
  return getProductById(id);
}

// ── deleteProduct ─────────────────────────────────────────────
// Deletes a product and returns the deleted row (or undefined).
function deleteProduct(id) {
  const existing = getProductById(id);
  if (!existing) return undefined;
  db.prepare('DELETE FROM products WHERE id = ?').run(id);
  return existing;
}

module.exports = { getAllProducts, getProductById, createProduct, updateProduct, deleteProduct };
