require('dotenv').config();
const db = require('./src/config/database');
(async () => {
  try {
    const res = await db.query(
      `INSERT INTO projects (
        name, description, category, latitude, longitude,
        location, address, start_date, expected_end_date,
        budget, assigned_engineer_id, created_by, boundary
       ) VALUES (
        $1, $2, $3, $4, $5,
        ST_SetSRID(ST_MakePoint(CAST($5 AS numeric)::float8, CAST($4 AS numeric)::float8), 4326),
        $6, $7, $8, $9, $10, $11, NULL
       ) RETURNING id`,
      ['Test Project', 'Desc', 'road', 10.123, 20.123, 'Addr', '2024-01-01', '2025-01-01', 5000, null, null]
    );
    console.log('SUCCESS:', res.rows[0].id);
  } catch (err) {
    console.log('CRASH MSG:', err.message);
    console.log('CRASH DTL:', err.detail);
  }
  process.exit();
})();
