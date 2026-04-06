require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  try {
    console.log('Reading schema.sql...');
    const sql = fs.readFileSync(path.join(__dirname, 'src', 'config', 'schema.sql'), 'utf8');
    console.log('Executing schema...');
    await pool.query(sql);
    console.log('✅ Migration successful');
  } catch (err) {
    console.error('❌ Migration failed', err);
    process.exit(1);
  } finally {
    pool.end();
  }
}

migrate();
