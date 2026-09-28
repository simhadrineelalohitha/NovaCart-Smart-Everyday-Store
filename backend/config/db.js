// ════════════════════════════════════════════════════════════════
// config/db.js — SQLite Database (better-sqlite3)
// ════════════════════════════════════════════════════════════════
//
// better-sqlite3 provides synchronous SQLite access using native
// file locking, which supports serving API requests from this app.
//
//   db.prepare('SELECT * FROM products WHERE id = ?').get(id)
//   db.prepare('INSERT INTO t VALUES (?, ?)').run(a, b)
//   db.prepare('SELECT * FROM t').all()
//   db.transaction(fn)()   — run a synchronous transaction
// ════════════════════════════════════════════════════════════════

const Database = require('better-sqlite3');
const path         = require('path');
const dotenv       = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const dbPath = path.resolve(__dirname, '..', process.env.DB_PATH || './novacart.db');

// Open (or create) the SQLite database file
const rawDb = new Database(dbPath);
rawDb.exec('PRAGMA foreign_keys = ON');

console.log('✅ SQLite connected:', dbPath);

// ── Database wrapper ──────────────────────────────────────────
const db = {
  // better-sqlite3 statements use the spread-argument API expected by models.
  prepare(sql) {
    return rawDb.prepare(sql);
  },

  // exec(sql)  — run multiple statements (no params, used for schema/pragmas)
  exec(sql) {
    return rawDb.exec(sql);
  },

  // transaction(fn)  — wraps a function in BEGIN/COMMIT/ROLLBACK
  // Usage:  const tx = db.transaction(() => { ... }); tx();
  transaction(fn) {
    return rawDb.transaction(fn);
  },

  // close()  — close the database file
  close() {
    rawDb.close();
  },
};

module.exports = db;
