// src/controllers/projectController.js
// Full CRUD for infrastructure projects with geospatial support

const { validationResult } = require('express-validator');
const db = require('../config/database');

// -------------------------------------------------------
// GET /api/projects
// Returns all projects (with optional filters)
// Supports: ?status=active&category=healthcare&engineer_id=uuid
// -------------------------------------------------------
const getAllProjects = async (req, res) => {
  try {
    const { status, category, engineer_id, bbox } = req.query;

    // Build dynamic WHERE clause
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (status) {
      conditions.push(`p.status = $${paramIndex++}`);
      params.push(status);
    }
    if (category) {
      conditions.push(`p.category = $${paramIndex++}`);
      params.push(category);
    }
    if (engineer_id) {
      conditions.push(`p.assigned_engineer_id = $${paramIndex++}`);
      params.push(engineer_id);
    }
    // Bounding box filter: bbox=minLon,minLat,maxLon,maxLat
    if (bbox) {
      const [minLon, minLat, maxLon, maxLat] = bbox.split(',').map(Number);
      conditions.push(
        `ST_Within(p.location, ST_MakeEnvelope($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, 4326))`
      );
      params.push(minLon, minLat, maxLon, maxLat);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await db.query(
      `SELECT
        p.id, p.name, p.description, p.category, p.status,
        p.latitude, p.longitude, p.address,
        p.start_date, p.expected_end_date, p.actual_end_date,
        p.budget, p.budget_spent, p.completion_percentage,
        p.labor_count, p.predicted_end_date, p.delay_risk_score,
        p.created_at, p.updated_at,
        u.name AS engineer_name, u.email AS engineer_email,
        c.name AS creator_name,
        -- Days remaining (negative = overdue)
        (p.expected_end_date - CURRENT_DATE) AS days_remaining,
        -- Latest progress log date
        (SELECT MAX(log_date) FROM progress_logs WHERE project_id = p.id) AS last_update
       FROM projects p
       LEFT JOIN users u ON p.assigned_engineer_id = u.id
       LEFT JOIN users c ON p.created_by = c.id
       ${whereClause}
       ORDER BY p.created_at DESC`,
      params
    );

    res.json({ success: true, count: result.rows.length, projects: result.rows });
  } catch (err) {
    console.error('Get projects error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch projects.' });
  }
};

// -------------------------------------------------------
// GET /api/projects/:id
// Returns a single project with full details
// -------------------------------------------------------
const getProjectById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT
        p.*,
        u.name AS engineer_name, u.email AS engineer_email,
        -- Convert polygon boundary to GeoJSON for frontend map rendering
        ST_AsGeoJSON(p.boundary)::json AS boundary_geojson,
        (p.expected_end_date - CURRENT_DATE) AS days_remaining
       FROM projects p
       LEFT JOIN users u ON p.assigned_engineer_id = u.id
       WHERE p.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    // Fetch recent progress logs for this project
    const logsResult = await db.query(
      `SELECT pl.*, u.name AS engineer_name,
        array_agg(pi.file_path) FILTER (WHERE pi.file_path IS NOT NULL) AS images
       FROM progress_logs pl
       LEFT JOIN users u ON pl.engineer_id = u.id
       LEFT JOIN progress_images pi ON pi.progress_log_id = pl.id
       WHERE pl.project_id = $1
       GROUP BY pl.id, u.name
       ORDER BY pl.log_date DESC
       LIMIT 10`,
      [id]
    );

    res.json({
      success: true,
      project: result.rows[0],
      recentLogs: logsResult.rows
    });
  } catch (err) {
    console.error('Get project error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch project.' });
  }
};

