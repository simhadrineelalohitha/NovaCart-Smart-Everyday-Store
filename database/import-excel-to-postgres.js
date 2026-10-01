const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const dotenv = require(path.join(ROOT, 'backend/node_modules/dotenv'));
const ExcelJS = require(path.join(ROOT, 'backend/node_modules/exceljs'));
const sharp = require(path.join(ROOT, 'backend/node_modules/sharp'));

dotenv.config({ path: path.join(ROOT, '.env') });
dotenv.config({ path: path.join(ROOT, 'backend/.env') });

const WORKBOOK_PATH = path.join(ROOT, 'complete_product_database_3500_products.xlsx');
const FRONTEND_PAGES = path.join(ROOT, 'frontend/pages');
const REQUIRED_FIELDS = [
  'Product_ID', 'Product_Name', 'Category', 'Subcategory', 'Brand',
  'Variant_Specification', 'Description', 'MRP_INR', 'Discount_Percent',
  'Selling_Price_INR', 'Quality', 'Rating_Stars', 'Review_Count',
  'Manufacturing_Date', 'Expiry_Date', 'Voltage', 'Power_Rating',
  'Age_Range', 'Warranty', 'Stock_Quantity', 'Seller',
  'Country_of_Origin', 'Return_Period_Days', 'Product_Status',
];
const PRODUCT_COLUMNS = [
  'source_product_id', 'name', 'description', 'price', 'image_url', 'category', 'stock',
  'subcategory', 'brand', 'variant_specification', 'mrp_inr', 'discount_percent',
  'quality', 'rating_stars', 'review_count', 'manufacturing_date', 'expiry_date',
  'voltage', 'power_rating', 'age_range', 'warranty', 'seller', 'country_of_origin',
  'return_period_days', 'product_status',
];
const REQUIRED_COLUMNS = new Set(PRODUCT_COLUMNS);

function valueText(value) {
  if (value === null || value === undefined || value === '') return null;
  return String(value).trim() || null;
}

function valueNumber(value, field, rowNumber, integer = false) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || (integer && !Number.isInteger(parsed))) {
    throw new Error(`Invalid ${field} at worksheet row ${rowNumber}.`);
  }
  return parsed;
}

function valueDate(value, field, rowNumber) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new Error(`Invalid ${field} at worksheet row ${rowNumber}.`);
    return value.toISOString().slice(0, 10);
  }
  return String(value).trim() || null;
}

function imagePathFor(sourceId) {
  return `../assets/products/variants/${sourceId}.jpg`;
}

async function readWorkbook() {
  if (!fs.existsSync(WORKBOOK_PATH)) throw new Error(`Workbook not found: ${WORKBOOK_PATH}`);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(WORKBOOK_PATH);
  const sheet = workbook.getWorksheet('Products');
  if (!sheet) throw new Error('Workbook must contain a "Products" sheet.');

  const headers = sheet.getRow(1).values.slice(1);
  const missingHeaders = REQUIRED_FIELDS.filter(field => !headers.includes(field));
  if (missingHeaders.length) throw new Error(`Products sheet is missing columns: ${missingHeaders.join(', ')}`);
  const positions = Object.fromEntries(REQUIRED_FIELDS.map(field => [field, headers.indexOf(field) + 1]));
  const rows = [];
  const seenIds = new Set();
  let duplicateWorkbookRows = 0;

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    const get = field => row.getCell(positions[field]).value;
    const sourceId = valueText(get('Product_ID'));
    const name = valueText(get('Product_Name'));
    const category = valueText(get('Category'));
    if (!sourceId && !name && !category) continue;
    if (!sourceId || !name || !category) {
      throw new Error(`Product_ID, Product_Name, and Category are required at worksheet row ${rowNumber}.`);
    }
    if (seenIds.has(sourceId)) {
      duplicateWorkbookRows++;
      continue;
    }
    seenIds.add(sourceId);

    const price = valueNumber(get('Selling_Price_INR'), 'Selling_Price_INR', rowNumber);
    const stock = valueNumber(get('Stock_Quantity'), 'Stock_Quantity', rowNumber, true);
    if (price === null || price < 0 || stock === null || stock < 0) {
      throw new Error(`Invalid price or stock at worksheet row ${rowNumber}.`);
    }

    const imageUrl = imagePathFor(sourceId);
    const imagePath = path.resolve(FRONTEND_PAGES, imageUrl);
    if (!fs.existsSync(imagePath)) throw new Error(`Mapped image is missing for ${sourceId}: ${imageUrl}`);
    const imageBuffer = fs.readFileSync(imagePath);
    const metadata = await sharp(imageBuffer).metadata();
    if (!metadata.width || !metadata.height || !metadata.format) {
      throw new Error(`Mapped image is invalid for ${sourceId}: ${imageUrl}`);
    }
    rows.push({
      sourceId,
      imageUrl,
      imageHash: crypto.createHash('sha256').update(imageBuffer).digest('hex'),
      values: [
        sourceId, name, valueText(get('Description')), price, imageUrl, category, stock,
        valueText(get('Subcategory')), valueText(get('Brand')), valueText(get('Variant_Specification')),
        valueNumber(get('MRP_INR'), 'MRP_INR', rowNumber),
        valueNumber(get('Discount_Percent'), 'Discount_Percent', rowNumber),
        valueText(get('Quality')), valueNumber(get('Rating_Stars'), 'Rating_Stars', rowNumber),
        valueNumber(get('Review_Count'), 'Review_Count', rowNumber, true),
        valueDate(get('Manufacturing_Date'), 'Manufacturing_Date', rowNumber),
        valueDate(get('Expiry_Date'), 'Expiry_Date', rowNumber),
        valueText(get('Voltage')), valueText(get('Power_Rating')), valueText(get('Age_Range')),
        valueText(get('Warranty')), valueText(get('Seller')), valueText(get('Country_of_Origin')),
        valueNumber(get('Return_Period_Days'), 'Return_Period_Days', rowNumber, true),
        valueText(get('Product_Status')),
      ],
    });
  }

  const imageHashes = new Set();
  for (const row of rows) {
    if (imageHashes.has(row.imageHash)) throw new Error(`Duplicate product image file detected for ${row.sourceId}.`);
    imageHashes.add(row.imageHash);
  }
  return { rows, duplicateWorkbookRows };
}

