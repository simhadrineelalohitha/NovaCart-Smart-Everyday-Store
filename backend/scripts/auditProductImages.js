const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ExcelJS = require('exceljs');
const Database = require('better-sqlite3');
const sharp = require('sharp');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const databasePath = path.resolve(__dirname, '..', process.env.DB_PATH || './novacart.db');
const workbookPath = path.resolve(process.argv[2] || path.join(__dirname, '../../complete_product_database_3500_products.xlsx'));
const frontendPages = path.resolve(__dirname, '../../frontend/pages');
const variantsDirectory = path.resolve(__dirname, '../../frontend/assets/products/variants');
const productTypesDirectory = path.resolve(__dirname, '../../frontend/assets/products/product-types');
const productTypeMap = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../frontend/assets/products/product-type-map.json'), 'utf8')).productTypeMap;
const generatedTypeMap = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../frontend/assets/products/generated-product-type-map.json'), 'utf8'));

function hash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function duplicateGroups(values) {
  const groups = new Map();
  values.forEach(({ key, value }) => {
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(key);
  });
  return [...groups.values()].filter(group => group.length > 1);
}

async function readWorkbookIds() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(workbookPath);
  const sheet = workbook.getWorksheet('Products');
  if (!sheet) throw new Error('Workbook must contain a Products sheet.');
  const headers = sheet.getRow(1).values.slice(1);
  const positions = Object.fromEntries(headers.map((header, index) => [header, index + 1]));
  if (!positions.Product_ID || !positions.Category || !positions.Subcategory) {
    throw new Error('Workbook is missing Product_ID, Category, or Subcategory.');
  }

  const ids = [];
  const types = new Set();
  for (let row = 2; row <= sheet.rowCount; row++) {
    const productId = String(sheet.getRow(row).getCell(positions.Product_ID).value || '').trim();
    const category = String(sheet.getRow(row).getCell(positions.Category).value || '').trim();
    const subcategory = String(sheet.getRow(row).getCell(positions.Subcategory).value || '').trim();
    if (!productId) throw new Error(`Missing Product_ID at worksheet row ${row}.`);
    ids.push(productId);
    if (category && subcategory) types.add(`${category}|${subcategory}`);
  }
  return { ids, types };
}

async function run() {
  if (!fs.existsSync(databasePath)) throw new Error(`Database not found: ${databasePath}`);
  if (!fs.existsSync(workbookPath)) throw new Error(`Workbook not found: ${workbookPath}`);

  const workbook = await readWorkbookIds();
  const db = new Database(databasePath, { readonly: true });
  const products = db.prepare('SELECT source_product_id, image_url, category, subcategory FROM products ORDER BY id').all();
  db.close();

  const databaseIds = new Set(products.map(product => product.source_product_id));
  const missingIds = workbook.ids.filter(id => !databaseIds.has(id));
  const extraIds = products.filter(product => !workbook.ids.includes(product.source_product_id)).map(product => product.source_product_id);
  const missingImages = products.filter(product => !product.image_url || !fs.existsSync(path.resolve(frontendPages, product.image_url)));

  const byteHashes = [];
  const normalizedHashes = [];
  for (const product of products) {
    const filePath = path.resolve(frontendPages, product.image_url);
    if (!fs.existsSync(filePath)) continue;
    const buffer = fs.readFileSync(filePath);
    byteHashes.push({ key: product.source_product_id, value: hash(buffer) });
    const normalized = await sharp(buffer).resize(32, 32, { fit: 'fill' }).grayscale().raw().toBuffer();
    normalizedHashes.push({ key: product.source_product_id, value: hash(normalized) });
  }

  const uncoveredTypes = [];
  const missingSourceFiles = [];
  const sourceHashes = [];
  for (const type of workbook.types) {
    const exactSource = productTypeMap[type];
    const exactSourcePath = exactSource && path.resolve(frontendPages, exactSource);
    const source = exactSourcePath && fs.existsSync(exactSourcePath)
      ? exactSource
      : generatedTypeMap[type];
    if (!source) {
      uncoveredTypes.push(type);
      continue;
    }
    const sourcePath = path.resolve(frontendPages, source);
    if (!fs.existsSync(sourcePath)) {
      missingSourceFiles.push({ type, source });
      continue;
    }
    sourceHashes.push({ key: type, value: hash(fs.readFileSync(sourcePath)) });
  }

  const referencedVariants = new Set(products.map(product => path.basename(product.image_url || '')));
  const orphanVariants = fs.readdirSync(variantsDirectory).filter(file => file.endsWith('.jpg') && !referencedVariants.has(file));
  const report = {
    workbookProducts: workbook.ids.length,
    databaseProducts: products.length,
    missingIds,
    extraIds,
    missingImages: missingImages.length,
    duplicateByteGroups: duplicateGroups(byteHashes),
    duplicateNormalizedGroups: duplicateGroups(normalizedHashes),
    productTypes: workbook.types.size,
    uncoveredTypes,
    missingSourceFiles,
    duplicateSourceGroups: duplicateGroups(sourceHashes),
    orphanVariants,
  };
  console.log(JSON.stringify(report, null, 2));

  if (
    missingIds.length || extraIds.length || missingImages.length ||
    report.duplicateByteGroups.length || report.duplicateNormalizedGroups.length ||
    uncoveredTypes.length || missingSourceFiles.length || report.duplicateSourceGroups.length
  ) {
    process.exitCode = 1;
  }
}

run().catch(error => {
  console.error(`Product image audit failed: ${error.message}`);
  process.exitCode = 1;
});
