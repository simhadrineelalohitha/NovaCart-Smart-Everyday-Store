const Database = require('better-sqlite3');
const ExcelJS = require('exceljs');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const SOURCE_FIELDS = [
  'Product_ID', 'Product_Name', 'Category', 'Subcategory', 'Brand',
  'Variant_Specification', 'Description', 'MRP_INR', 'Discount_Percent',
  'Selling_Price_INR', 'Quality', 'Rating_Stars', 'Review_Count',
  'Manufacturing_Date', 'Expiry_Date', 'Voltage', 'Power_Rating',
  'Age_Range', 'Warranty', 'Stock_Quantity', 'Seller',
  'Country_of_Origin', 'Return_Period_Days', 'Product_Status',
];

const PRODUCT_COLUMNS = [
  ['source_product_id', 'TEXT'],
  ['subcategory', 'TEXT'],
  ['brand', 'TEXT'],
  ['variant_specification', 'TEXT'],
  ['mrp_inr', 'REAL'],
  ['discount_percent', 'REAL'],
  ['quality', 'TEXT'],
  ['rating_stars', 'REAL'],
  ['review_count', 'INTEGER'],
  ['manufacturing_date', 'TEXT'],
  ['expiry_date', 'TEXT'],
  ['voltage', 'TEXT'],
  ['power_rating', 'TEXT'],
  ['age_range', 'TEXT'],
  ['warranty', 'TEXT'],
  ['seller', 'TEXT'],
  ['country_of_origin', 'TEXT'],
  ['return_period_days', 'INTEGER'],
  ['product_status', 'TEXT'],
];

const PRODUCT_TYPE_IMAGE_MAP_PATH = path.resolve(__dirname, '../../frontend/assets/products/product-type-map.json');
const PRODUCT_TYPE_IMAGE_MAP = fs.existsSync(PRODUCT_TYPE_IMAGE_MAP_PATH)
  ? JSON.parse(fs.readFileSync(PRODUCT_TYPE_IMAGE_MAP_PATH, 'utf8')).productTypeMap
  : {};
const VERIFIED_PRODUCT_TYPE_IMAGES = {
  'Beauty & Personal Care|Sunscreen': '../assets/products/sunscreen-product-verified.jpg',
  'Home & Kitchen|Non-Stick Pan': '../assets/products/nonstick-pan-product-verified.jpg',
  'Home & Kitchen|Lunch Box': '../assets/products/lunch-box-product-verified.jpg',
};

const CATEGORY_IMAGES = {
  'Accessories': ['accessories', 'sunglasses', 'tote-bag'],
  'Automotive': ['automotive'],
  'Baby Products': ['baby-products', 'toys'],
  'Beauty & Personal Care': ['beauty-personal-care'],
  'Electrical Appliances': ['electrical-appliances', 'desk-lamp', 'water-bottle', 'speaker', 'table-fan-product'],
  'Electronics': ['electronics', 'keyboard', 'speaker'],
  'Fashion': ['fashion', 'accessories', 'sunglasses', 'tote-bag'],
  'Fitness & Sports': ['fitness-sports', 'resistance-bands-product'],
  'Gardening': ['gardening'],
  'Groceries': ['groceries'],
  'Home & Kitchen': ['home-kitchen', 'water-bottle', 'candle-product', 'cutting-board-product'],
  'Home Interior & Decor': ['home-interior-decor', 'desk-lamp', 'candle-product', 'desk-organizer-product'],
  'Mobile & Computer Accessories': ['mobile-computer-accessories', 'electronics', 'keyboard'],
  'Pet Supplies': ['pet-supplies'],
  'Stationery & Office': ['stationery-office', 'journal'],
  'Tools & Hardware': ['tools-hardware'],
  'Toys': ['toys', 'baby-products'],
  'Travel': ['travel', 'tote-bag', 'accessories'],
};

