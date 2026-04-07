// src/config/database.js
// PostgreSQL connection pool using the 'pg' library
// Uses a connection pool (max 20 connections) for production efficiency

const { Pool } = require('pg');

// Create a connection pool - reuses DB connections instead of opening a new one each time
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://neondb_owner:npg_oWuDNsYTC31Z@ep-dry-cell-ansdg7vt.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require",
  max: 20,
  idleTimeoutMillis: 45000,
  connectionTimeoutMillis: 40000,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Test the connection when the app starts
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Database connection warning (Cold Start):', err.message);
    if (release) release();
    return;
  }
  release();
  console.log('✅ Database connected successfully');
});

// Helper: run a parameterized query
// Usage: db.query('SELECT * FROM users WHERE id = $1', [userId])
const query = (text, params) => pool.query(text, params);

// Helper: get a client for transactions
const getClient = () => pool.connect();

module.exports = { query, getClient, pool };
