const ExcelJS = require('exceljs');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const frontendPages = path.resolve(__dirname, '../../frontend/pages');
const productAssets = path.resolve(__dirname, '../../frontend/assets/products');
const variantDirectory = path.join(productAssets, 'variants');
const mapPath = path.join(productAssets, 'product-type-map.json');
const workbookPath = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : path.resolve(__dirname, '../../complete_product_database_3500_products.xlsx');
const cropPositions = ['centre', 'north', 'east', 'south', 'west'];
const imageMap = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
const mappedTypes = new Set(
  imageMap.imageSources
    .filter(source => source.license === 'Pexels')
    .map(source => `${source.category}|${source.subcategory}`)
);

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  }[character]));
}

function productBadgeSvg(name, sourceId, productNumber) {
  const hue = (productNumber * 47) % 360;
  const label = escapeXml(String(name).slice(0, 46));
  const idLabel = escapeXml(sourceId);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="480">
    <rect x="0" y="398" width="720" height="82" fill="hsla(${hue} 55% 20% / .88)"/>
    <text x="24" y="433" fill="white" font-family="Arial, sans-serif" font-size="24" font-weight="700">${label}</text>
    <text x="696" y="463" text-anchor="end" fill="hsl(${hue} 70% 86%)" font-family="Arial, sans-serif" font-size="14">${idLabel}</text>
  </svg>`;
}

async function writeVariant(filePath, buffer) {
  const temporaryPath = `${filePath}.tmp-${process.pid}`;
  try {
    await fs.promises.writeFile(temporaryPath, buffer);
    await fs.promises.rename(temporaryPath, filePath);
  } catch (error) {
    try { await fs.promises.unlink(temporaryPath); } catch {}
    throw error;
  }
}

async function refreshMappedProductImages() {
  if (!fs.existsSync(workbookPath)) throw new Error(`Workbook not found: ${workbookPath}`);
  if (!mappedTypes.size) throw new Error('No Pexels-mapped product types were found.');

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(workbookPath);
  const worksheet = workbook.getWorksheet('Products');
  if (!worksheet) throw new Error('Workbook must contain a "Products" sheet.');

  const headers = worksheet.getRow(1).values.slice(1);
  const positions = Object.fromEntries(headers.map((header, index) => [header, index + 1]));
  for (const field of ['Product_ID', 'Product_Name', 'Category', 'Subcategory']) {
    if (!positions[field]) throw new Error(`Products sheet is missing ${field}.`);
  }

  fs.mkdirSync(variantDirectory, { recursive: true });
  let refreshed = 0;
  const seenIds = new Set();

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const sourceId = String(row.getCell(positions.Product_ID).value || '').trim();
    const name = String(row.getCell(positions.Product_Name).value || '').trim();
    const category = String(row.getCell(positions.Category).value || '').trim();
    const subcategory = String(row.getCell(positions.Subcategory).value || '').trim();
    const type = `${category}|${subcategory}`;
    if (!mappedTypes.has(type)) continue;
    if (!sourceId || !name) throw new Error(`Missing product ID or name at worksheet row ${rowNumber}.`);
    if (seenIds.has(sourceId)) throw new Error(`Duplicate product ID ${sourceId} in mapped types.`);
    seenIds.add(sourceId);

    const sourceImage = imageMap.productTypeMap[type];
    const sourcePath = path.resolve(frontendPages, sourceImage);
    if (!fs.existsSync(sourcePath)) throw new Error(`Mapped source image is missing: ${sourcePath}`);

    const productNumber = Number(sourceId.replace(/\D/g, '')) || rowNumber;
    const imageBuffer = await sharp(sourcePath)
      .resize({ width: 900, height: 650, fit: 'cover', position: cropPositions[productNumber % cropPositions.length] })
      .extract({
        left: (productNumber * 37) % 181,
        top: (productNumber * 73) % 171,
        width: 720,
        height: 480,
      })
      .flop(productNumber % 2 === 1)
      .modulate({ brightness: 0.88 + (productNumber % 9) * 0.03, saturation: 0.82 + (productNumber % 7) * 0.06 })
      .composite([{ input: Buffer.from(productBadgeSvg(name, sourceId, productNumber)), blend: 'over' }])
      .jpeg({ quality: 84 })
      .toBuffer();

    await writeVariant(path.join(variantDirectory, `${sourceId}.jpg`), imageBuffer);
    refreshed++;
  }

  console.log(`Mapped types: ${mappedTypes.size}; product variants refreshed: ${refreshed}`);
}

refreshMappedProductImages().catch(error => {
  console.error(`Mapped product image refresh failed: ${error.message}`);
  process.exitCode = 1;
});
