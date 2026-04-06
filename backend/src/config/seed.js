// src/config/seed.js
// Populates the database with realistic demo projects across India
// Run with: node src/config/seed.js

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const SEED_PROJECTS = [
  {
    name: 'Rajiv Gandhi Government Primary School - Block C',
    description: 'Construction of 8 new classrooms, 2 labs, and sanitation facilities',
    category: 'education',
    latitude: 12.9716, longitude: 77.5946,
    address: 'Bengaluru South, Karnataka',
    start_date: '2024-01-15', expected_end_date: '2024-12-31',
    budget: 4500000, budget_spent: 2100000,
    completion_percentage: 48, labor_count: 65, status: 'active',
    delay_risk_score: 0.32,
  },
  {
    name: 'PHC Upgrade - Vadodara District',
    description: 'Upgrading Primary Health Centre with OPD block, maternity ward, and pharmacy',
    category: 'healthcare',
    latitude: 22.3072, longitude: 73.1812,
    address: 'Vadodara, Gujarat',
    start_date: '2023-08-01', expected_end_date: '2025-03-31',
    budget: 12000000, budget_spent: 8900000,
    completion_percentage: 74, labor_count: 88, status: 'active',
    delay_risk_score: 0.71,
  },
  {
    name: 'NH-44 Bypass Road - Nagpur Section',
    description: '14.2 km 4-lane bypass road with flyovers at 3 major intersections',
    category: 'road',
    latitude: 21.1458, longitude: 79.0882,
    address: 'Nagpur, Maharashtra',
    start_date: '2023-03-01', expected_end_date: '2025-06-30',
    budget: 85000000, budget_spent: 52000000,
    completion_percentage: 61, labor_count: 240, status: 'active',
    delay_risk_score: 0.55,
  },
  {
    name: 'Rural Water Supply Scheme - 12 Villages',
    description: 'Piped water supply to 12 villages covering 18,000 households in Rajasthan',
    category: 'water',
    latitude: 26.9124, longitude: 75.7873,
    address: 'Jaipur Rural, Rajasthan',
    start_date: '2024-04-01', expected_end_date: '2025-09-30',
    budget: 28000000, budget_spent: 7800000,
    completion_percentage: 28, labor_count: 110, status: 'active',
    delay_risk_score: 0.43,
  },
  {
    name: 'Solar Microgrid - Tribal Hamlet Electrification',
    description: '250 kW solar microgrid with battery storage for 8 tribal hamlets',
    category: 'electricity',
    latitude: 20.2961, longitude: 85.8245,
    address: 'Sundargarh, Odisha',
    start_date: '2024-06-01', expected_end_date: '2024-11-30',
    budget: 9500000, budget_spent: 9700000,
    completion_percentage: 100, labor_count: 0, status: 'completed',
    delay_risk_score: 0.05,
  },
  {
    name: 'Affordable Housing Complex - EWS Phase 2',
    description: '480 EWS units under PM Awas Yojana with community hall and children\'s park',
    category: 'housing',
    latitude: 17.3850, longitude: 78.4867,
    address: 'Hyderabad, Telangana',
    start_date: '2023-11-01', expected_end_date: '2025-10-31',
    budget: 62000000, budget_spent: 18000000,
    completion_percentage: 29, labor_count: 185, status: 'active',
    delay_risk_score: 0.62,
  },
  {
    name: 'Kendriya Vidyalaya Expansion - Science Block',
    description: 'New 3-storey science block with 12 labs, library, and ICT centre',
    category: 'education',
    latitude: 28.6139, longitude: 77.2090,
    address: 'New Delhi',
    start_date: '2024-03-01', expected_end_date: '2025-02-28',
    budget: 7800000, budget_spent: 4100000,
    completion_percentage: 52, labor_count: 72, status: 'active',
    delay_risk_score: 0.28,
  },
  {
    name: 'District Hospital - New OPD & ICU Wing',
    description: '200-bed expansion with dedicated ICU, trauma centre, and diagnostic lab',
    category: 'healthcare',
    latitude: 13.0827, longitude: 80.2707,
    address: 'Chennai, Tamil Nadu',
    start_date: '2023-05-01', expected_end_date: '2025-04-30',
    budget: 45000000, budget_spent: 38000000,
    completion_percentage: 85, labor_count: 130, status: 'active',
    delay_risk_score: 0.18,
  },
  {
    name: 'Smart Road Resurfacing - City Ring Road',
    description: 'Complete resurfacing of 32 km ring road with smart traffic signal integration',
    category: 'road',
    latitude: 23.0225, longitude: 72.5714,
    address: 'Ahmedabad, Gujarat',
    start_date: '2024-07-01', expected_end_date: '2025-01-31',
    budget: 22000000, budget_spent: 3200000,
    completion_percentage: 15, labor_count: 95, status: 'active',
    delay_risk_score: 0.84,
  },
  {
    name: 'Sewage Treatment Plant - 50 MLD Capacity',
    description: 'New STP with tertiary treatment for recycled water supply to industries',
    category: 'water',
    latitude: 18.5204, longitude: 73.8567,
    address: 'Pune, Maharashtra',
    start_date: '2024-01-01', expected_end_date: '2024-06-30',
    budget: 31000000, budget_spent: 31500000,
    completion_percentage: 100, labor_count: 0, status: 'completed',
    delay_risk_score: 0.02,
  },
];

