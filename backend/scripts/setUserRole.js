const path = require('path');
const dotenv = require('dotenv');
const db = require('../config/db');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function run() {
  const email = String(process.argv[2] || '').trim().toLowerCase();
  const role = String(process.argv[3] || '').trim().toLowerCase();
  if (!email || !['user', 'admin'].includes(role)) {
    throw new Error('Usage: node scripts/setUserRole.js <email> <user|admin>');
  }

  const result = await db.query('UPDATE users SET role = ? WHERE email = ?', [role, email]);
  if (result.rowCount === 0) throw new Error(`No user found for ${email}.`);
  console.log(`Updated ${email} to role ${role}.`);
  await db.close();
}

run().catch(async error => {
  console.error(`Role update failed: ${error.message}`);
  await db.close();
  process.exitCode = 1;
});
