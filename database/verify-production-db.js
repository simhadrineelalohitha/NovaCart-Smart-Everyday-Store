const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const dotenv = require(path.join(ROOT, 'backend/node_modules/dotenv'));
const sharp = require(path.join(ROOT, 'backend/node_modules/sharp'));

dotenv.config({ path: path.join(ROOT, '.env') });
dotenv.config({ path: path.join(ROOT, 'backend/.env') });

const REQUIRED_COLUMNS = [
  'source_product_id', 'name', 'description', 'price', 'image_url', 'category', 'stock',
  'subcategory', 'brand', 'variant_specification', 'mrp_inr', 'discount_percent',
  'quality', 'rating_stars', 'review_count', 'manufacturing_date', 'expiry_date',
  'voltage', 'power_rating', 'age_range', 'warranty', 'seller', 'country_of_origin',
  'return_period_days', 'product_status',
];

function safeErrorMessage(error) {
  const message = String(error.message || error);
  return process.env.DATABASE_URL ? message.split(process.env.DATABASE_URL).join('[redacted DATABASE_URL]') : message;
}

async function checkApi() {
  const baseUrl = (process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 5000}/api`).replace(/\/+$/, '');
  const checks = [
    ['health', `${baseUrl}/health`, body => body.status === 'OK'],
    ['products', `${baseUrl}/products?page=1&limit=1`, body => body.success === true && Array.isArray(body.data)],
    ['categories', `${baseUrl}/products/categories`, body => body.success === true && Array.isArray(body.data)],
  ];
  const results = [];
  for (const [name, url, validate] of checks) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
      let body;
      try { body = await response.json(); } catch { body = null; }
      const passed = response.ok && body && validate(body);
      results.push({ name, status: response.status, passed });
    } catch {
      results.push({ name, status: 'unreachable', passed: false });
    }
  }
  return results;
}

async function verifyImages(products) {
  const urls = new Map();
  const hashes = new Map();
  const issues = [];
  for (const product of products) {
    if (!product.image_url) {
      issues.push(`Product ${product.id} has no image_url.`);
      continue;
    }
    if (urls.has(product.image_url)) {
      issues.push(`Products ${urls.get(product.image_url)} and ${product.id} share image_url ${product.image_url}.`);
    } else {
      urls.set(product.image_url, product.id);
    }

    if (product.source_product_id) {
      const expected = `../assets/products/variants/${product.source_product_id}.jpg`;
      if (product.image_url !== expected) {
        issues.push(`Product ${product.source_product_id} is not mapped to its matching product image file.`);
      }
    }

    if (/^https?:\/\//i.test(product.image_url)) {
      try { new URL(product.image_url); } catch { issues.push(`Product ${product.id} has an invalid remote image URL.`); }
      continue;
    }
    const filePath = path.resolve(ROOT, 'frontend/pages', product.image_url);
    const productsRoot = path.resolve(ROOT, 'frontend/assets/products');
    if (!filePath.startsWith(`${productsRoot}${path.sep}`) || !fs.existsSync(filePath)) {
      issues.push(`Product ${product.id} image mapping does not resolve to an existing product asset.`);
      continue;
    }
    try {
      const buffer = fs.readFileSync(filePath);
      const metadata = await sharp(buffer).metadata();
      if (!metadata.width || !metadata.height || !metadata.format) {
        issues.push(`Product ${product.id} image file is invalid.`);
        continue;
      }
      const hash = crypto.createHash('sha256').update(buffer).digest('hex');
      if (hashes.has(hash)) issues.push(`Products ${hashes.get(hash)} and ${product.id} use duplicate image files.`);
      else hashes.set(hash, product.id);
    } catch {
      issues.push(`Product ${product.id} image file could not be read.`);
    }
  }
  return issues;
}

async function run() {
  if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.trim()) {
    throw new Error('DATABASE_URL is required. Set it in the root .env or the Render environment; no SQLite fallback is allowed.');
  }
  const { Pool } = require(path.join(ROOT, 'backend/node_modules/pg'));
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED === 'false' ? false : true }
      : undefined,
  });
  try {
    await pool.query('SELECT 1');
    const countResult = await pool.query('SELECT COUNT(*)::bigint AS total FROM products');
    const columnResult = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'products'
    `);
    const actualColumns = new Set(columnResult.rows.map(row => row.column_name));
    const missingColumns = REQUIRED_COLUMNS.filter(column => !actualColumns.has(column));
    const productResult = await pool.query(
      'SELECT id, source_product_id, image_url FROM products ORDER BY id'
    );
    const imageIssues = await verifyImages(productResult.rows);
    const sourceCount = productResult.rows.filter(product => product.source_product_id).length;
    const apiResults = await checkApi();
    const apiPassed = apiResults.every(result => result.passed);

    console.log('PostgreSQL connection: PASS');
    console.log(`Actual product count: ${countResult.rows[0].total}`);
    console.log(`Required products columns: ${missingColumns.length ? `FAIL (missing: ${missingColumns.join(', ')})` : 'PASS'}`);
    console.log(`Products with source image mappings checked: ${sourceCount}`);
    console.log(`Image verification: ${imageIssues.length ? `FAIL (${imageIssues.length} issue(s))` : 'PASS'}`);
    for (const issue of imageIssues.slice(0, 20)) console.log(`Image issue: ${issue}`);
    console.log(`Read-only API checks: ${apiPassed ? 'PASS' : 'FAIL'}`);
    for (const result of apiResults) console.log(`API ${result.name}: ${result.passed ? 'PASS' : `FAIL (${result.status})`}`);

    if (missingColumns.length || imageIssues.length || !apiPassed) process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run().catch(error => {
  console.error(`Production database verification failed: ${safeErrorMessage(error)}`);
  process.exitCode = 1;
});