// -------------------------------------------------------
// POST /api/projects
// Creates a new infrastructure project
// -------------------------------------------------------
const createProject = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const {
      name, description, category, latitude, longitude, address,
      start_date, expected_end_date, budget, assigned_engineer_id,
      boundary_coordinates  // optional: array of [lng, lat] pairs for polygon
    } = req.body;

    // Build PostGIS POINT from coordinates
    // ST_SetSRID(ST_MakePoint(lng, lat), 4326) creates a GPS point
    let boundarySQL = null;
    if (boundary_coordinates && boundary_coordinates.length >= 3) {
      // Ensure polygon is closed (first = last point)
      const coords = [...boundary_coordinates];
      if (JSON.stringify(coords[0]) !== JSON.stringify(coords[coords.length - 1])) {
        coords.push(coords[0]);
      }
      const coordStr = coords.map(([lng, lat]) => `${lng} ${lat}`).join(', ');
      boundarySQL = `ST_GeomFromText('POLYGON((${coordStr}))', 4326)`;
    }

    const result = await db.query(
      `INSERT INTO projects (
        name, description, category, latitude, longitude,
        location, address, start_date, expected_end_date,
        budget, assigned_engineer_id, created_by, boundary
       ) VALUES (
        $1, $2, $3, $4, $5,
        ST_SetSRID(ST_MakePoint(CAST($5 AS numeric)::float8, CAST($4 AS numeric)::float8), 4326),
        $6, $7, $8, $9, $10, $11,
        ${boundarySQL ? boundarySQL : 'NULL'}
       )
       RETURNING id, name, category, status, latitude, longitude, start_date, expected_end_date, created_at`,
      [name, description, category, latitude.toString(), longitude.toString(),
       address, start_date, expected_end_date, budget || 0,
       assigned_engineer_id || null, req.user.id]
    );

    // Audit log
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'project.created', 'project', $2, $3)`,
      [req.user.id, result.rows[0].id, JSON.stringify({ name, category })]
    );

    res.status(201).json({
      success: true,
      message: 'Project created successfully.',
      project: result.rows[0]
    });
  } catch (err) {
    console.error('Create project error:', err);
    res.status(500).json({ success: false, message: 'Failed to create project.' });
  }
};

// -------------------------------------------------------
// PUT /api/projects/:id
// Updates an existing project
// -------------------------------------------------------
const updateProject = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { id } = req.params;

    // Only admin or assigned engineer can update
    const projectCheck = await db.query(
      'SELECT id, assigned_engineer_id, created_by FROM projects WHERE id = $1', [id]
    );
    if (projectCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    const project = projectCheck.rows[0];
    const isAdmin = req.user.role === 'admin';
    const isAssignedEngineer = project.assigned_engineer_id === req.user.id;

    if (!isAdmin && !isAssignedEngineer) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this project.' });
    }

    const {
      name, description, category, status, latitude, longitude,
      address, expected_end_date, actual_end_date, budget,
      budget_spent, assigned_engineer_id, labor_count
    } = req.body;

    const result = await db.query(
      `UPDATE projects SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        category = COALESCE($3, category),
        status = COALESCE($4, status),
        latitude = COALESCE($5, latitude),
        longitude = COALESCE($6, longitude),
        location = CASE WHEN $5 IS NOT NULL
          THEN ST_SetSRID(ST_MakePoint(CAST($6 AS numeric)::float8, CAST($5 AS numeric)::float8), 4326)
          ELSE location END,
        address = COALESCE($7, address),
        expected_end_date = COALESCE($8, expected_end_date),
        actual_end_date = COALESCE($9, actual_end_date),
        budget = COALESCE($10, budget),
        budget_spent = COALESCE($11, budget_spent),
        assigned_engineer_id = COALESCE($12, assigned_engineer_id),
        labor_count = COALESCE($13, labor_count)
       WHERE id = $14
       RETURNING id, name, status, completion_percentage, updated_at`,
      [name, description, category, status, latitude ? latitude.toString() : null, longitude ? longitude.toString() : null,
       address, expected_end_date, actual_end_date, budget,
       budget_spent, assigned_engineer_id, labor_count, id]
    );

    res.json({
      success: true,
      message: 'Project updated.',
      project: result.rows[0]
    });
  } catch (err) {
    console.error('Update project error:', err);
    res.status(500).json({ success: false, message: 'Failed to update project.' });
  }
};

// -------------------------------------------------------
// DELETE /api/projects/:id (admin only)
// -------------------------------------------------------
const deleteProject = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM projects WHERE id = $1 RETURNING id, name', [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id)
       VALUES ($1, 'project.deleted', 'project', $2)`,
      [req.user.id, id]
    );

    res.json({ success: true, message: 'Project deleted.', project: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete project.' });
  }
};

// -------------------------------------------------------
// GET /api/projects/stats/summary
// Dashboard statistics
// -------------------------------------------------------
const getStats = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status != 'cancelled') AS total_projects,
        COUNT(*) FILTER (WHERE status = 'active') AS active_projects,
        COUNT(*) FILTER (WHERE status = 'completed') AS completed_projects,
        COUNT(*) FILTER (WHERE status = 'on_hold') AS on_hold_projects,
        COUNT(*) FILTER (WHERE expected_end_date < CURRENT_DATE AND status != 'completed') AS overdue_projects,
        COUNT(*) FILTER (WHERE delay_risk_score > 0.7) AS high_risk_projects,
        ROUND(AVG(completion_percentage), 1) AS avg_completion,
        SUM(budget) AS total_budget,
        SUM(budget_spent) AS total_spent
      FROM projects
    `);

    const categoryBreakdown = await db.query(`
      SELECT category, COUNT(*) AS count,
        ROUND(AVG(completion_percentage), 1) AS avg_completion
      FROM projects
      WHERE status != 'cancelled'
      GROUP BY category
      ORDER BY count DESC
    `);

    const monthlyProgress = await db.query(`
      SELECT
        DATE_TRUNC('month', log_date) AS month,
        COUNT(DISTINCT project_id) AS projects_updated,
        ROUND(AVG(completion_percentage), 1) AS avg_completion
      FROM progress_logs
      WHERE log_date >= NOW() - INTERVAL '6 months'
      GROUP BY month
      ORDER BY month ASC
    `);

    res.json({
      success: true,
      stats: result.rows[0],
      categoryBreakdown: categoryBreakdown.rows,
      monthlyProgress: monthlyProgress.rows
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch stats.' });
  }
};

module.exports = {
  getAllProjects, getProjectById, createProject,
  updateProject, deleteProject, getStats
};
