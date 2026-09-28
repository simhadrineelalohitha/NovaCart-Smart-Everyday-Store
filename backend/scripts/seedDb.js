// ════════════════════════════════════════════════════════════════
// scripts/seedDb.js — Insert 15 sample products into SQLite
// ════════════════════════════════════════════════════════════════
//
// Run with:  npm run db:seed   (from the backend/ folder)
// Run AFTER: npm run db:init
// Safe to run multiple times — existing product names are skipped.
// ════════════════════════════════════════════════════════════════

const Database = require('better-sqlite3');
const path         = require('path');
const dotenv       = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

// ── Sample products — 4 categories, 15 products ───────────────
const PRODUCTS = [
  // ELECTRONICS
  { name: 'Wireless Noise-Cancelling Headphones', description: 'Over-ear wireless headphones with three levels of active noise cancellation, 38-hour battery life, and a foldable design. Built-in mic for calls. Compatible with Bluetooth 5.0.', price: 79.99, image_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600', category: 'Electronics', stock: 25 },
  { name: 'Compact Mechanical Keyboard', description: 'Tenkeyless mechanical keyboard with tactile brown switches. Per-key RGB backlighting with 18 preset effects. Detachable USB-C cable included.', price: 49.99, image_url: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600', category: 'Electronics', stock: 15 },
  { name: 'Portable Wireless Speaker', description: 'Rugged 360-degree wireless speaker with IPX6 waterproofing. Bluetooth 5.2 with 20-metre range and 16-hour playtime. Charges via USB-C.', price: 39.99, image_url: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=600', category: 'Electronics', stock: 30 },
  { name: 'Wireless Charging Pad (15W)', description: 'Slim 15W fast wireless charging pad for all Qi-enabled devices. Anti-slip silicone surface, LED charging indicator, 1.5m braided USB-C cable included.', price: 24.99, image_url: 'https://images.unsplash.com/photo-1583863788434-e62bd5f60f72?w=600', category: 'Electronics', stock: 40 },
  // ACCESSORIES
  { name: 'Stainless Steel Minimalist Watch', description: 'Clean-dial analogue watch with brushed stainless steel case and genuine leather strap. Japanese quartz movement, 3ATM water resistance, slim 7mm profile.', price: 89.99, image_url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600', category: 'Accessories', stock: 18 },
  { name: 'Polarised Aviator Sunglasses', description: 'Classic teardrop aviator frames with polarised lenses for glare reduction. UV400 protection, lightweight aluminium frame, adjustable nose pads. Hard case included.', price: 34.99, image_url: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=600', category: 'Accessories', stock: 35 },
  { name: 'RFID-Blocking Slim Wallet', description: 'Ultra-thin bifold wallet from full-grain leather with RFID shielding. Holds 8 cards. Measures 8mm when empty. Available in tan, black, and navy.', price: 29.99, image_url: 'https://images.unsplash.com/photo-1627123424574-724758594785?w=600', category: 'Accessories', stock: 50 },
  { name: 'Canvas Tote Bag with Zip', description: 'Heavyweight 12oz canvas tote with main zip compartment and two internal pockets. Reinforced straps rated to 15kg. Machine washable.', price: 22.99, image_url: 'https://images.unsplash.com/photo-1591561954557-26941169b49e?w=600', category: 'Accessories', stock: 60 },
  // HOME
  { name: 'Adjustable LED Desk Lamp', description: 'Multi-joint LED lamp with 5 brightness levels and 3 colour temperatures. Built-in USB-A charging port. Energy-efficient at only 12W.', price: 34.99, image_url: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=600', category: 'Home', stock: 30 },
  { name: 'Vacuum-Insulated Water Bottle (750ml)', description: 'Double-wall stainless bottle keeps drinks cold 24h, hot 12h. Leak-proof lid, wide mouth, BPA-free. Fits most car cup holders and bike cages.', price: 19.99, image_url: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600', category: 'Home', stock: 55 },
  { name: 'Scented Soy Candle Set (3 Pack)', description: 'Three hand-poured soy candles: lavender & cedar, warm vanilla, fresh eucalyptus. Each burns 45 hours cleanly. Natural cotton wicks, gift-ready kraft box.', price: 27.99, image_url: 'https://images.unsplash.com/photo-1602028915047-37269d1a73f7?w=600', category: 'Home', stock: 45 },
  { name: 'Extra-Large Bamboo Cutting Board', description: 'Sustainably sourced bamboo board, 45×30cm. Deep juice groove, smooth edge-friendly surface. Non-slip rubber feet. Hand wash recommended.', price: 32.99, image_url: 'https://images.unsplash.com/photo-1585515320310-259814833e62?w=600', category: 'Home', stock: 28 },
  // LIFESTYLE
  { name: 'Non-Slip Yoga Mat (6mm)', description: 'Extra-thick 6mm yoga mat with moisture-wicking surface and secure grip. Closed-cell construction. Includes carry strap. Dimensions: 183×61cm.', price: 44.99, image_url: 'https://images.unsplash.com/photo-1601925228054-a01a61c72a5e?w=600', category: 'Lifestyle', stock: 22 },
  { name: 'Hardcover Dotted Journal (A5)', description: 'A5 hardcover with 200 pages of 100gsm dotted paper. Ribbon bookmark, elastic closure, pen loop. Great for bullet journaling, sketching, and daily notes.', price: 17.99, image_url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600', category: 'Lifestyle', stock: 65 },
  { name: 'Resistance Band Set (5 Levels)', description: "Five latex resistance bands: 5kg to 25kg. Smooth finish, won't snag clothing. For stretching, strength training, and physiotherapy. Zippered carry pouch included.", price: 24.99, image_url: 'https://images.unsplash.com/photo-1598289431512-b97b0917affc?w=600', category: 'Lifestyle', stock: 38 },
];

function seed() {
  console.log('');
  console.log('  ╔══════════════════════════════════════╗');
  console.log('  ║      NovaCart Database Seeder  🌱    ║');
  console.log('  ╚══════════════════════════════════════╝');

  const dbPath = path.resolve(__dirname, '..', process.env.DB_PATH || './novacart.db');
  if (process.env.DATABASE_URL || process.env.NODE_ENV === 'production') {
    throw new Error('The sample seeder is SQLite-local and refuses to run when DATABASE_URL is configured.');
  }

  const db = new Database(dbPath);

  const checkStmt  = db.prepare('SELECT id FROM products WHERE name = ?');
  const insertStmt = db.prepare(
    'INSERT INTO products (name, description, price, image_url, category, stock) VALUES (?, ?, ?, ?, ?, ?)'
  );

  let inserted = 0, skipped = 0;
  console.log('');

  for (const p of PRODUCTS) {
    const exists = checkStmt.get(p.name);
    if (exists) {
      console.log(`   ⏭️  Skipped  : ${p.name}`);
      skipped++;
    } else {
      const info = insertStmt.run(p.name, p.description, p.price, p.image_url, p.category, p.stock);
      console.log(`   ✅ Inserted : [${p.category}] ${p.name} — $${p.price} (id: ${info.lastInsertRowid})`);
      inserted++;
    }
  }

  const total  = db.prepare('SELECT COUNT(*) AS total FROM products').get().total;
  const byCat  = db.prepare('SELECT category, COUNT(*) AS count FROM products GROUP BY category ORDER BY category').all();

  console.log('\n  ─────────────────────────────────────');
  console.log(`  Inserted : ${inserted}   Skipped: ${skipped}`);
  console.log(`  Total in DB : ${total} products`);
  console.log('\n  By category:');
  byCat.forEach(r => console.log(`    ${r.category.padEnd(14)} ${r.count} product(s)`));
  console.log('  ─────────────────────────────────────');

  db.close();
  console.log('\n🎉 Seeding complete! Start the server with: npm run dev\n');
}

try {
  seed();
} catch (err) {
  console.error('\n❌ Seeding failed:', err.message);
  console.error('   Make sure you have run "npm run db:init" first.\n');
  process.exit(1);
}
