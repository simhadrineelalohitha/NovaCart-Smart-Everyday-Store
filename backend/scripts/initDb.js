// ════════════════════════════════════════════════════════════════
// scripts/initDb.js — Apply the schema to the configured database
// ════════════════════════════════════════════════════════════════
//
// Run with:  npm run db:init   (from the backend/ folder)
// Safe to run multiple times — all tables use IF NOT EXISTS.
// ════════════════════════════════════════════════════════════════

const Database = require('better-sqlite3');
const fs           = require('fs');
const path         = require('path');
const dotenv       = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function initialize() {
  if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required in production; refusing to initialize SQLite.');
  }

  if (process.env.DATABASE_URL) {
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED === 'false' ? false : true }
        : undefined,
    });
    try {
      await pool.query(fs.readFileSync(path.join(__dirname, '../models/schema.sql'), 'utf8'));
      const result = await pool.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = current_schema()
        ORDER BY table_name
      `);
      console.log(`PostgreSQL schema applied. Tables: ${result.rows.map(row => row.table_name).join(', ')}`);
    } finally {
      await pool.end();
    }
    return;
  }

  const dbPath = path.resolve(__dirname, '..', process.env.DB_PATH || './novacart.db');
  const db = new Database(dbPath);
  try {
    db.exec(fs.readFileSync(path.join(__dirname, '../models/schema.sqlite.sql'), 'utf8'));
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all();
    console.log(`SQLite schema applied to ${dbPath}. Tables: ${tables.map(table => table.name).join(', ')}`);
  } finally {
    db.close();
  }
}

initialize().catch(error => {
  console.error(`Database schema initialization failed: ${error.message}`);
  process.exitCode = 1;
});
