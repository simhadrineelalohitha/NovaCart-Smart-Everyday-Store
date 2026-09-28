const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const dbPath = path.resolve(__dirname, '..', process.env.DB_PATH || './novacart.db');
const outputPath = path.resolve(__dirname, '../../frontend/assets/products/product-type-candidates.json');
const mapOutputPath = path.resolve(__dirname, '../../frontend/assets/products/product-type-map.json');
const ignoredWords = new Set(['and', 'for', 'with', 'set', 'kit', 'product', 'the', 'of']);

function words(value) {
  return [...new Set(String(value || '').toLowerCase().match(/[a-z0-9]+/g) || [])]
    .filter(word => word.length > 1 && !ignoredWords.has(word))
    .map(word => word.endsWith('s') && word.length > 4 ? word.slice(0, -1) : word);
}

function scoreTitle(subcategory, title) {
  const target = words(subcategory);
  const candidate = new Set(words(title));
  if (!target.length) return 0;
  const matches = target.filter(word => candidate.has(word)).length;
  return matches / target.length;
}

function normalizedPhrase(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function slug(value) {
  return normalizedPhrase(value).replace(/\s+/g, '-');
}

async function fetchCandidates(subcategory) {
  const query = new URL('https://api.openverse.org/v1/images/');
  query.searchParams.set('q', subcategory);
  query.searchParams.set('page_size', '20');
  query.searchParams.set('license', 'by,by-sa,cc0,pdm');

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(query, {
        headers: { 'User-Agent': 'NovaCart/1.0 product-image-audit' },
        signal: AbortSignal.timeout(20000),
      });
      if (response.status === 429 || response.status >= 500) {
        await new Promise(resolve => setTimeout(resolve, 1200 * (attempt + 1)));
        continue;
      }
      if (!response.ok) return [];

      const body = await response.json();
      return (body.results || [])
        .map(result => ({
          title: result.title || '',
          url: result.url,
          license: result.license,
          licenseUrl: result.license_url,
          creator: result.creator || '',
          score: scoreTitle(subcategory, result.title),
        }))
        .filter(result => result.url && result.score >= 0.67)
        .sort((left, right) => right.score - left.score);
    } catch {
      await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  return [];
}

async function run() {
  let candidateData;
  if (process.argv.includes('--build-map')) {
    candidateData = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  } else {
  const db = new Database(dbPath, { readonly: true });
  let types;
  try {
    types = db.prepare(`
      SELECT category, subcategory, COUNT(*) AS product_count
      FROM products
      WHERE subcategory IS NOT NULL AND TRIM(subcategory) != ''
      GROUP BY category, subcategory
      ORDER BY category, subcategory
    `).all();
  } finally {
    db.close();
  }

  candidateData = [];
  let cursor = 0;
  async function worker() {
    while (cursor < types.length) {
      const current = types[cursor++];
      const candidates = await fetchCandidates(current.subcategory);
      candidateData.push({ ...current, candidates: candidates.slice(0, 5) });
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  await Promise.all(Array.from({ length: 3 }, worker));
  }

  candidateData.sort((left, right) =>
    left.category.localeCompare(right.category) || left.subcategory.localeCompare(right.subcategory)
  );
  if (!process.argv.includes('--build-map')) {
    fs.writeFileSync(outputPath, `${JSON.stringify(candidateData, null, 2)}\n`);
  }

  const productTypeMap = {};
  const imageSources = [];
  for (const item of candidateData) {
    const phrase = normalizedPhrase(item.subcategory);
    const exactMatch = item.candidates.find(candidate => normalizedPhrase(candidate.title).includes(phrase));
    if (!exactMatch) continue;

    const imageName = `${slug(item.category)}-${slug(item.subcategory)}.jpg`;
    const imagePath = `../assets/products/product-types/${imageName}`;
    productTypeMap[`${item.category}|${item.subcategory}`] = imagePath;
    imageSources.push({
      category: item.category,
      subcategory: item.subcategory,
      imageName,
      ...exactMatch,
    });
  }
  fs.writeFileSync(mapOutputPath, `${JSON.stringify({ productTypeMap, imageSources }, null, 2)}\n`);

  const matched = candidateData.filter(item => item.candidates.length > 0).length;
  const exactMatched = imageSources.length;
  console.log(`Product types checked: ${candidateData.length}`);
  console.log(`Types with exact-title licensed photos: ${exactMatched}`);
  console.log(`Types with only partial matches: ${matched - exactMatched}`);
  console.log(`Types without candidates: ${candidateData.length - matched}`);
  console.log(`Candidate report: ${outputPath}`);
  console.log(`Exact-match map and attribution: ${mapOutputPath}`);
}

run().catch(error => {
  console.error(`Image audit failed: ${error.message}`);
  process.exitCode = 1;
});