const PRODUCT_IMAGE_MATCHES = [
  [/non[- ]?stick pan|frying pan|skillet/i, 'nonstick-pan-product'],
  [/lunch box|lunchbox/i, 'lunch-box-product'],
  [/remote control car/i, 'remote-control-car-product'],
  [/laptop sleeve/i, 'laptop-sleeve-product'],
  [/desk organizer/i, 'desk-organizer-product'],
  [/table fan|desk fan/i, 'table-fan-product'],
  [/wireless earbuds|earbuds?|earphones?/i, 'wireless-earbuds-product'],
  [/wireless mouse|computer mouse/i, 'wireless-mouse-product'],
  [/\biron\b/i, 'iron-product'],
  [/mobile charger|phone charger/i, 'mobile-charger-product'],
  [/electric kettle|kettle/i, 'electric-kettle-product'],
  [/mixer grinder|rice cooker/i, 'electrical-appliances'],
  [/toiletry bag|travel pouch|backpack/i, 'tote-bag'],
  [/keyboard|computer/i, 'keyboard'],
  [/headphones?|speakers?/i, 'speaker'],
  [/watch/i, 'accessories'],
  [/sunglasses?/i, 'sunglasses'],
  [/water bottle|bottle/i, 'water-bottle'],
  [/candle/i, 'candle-product'],
  [/cutting board/i, 'cutting-board-product'],
  [/desk lamp|lamp/i, 'desk-lamp'],
  [/yoga|resistance band/i, 'resistance-bands-product'],
  [/journal|notebook|stationery/i, 'journal'],
  [/tote bag|travel bag/i, 'tote-bag'],
  [/puzzle|toy/i, 'toys'],
  [/car|automotive/i, 'automotive'],
  [/baby/i, 'baby-products'],
  [/beauty|skincare|personal care/i, 'beauty-personal-care'],
  [/garden|plant/i, 'gardening'],
  [/grocery|tea|oil|spice|dal|rice|grain|food/i, 'groceries'],
  [/pet|dog|cat/i, 'pet-supplies'],
  [/travel|suitcase/i, 'travel'],
  [/tool|hardware/i, 'tools-hardware'],
  [/home|interior|decor/i, 'home-interior-decor'],
  [/fan|appliance/i, 'electrical-appliances'],
];

const GROCERY_IMAGE_MATCHES = [
  [/basmati rice|rice/i, 'grocery-rice'],
  [/biscuit/i, 'grocery-biscuits'],
  [/coffee/i, 'grocery-coffee'],
  [/cooking oil|oil/i, 'grocery-cooking-oil'],
  [/oats/i, 'grocery-oats-product'],
  [/spice/i, 'grocery-spices'],
  [/sugar/i, 'grocery-sugar-product'],
  [/tea/i, 'grocery-tea'],
  [/toor dal|lentil|dal/i, 'grocery-dal-product'],
  [/wheat flour|flour/i, 'grocery-wheat-flour'],
];

function imageForProduct(category, productId, name, subcategory) {
  const verifiedTypeImage = VERIFIED_PRODUCT_TYPE_IMAGES[`${category}|${subcategory}`];
  if (verifiedTypeImage) return verifiedTypeImage;

  const exactTypeImage = PRODUCT_TYPE_IMAGE_MAP[`${category}|${subcategory}`];
  if (exactTypeImage) return exactTypeImage;

  const description = `${name || ''} ${subcategory || ''}`;
  if (category === 'Groceries') {
    const groceryImage = GROCERY_IMAGE_MATCHES.find(([pattern]) => pattern.test(description))?.[1];
    if (groceryImage) return `../assets/products/${groceryImage}.jpg`;
  }
  const matchedImage = PRODUCT_IMAGE_MATCHES.find(([pattern]) => pattern.test(description))?.[1];
  const images = CATEGORY_IMAGES[category];
  if (!images) return null;
  const idNumber = Number(String(productId).replace(/\D/g, '')) || 0;
  const imageName = matchedImage || images[idNumber % images.length];
  return imageName ? `../assets/products/${imageName}.jpg` : null;
}

function text(value) {
  if (value === null || value === undefined || value === '') return null;
  return String(value).trim() || null;
}

function number(value, field, rowNumber, integer = false) {
  if (value === null || value === undefined || value === '') return null;
  const result = Number(value);
  if (!Number.isFinite(result) || (integer && !Number.isInteger(result))) {
    throw new Error(`Invalid ${field} at worksheet row ${rowNumber}.`);
  }
  return result;
}

