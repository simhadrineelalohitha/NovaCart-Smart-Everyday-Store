// ════════════════════════════════════════════════════════════════
// scripts/initDb.js — Create DB tables from schema.sql
// ════════════════════════════════════════════════════════════════
//
// Run with:  npm run db:init   (from the backend/ folder)
// Safe to run multiple times — all tables use IF NOT EXISTS.
// ════════════════════════════════════════════════════════════════

const { Database } = require('node-sqlite3-wasm');
const fs           = require('fs');
const path         = require('path');
const dotenv       = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const dbPath     = path.resolve(__dirname, '..', process.env.DB_PATH || './novacart.db');
const schemaPath = path.join(__dirname, '../models/schema.sql');

console.log('');
console.log('  ╔══════════════════════════════════════╗');
console.log('  ║   NovaCart Database Initialiser  🗄️   ║');
console.log('  ╚══════════════════════════════════════╝');
console.log('');
console.log('  DB file :', dbPath);

const db = new Database(dbPath);
db.exec('PRAGMA foreign_keys = ON');

const sql = fs.readFileSync(schemaPath, 'utf8');
db.exec(sql);

// List tables
const tables = db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
).all([]);

console.log('\n✅ Schema applied! Tables created:');
tables.forEach(t => console.log(`   • ${t.name}`));

db.close();
console.log('\n🎉 Done! Run "npm run db:seed" to add sample products.\n');