const PROGRESS_LOGS = [
  // Project 1 - School
  { project_idx: 0, completion_percentage: 10, notes: 'Foundation work completed', labor_count: 50, days_ago: 120 },
  { project_idx: 0, completion_percentage: 22, notes: 'Ground floor columns poured', labor_count: 65, days_ago: 90 },
  { project_idx: 0, completion_percentage: 35, notes: 'First floor slab completed. Minor delay due to rain', labor_count: 60, days_ago: 60 },
  { project_idx: 0, completion_percentage: 48, notes: 'Second floor brickwork in progress', labor_count: 65, days_ago: 3 },

  // Project 2 - PHC
  { project_idx: 1, completion_percentage: 20, notes: 'Site levelling and foundation complete', labor_count: 70, days_ago: 200 },
  { project_idx: 1, completion_percentage: 45, notes: 'OPD block structure complete', labor_count: 88, days_ago: 120 },
  { project_idx: 1, completion_percentage: 74, notes: 'Maternity ward interior work started. Equipment procurement pending.', labor_count: 88, days_ago: 10 },

  // Project 3 - Road
  { project_idx: 2, completion_percentage: 15, notes: 'Land acquisition completed. Earthwork started.', labor_count: 180, days_ago: 400 },
  { project_idx: 2, completion_percentage: 35, notes: 'Sub-base layer done for 6km stretch', labor_count: 220, days_ago: 250 },
  { project_idx: 2, completion_percentage: 61, notes: 'Flyover 1 construction at 80%. Asphalt layer done for 9km.', labor_count: 240, days_ago: 5 },
];

async function seed() {
  const client = await pool.connect();
  try {
    console.log('🌱 Starting database seed...\n');
    await client.query('BEGIN');

    // Ensure admin user exists
    const passwordHash = await bcrypt.hash('password123', 10);
    const adminResult = await client.query(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES ($1, $2, $3, 'admin')
      ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash
      RETURNING id`,
      ['Admin User', 'admin@infra.gov', passwordHash]
    );
    const adminId = adminResult.rows[0].id;

    // Create engineer accounts
    const engineerResult = await client.query(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES ($1, $2, $3, 'engineer')
      ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash
      RETURNING id`,
      ['Ravi Kumar', 'ravi@infra.gov', passwordHash]
    );
    const engineerId = engineerResult.rows[0].id;

    await client.query(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES ($1, $2, $3, 'viewer')
      ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash`,
      ['District Viewer', 'viewer@district.gov', passwordHash]
    );

    console.log('✅ Users seeded (admin, engineer, viewer)\n');

    // Insert projects
    const projectIds = [];
    for (const proj of SEED_PROJECTS) {
      const r = await client.query(`
        INSERT INTO projects (
          name, description, category, latitude, longitude,
          location, address, start_date, expected_end_date,
          budget, budget_spent, completion_percentage, labor_count,
          status, delay_risk_score, created_by, assigned_engineer_id
        ) VALUES (
          $1,$2,$3,$4::numeric,$5::numeric,
          ST_SetSRID(ST_MakePoint(CAST($5 AS float8), CAST($4 AS float8)), 4326),
          $6,$7,$8,$9,$10,$11,$12,$13,$14,
          $15,$16
        )
        ON CONFLICT DO NOTHING
        RETURNING id`,
        [
          proj.name, proj.description, proj.category,
          proj.latitude, proj.longitude, proj.address,
          proj.start_date, proj.expected_end_date,
          proj.budget, proj.budget_spent,
          proj.completion_percentage, proj.labor_count,
          proj.status, proj.delay_risk_score,
          adminId, engineerId
        ]
      );
      projectIds.push(r.rows[0]?.id);
      console.log(`  📍 ${proj.name}`);
    }

    // Insert progress logs
    console.log('\n✅ Projects seeded. Adding progress logs...\n');
    for (const log of PROGRESS_LOGS) {
      const projId = projectIds[log.project_idx];
      if (!projId) continue;
      const logDate = new Date();
      logDate.setDate(logDate.getDate() - log.days_ago);

      await client.query(`
        INSERT INTO progress_logs (
          project_id, engineer_id, log_date,
          completion_percentage, notes, labor_count, is_synced
        ) VALUES ($1,$2,$3,$4,$5,$6,true)`,
        [projId, engineerId, logDate.toISOString().split('T')[0],
         log.completion_percentage, log.notes, log.labor_count]
      );
    }

    await client.query('COMMIT');
    console.log('✅ Progress logs seeded');
    console.log('\n🎉 Database seeded successfully!\n');
    console.log('Demo credentials (password: password123):');
    console.log('  Admin:    admin@infra.gov');
    console.log('  Engineer: ravi@infra.gov');
    console.log('  Viewer:   viewer@district.gov\n');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

seed();
