const path = require('path');
const dotenv = require('dotenv');
const Database = require('better-sqlite3');
const { Pool } = require('pg');

dotenv.config({ path: path.join(__dirname, '../.env') });

const USER_COLUMNS = ['name', 'email', 'password_hash', 'role', 'google_sub', 'avatar_url', 'created_at'];
const PRODUCT_COLUMNS = [
  'source_product_id', 'name', 'description', 'price', 'image_url', 'category', 'stock',
  'subcategory', 'brand', 'variant_specification', 'mrp_inr', 'discount_percent',
  'quality', 'rating_stars', 'review_count', 'manufacturing_date', 'expiry_date',
  'voltage', 'power_rating', 'age_range', 'warranty', 'seller', 'country_of_origin',
  'return_period_days', 'product_status', 'created_at',
];
const BATCH_SIZE = 100;

function toPostgresRows(rows, columns) {
  let parameter = 0;
  const values = [];
  const tuples = rows.map(row => {
    const placeholders = columns.map(column => {
      values.push(row[column]);
      return `$${++parameter}`;
    });
    return `(${placeholders.join(', ')})`;
  });
  return { tuples, values };
}

async function verifyTargetTable(client, table, requiredColumns, uniqueColumn) {
  const columnsResult = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = $1
  `, [table]);
  const columns = new Set(columnsResult.rows.map(row => row.column_name));
  const missing = requiredColumns.filter(column => !columns.has(column));
  if (missing.length) {
    throw new Error(`Existing PostgreSQL ${table} table is missing required columns: ${missing.join(', ')}. No rows were inserted.`);
  }

  const idResult = await client.query(`
    SELECT column_default, is_identity
    FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = $1 AND column_name = 'id'
  `, [table]);
  const idColumn = idResult.rows[0];
  if (!idColumn || (!idColumn.column_default && idColumn.is_identity !== 'YES')) {
    throw new Error(`Existing PostgreSQL ${table}.id must generate IDs automatically. No rows were inserted.`);
  }

  const uniqueResult = await client.query(`
    SELECT EXISTS (
      SELECT 1
      FROM pg_index i
      JOIN pg_class t ON t.oid = i.indrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(i.indkey)
      WHERE n.nspname = current_schema()
        AND t.relname = $1
        AND i.indisunique
        AND i.indisvalid
        AND i.indnatts = 1
        AND i.indpred IS NULL
        AND a.attname = $2
    ) AS has_unique_key
  `, [table, uniqueColumn]);
  if (!uniqueResult.rows[0].has_unique_key) {
    throw new Error(`Existing PostgreSQL ${table} table must have a unique ${uniqueColumn} key. No rows were inserted.`);
  }
}

async function migrate() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required. No database was created or changed.');
  }

  const sqlitePath = path.resolve(__dirname, '..', process.env.DB_PATH || './novacart.db');
  const sqlite = new Database(sqlitePath, { readonly: true, fileMustExist: true });
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED === 'false' ? false : true }
      : undefined,
  });

  try {
    const sourceColumns = new Set(sqlite.prepare('PRAGMA table_info(products)').all().map(row => row.name));
    const missingSourceColumns = PRODUCT_COLUMNS.filter(column => !sourceColumns.has(column));
    if (missingSourceColumns.length) {
      throw new Error(`SQLite source products table is missing columns: ${missingSourceColumns.join(', ')}.`);
    }

    const sourceRows = sqlite.prepare(`
      SELECT ${PRODUCT_COLUMNS.join(', ')}
      FROM products
      ORDER BY id
    `).all();
    const sourceCount = sqlite.prepare('SELECT COUNT(*) AS count FROM products').get().count;
    if (sourceRows.length !== sourceCount) throw new Error('Could not read every source product row.');
    const sourceUsers = sqlite.prepare(`
      SELECT ${USER_COLUMNS.join(', ')}
      FROM users
      ORDER BY id
    `).all();

    const invalidRows = sourceRows.filter(row =>
      !row.source_product_id || !String(row.source_product_id).trim()
      || !row.name || !String(row.name).trim()
      || !Number.isFinite(Number(row.price)) || Number(row.price) < 0
      || !Number.isInteger(Number(row.stock)) || Number(row.stock) < 0
    );
    const validRows = sourceRows.filter(row => !invalidRows.includes(row));
    const sourceIds = new Set(validRows.map(row => String(row.source_product_id)));
    if (sourceIds.size !== validRows.length) {
      throw new Error('SQLite source has duplicate source_product_id values; no rows were inserted.');
    }
    const invalidUsers = sourceUsers.filter(user =>
      !user.name || !String(user.name).trim()
      || !user.email || !String(user.email).trim()
      || !user.password_hash || !String(user.password_hash).trim()
      || !['user', 'admin'].includes(user.role || 'user')
    );
    const validUsers = sourceUsers.filter(user => !invalidUsers.includes(user));

    const client = await pool.connect();
    let inserted = 0;
    let alreadyPresent = 0;
    let usersInserted = 0;
    try {
      await client.query('BEGIN');
      await client.query('SELECT 1');
      await verifyTargetTable(client, 'users', ['id', ...USER_COLUMNS], 'email');
      await verifyTargetTable(client, 'products', ['id', ...PRODUCT_COLUMNS], 'source_product_id');

      for (let offset = 0; offset < validUsers.length; offset += BATCH_SIZE) {
        const rows = validUsers.slice(offset, offset + BATCH_SIZE);
        const { tuples, values } = toPostgresRows(rows, USER_COLUMNS);
        const result = await client.query(`
          INSERT INTO users (${USER_COLUMNS.join(', ')})
          VALUES ${tuples.join(', ')}
          ON CONFLICT (email) DO NOTHING
          RETURNING email
        `, values);
        usersInserted += result.rowCount;
      }

      for (let offset = 0; offset < validRows.length; offset += BATCH_SIZE) {
        const rows = validRows.slice(offset, offset + BATCH_SIZE);
        const { tuples, values } = toPostgresRows(rows, PRODUCT_COLUMNS);
        const result = await client.query(`
          INSERT INTO products (${PRODUCT_COLUMNS.join(', ')})
          VALUES ${tuples.join(', ')}
          ON CONFLICT (source_product_id) DO NOTHING
          RETURNING source_product_id
        `, values);
        inserted += result.rowCount;
      }

      const countResult = await client.query('SELECT COUNT(*)::integer AS count FROM products');
      const finalCount = countResult.rows[0].count;
      const userCountResult = await client.query('SELECT COUNT(*)::integer AS count FROM users');
      const finalUserCount = userCountResult.rows[0].count;
      alreadyPresent = validRows.length - inserted;
      await client.query('COMMIT');

      console.log(`SQLite source rows: ${sourceCount}`);
      console.log(`Inserted: ${inserted}`);
      console.log(`Already present / duplicate source IDs skipped: ${alreadyPresent}`);
      console.log(`Invalid source rows skipped: ${invalidRows.length}`);
      console.log(`Final PostgreSQL products count: ${finalCount}`);
      console.log(`SQLite source users: ${sourceUsers.length}`);
      console.log(`Users inserted: ${usersInserted}; existing email matches skipped: ${validUsers.length - usersInserted}; invalid users skipped: ${invalidUsers.length}`);
      console.log(`Final PostgreSQL users count: ${finalUserCount}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } finally {
    sqlite.close();
    await pool.end();
  }
}

migrate().catch(error => {
  console.error(`SQLite-to-PostgreSQL migration failed: ${error.message}`);
  process.exitCode = 1;
});