function safeErrorMessage(error) {
  const message = String(error.message || error);
  return process.env.DATABASE_URL ? message.split(process.env.DATABASE_URL).join('[redacted DATABASE_URL]') : message;
}

async function run() {
  if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.trim()) {
    throw new Error('DATABASE_URL is required. Set it in the root .env or the Render environment; no SQLite fallback is allowed.');
  }
  const { rows, duplicateWorkbookRows } = await readWorkbook();
  const { Pool } = require(path.join(ROOT, 'backend/node_modules/pg'));
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED === 'false' ? false : true }
      : undefined,
  });
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const columnsResult = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'products'
    `);
    const actualColumns = new Set(columnsResult.rows.map(row => row.column_name));
    const missingColumns = [...REQUIRED_COLUMNS].filter(column => !actualColumns.has(column));
    if (missingColumns.length) throw new Error(`PostgreSQL products table is missing required columns: ${missingColumns.join(', ')}`);

    const uniqueResult = await client.query(`
      SELECT 1
      FROM information_schema.table_constraints constraint_info
      JOIN information_schema.key_column_usage key_info
        ON key_info.constraint_catalog = constraint_info.constraint_catalog
        AND key_info.constraint_schema = constraint_info.constraint_schema
        AND key_info.constraint_name = constraint_info.constraint_name
        AND key_info.table_name = constraint_info.table_name
      WHERE constraint_info.table_schema = current_schema()
        AND constraint_info.table_name = 'products'
        AND constraint_info.constraint_type IN ('PRIMARY KEY', 'UNIQUE')
        AND key_info.column_name = 'source_product_id'
        AND key_info.ordinal_position = 1
      LIMIT 1
    `);
    if (!uniqueResult.rowCount) throw new Error('products.source_product_id must have a UNIQUE constraint for retry-safe imports.');

    const sourceIds = rows.map(row => row.sourceId);
    const existingResult = await client.query(
      'SELECT source_product_id, image_url FROM products WHERE source_product_id = ANY($1::text[])',
      [sourceIds]
    );
    const expectedImages = new Map(rows.map(row => [row.sourceId, row.imageUrl]));
    for (const product of existingResult.rows) {
      if (product.image_url !== expectedImages.get(product.source_product_id)) {
        throw new Error(`Existing product ${product.source_product_id} has a different image mapping; refusing to overwrite existing data.`);
      }
    }

    const beforeCount = await client.query('SELECT COUNT(*)::bigint AS total FROM products');
    const placeholders = PRODUCT_COLUMNS.map((_, index) => `$${index + 1}`).join(', ');
    const insertSql = `INSERT INTO products (${PRODUCT_COLUMNS.join(', ')}) VALUES (${placeholders}) ON CONFLICT (source_product_id) DO NOTHING`;
    let imported = 0;
    for (const row of rows) {
      const result = await client.query(insertSql, row.values);
      imported += result.rowCount;
    }

    const expectedResult = await client.query(
      'SELECT source_product_id, image_url FROM products WHERE source_product_id = ANY($1::text[])',
      [sourceIds]
    );
    const storedImages = new Map(expectedResult.rows.map(row => [row.source_product_id, row.image_url]));
    const missingProducts = rows.filter(row => storedImages.get(row.sourceId) !== row.imageUrl);
    if (missingProducts.length) throw new Error(`Post-import image/source verification failed for ${missingProducts.length} products.`);

    const afterCount = await client.query('SELECT COUNT(*)::bigint AS total FROM products');
    await client.query('COMMIT');
    console.log(`Excel rows: ${rows.length + duplicateWorkbookRows}`);
    console.log(`Unique workbook products: ${rows.length}`);
    console.log(`Imported products: ${imported}`);
    console.log(`Existing products skipped: ${rows.length - imported}`);
    console.log(`Duplicate workbook rows skipped: ${duplicateWorkbookRows}`);
    console.log(`Product image mappings verified: ${rows.length}; duplicate image files: 0`);
    console.log(`PostgreSQL product count: ${afterCount.rows[0].total} (before: ${beforeCount.rows[0].total})`);
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

run().catch(error => {
  console.error(`PostgreSQL Excel import failed: ${safeErrorMessage(error)}`);
  process.exitCode = 1;
});