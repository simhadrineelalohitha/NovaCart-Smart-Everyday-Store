-- ════════════════════════════════════════════════════════════════
-- NovaCart — SQLite Database Schema
-- ════════════════════════════════════════════════════════════════
--
-- Tables (in dependency order):
--   1. users       — registered shoppers
--   2. products    — items for sale
--   3. cart_items  — items in a user's active cart
--   4. orders      — completed order headers
--   5. order_items — line items belonging to an order
--
-- Safe to run multiple times: all CREATE TABLE use IF NOT EXISTS.
-- ════════════════════════════════════════════════════════════════

PRAGMA foreign_keys = ON;

-- ── 1. USERS ─────────────────────────────────────────────────────
-- Stores registered shoppers.
-- password_hash: we never store plain passwords — only bcrypt hashes.
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER   PRIMARY KEY AUTOINCREMENT,
  name          TEXT      NOT NULL,
  email         TEXT      NOT NULL UNIQUE,
  password_hash TEXT      NOT NULL,
  created_at    DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── 2. PRODUCTS ───────────────────────────────────────────────────
-- Every item listed in the store.
-- price CHECK ensures no negative prices.
-- stock CHECK ensures inventory never goes below zero.
CREATE TABLE IF NOT EXISTS products (
  id          INTEGER  PRIMARY KEY AUTOINCREMENT,
  source_product_id TEXT UNIQUE,
  name        TEXT     NOT NULL,
  description TEXT,
  price       REAL     NOT NULL CHECK (price >= 0),
  image_url   TEXT,
  category    TEXT,
  stock       INTEGER  NOT NULL DEFAULT 0 CHECK (stock >= 0),
  subcategory TEXT,
  brand TEXT,
  variant_specification TEXT,
  mrp_inr REAL,
  discount_percent REAL,
  quality TEXT,
  rating_stars REAL,
  review_count INTEGER,
  manufacturing_date TEXT,
  expiry_date TEXT,
  voltage TEXT,
  power_rating TEXT,
  age_range TEXT,
  warranty TEXT,
  seller TEXT,
  country_of_origin TEXT,
  return_period_days INTEGER,
  product_status TEXT,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── 3. CART ITEMS ─────────────────────────────────────────────────
-- One row per product a user has added to their cart.
-- UNIQUE(user_id, product_id): adding the same product again
-- updates the quantity instead of inserting a duplicate.
CREATE TABLE IF NOT EXISTS cart_items (
  id          INTEGER  PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER  NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  product_id  INTEGER  NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity    INTEGER  NOT NULL DEFAULT 1 CHECK (quantity > 0),
  UNIQUE (user_id, product_id)
);

-- ── 4. ORDERS ─────────────────────────────────────────────────────
-- One row per completed order.
-- Status lifecycle: pending → confirmed → shipped → delivered
--                   any step → cancelled
CREATE TABLE IF NOT EXISTS orders (
  id           INTEGER  PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total_amount REAL     NOT NULL CHECK (total_amount >= 0),
  status       TEXT     NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','confirmed','shipped','delivered','cancelled')),
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── 5. ORDER ITEMS ────────────────────────────────────────────────
-- One row per product line inside an order.
-- price: stored at time of purchase so history stays correct
--        even if the product price changes later.
CREATE TABLE IF NOT EXISTS order_items (
  id          INTEGER  PRIMARY KEY AUTOINCREMENT,
  order_id    INTEGER  NOT NULL REFERENCES orders(id)   ON DELETE CASCADE,
  product_id  INTEGER           REFERENCES products(id) ON DELETE SET NULL,
  quantity    INTEGER  NOT NULL CHECK (quantity > 0),
  price       REAL     NOT NULL CHECK (price >= 0),
  UNIQUE (order_id, product_id)
);

-- ── 6. PRODUCT REVIEWS ───────────────────────────────────────────
-- Stores written reviews from authenticated shoppers. Imported rating
-- aggregates remain on products; new reviews update those aggregates.
CREATE TABLE IF NOT EXISTS product_reviews (
  id         INTEGER  PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER  NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id    INTEGER  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating     INTEGER  NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title      TEXT     NOT NULL,
  body       TEXT     NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (product_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_product_reviews_product_created
  ON product_reviews(product_id, created_at DESC);