function date(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

function migrateProducts(db) {
  const existing = new Set(db.prepare('PRAGMA table_info(products)').all().map(column => column.name));
  for (const [column, type] of PRODUCT_COLUMNS) {
    if (!existing.has(column)) db.exec(`ALTER TABLE products ADD COLUMN ${column} ${type}`);
  }
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_products_source_product_id ON products(source_product_id)');
}

async function importProducts() {
  const workbookPath = process.argv[2];
  if (!workbookPath) throw new Error('Usage: npm run db:import -- <path-to-xlsx-file>');
  if (!fs.existsSync(workbookPath)) throw new Error(`Workbook not found: ${workbookPath}`);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(workbookPath);
  const worksheet = workbook.getWorksheet('Products');
  if (!worksheet) throw new Error('Workbook must contain a "Products" sheet.');

  const headers = worksheet.getRow(1).values.slice(1);
  const missing = SOURCE_FIELDS.filter(field => !headers.includes(field));
  if (missing.length) throw new Error(`Products sheet is missing columns: ${missing.join(', ')}`);
  const positions = Object.fromEntries(SOURCE_FIELDS.map(field => [field, headers.indexOf(field) + 1]));

  const productRows = [];
  const variantDirectory = path.resolve(__dirname, '../../frontend/assets/products/variants');
  const cropPositions = ['centre', 'north', 'east', 'south', 'west'];
  fs.mkdirSync(variantDirectory, { recursive: true });

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const get = field => row.getCell(positions[field]).value;
    const sourceId = text(get('Product_ID'));
    const name = text(get('Product_Name'));
    const category = text(get('Category'));
    if (!sourceId || !name || !category) {
      throw new Error(`Missing product ID, name, or category at worksheet row ${rowNumber}.`);
    }

    const baseImageUrl = imageForProduct(category, sourceId, name, text(get('Subcategory')));
    let imageUrl = baseImageUrl;

    if (baseImageUrl) {
      const variantName = `${sourceId}.jpg`;
      const variantPath = path.join(variantDirectory, variantName);
      const sourcePath = path.resolve(__dirname, '../../frontend/pages', baseImageUrl);
      const productNumber = Number(String(sourceId).replace(/\D/g, '')) || rowNumber;
      const variantBuffer = await sharp(sourcePath)
        .resize({ width: 900, height: 650, fit: 'cover', position: cropPositions[productNumber % cropPositions.length] })
        .extract({
          left: (productNumber * 37) % 181,
          top: (productNumber * 73) % 171,
          width: 720,
          height: 480,
        })
        .flop(productNumber % 2 === 1)
        .modulate({ brightness: 0.88 + (productNumber % 9) * 0.03, saturation: 0.82 + (productNumber % 7) * 0.06 })
        .jpeg({ quality: 84 })
        .toBuffer();
      fs.writeFileSync(variantPath, variantBuffer);
      imageUrl = `../assets/products/variants/${variantName}`;
    }

    productRows.push({ rowNumber, row, get, sourceId, name, category, imageUrl });
  }

  const dbPath = path.resolve(__dirname, '..', process.env.DB_PATH || './novacart.db');
  const db = new Database(dbPath);
  try {
    db.exec('PRAGMA foreign_keys = ON');
    db.exec(fs.readFileSync(path.join(__dirname, '../models/schema.sqlite.sql'), 'utf8'));
    migrateProducts(db);

    const findExisting = db.prepare('SELECT id FROM products WHERE source_product_id = ?');
    const updateImage = db.prepare('UPDATE products SET image_url = ? WHERE source_product_id = ?');
    const insert = db.prepare(`
      INSERT INTO products (
        source_product_id, name, description, price, image_url, category, stock,
        subcategory, brand, variant_specification, mrp_inr, discount_percent,
        quality, rating_stars, review_count, manufacturing_date, expiry_date,
        voltage, power_rating, age_range, warranty, seller, country_of_origin,
        return_period_days, product_status
      ) VALUES (${Array(25).fill('?').join(', ')})
    `);
    let inserted = 0;
    let skipped = 0;
    let imagesUpdated = 0;
    const runImport = db.transaction(() => {
        for (const { rowNumber, get, sourceId, name, category, imageUrl } of productRows) {
          if (findExisting.get([sourceId])) {
            skipped++;
            if (imageUrl) {
              updateImage.run(imageUrl, sourceId);
              imagesUpdated++;
            }
            continue;
          }

          const price = number(get('Selling_Price_INR'), 'Selling_Price_INR', rowNumber);
          const stock = number(get('Stock_Quantity'), 'Stock_Quantity', rowNumber, true);
          if (price === null || price < 0 || stock === null || stock < 0) {
            throw new Error(`Price or stock is invalid at worksheet row ${rowNumber}.`);
          }

          insert.run([
            sourceId, name, text(get('Description')), price, imageUrl, category, stock,
            text(get('Subcategory')), text(get('Brand')), text(get('Variant_Specification')),
            number(get('MRP_INR'), 'MRP_INR', rowNumber),
            number(get('Discount_Percent'), 'Discount_Percent', rowNumber),
            text(get('Quality')), number(get('Rating_Stars'), 'Rating_Stars', rowNumber),
            number(get('Review_Count'), 'Review_Count', rowNumber, true),
            date(get('Manufacturing_Date')), date(get('Expiry_Date')),
            text(get('Voltage')), text(get('Power_Rating')), text(get('Age_Range')),
            text(get('Warranty')), text(get('Seller')), text(get('Country_of_Origin')),
            number(get('Return_Period_Days'), 'Return_Period_Days', rowNumber, true),
            text(get('Product_Status')),
          ]);
          inserted++;
        }
    });
    runImport();

    const total = db.prepare('SELECT COUNT(*) AS total FROM products').get().total;
    const sourceTotal = db.prepare('SELECT COUNT(*) AS total FROM products WHERE source_product_id IS NOT NULL').get().total;
    console.log(`Imported: ${inserted}; skipped existing: ${skipped}; images updated: ${imagesUpdated}`);
    console.log(`Products in database: ${total}; spreadsheet products: ${sourceTotal}`);
  } finally {
    db.close();
  }
}

importProducts().catch(error => {
  console.error(`Product import failed: ${error.message}`);
  process.exitCode = 1;
});