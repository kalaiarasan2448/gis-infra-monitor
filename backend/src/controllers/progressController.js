// src/controllers/progressController.js
// Daily progress log management with image uploads

const path = require('path');
const db = require('../config/database');
const { validationResult } = require('express-validator');

// -------------------------------------------------------
// POST /api/progress
// Submit daily progress for a project
// Handles: text data + uploaded images
// -------------------------------------------------------
const createProgressLog = async (req, res) => {
  const client = await db.getClient();

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const {
      project_id, log_date, completion_percentage,
      notes, weather_condition, labor_count,
      materials_used, gps_lat, gps_lng, local_id
    } = req.body;

    // Verify project exists and engineer is assigned
    const projectCheck = await db.query(
      'SELECT id, assigned_engineer_id, status FROM projects WHERE id = $1',
      [project_id]
    );

    if (projectCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    const project = projectCheck.rows[0];

    // Engineers can only log for their assigned projects
    if (req.user.role === 'engineer' && project.assigned_engineer_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not assigned to this project.' });
    }

    if (project.status === 'completed' || project.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: `Cannot log progress for ${project.status} projects.`
      });
    }

    // Build GPS geometry if coordinates provided
    const gpsGeom = gps_lat && gps_lng
      ? `ST_SetSRID(ST_MakePoint(${parseFloat(gps_lng)}, ${parseFloat(gps_lat)}), 4326)`
      : 'NULL';

    // Start transaction - insert log + images atomically
    await client.query('BEGIN');

    const logResult = await client.query(
      `INSERT INTO progress_logs (
        project_id, engineer_id, log_date, completion_percentage,
        notes, weather_condition, labor_count, materials_used,
        gps_location, local_id
       ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        ${gpsGeom}, $9
       ) RETURNING *`,
      [
        project_id, req.user.id,
        log_date || new Date().toISOString().split('T')[0],
        completion_percentage, notes, weather_condition,
        labor_count || 0,
        materials_used ? JSON.stringify(materials_used) : null,
        local_id || null
      ]
    );

    const log = logResult.rows[0];

    // Insert uploaded images if any
    const imageRecords = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const imgResult = await client.query(
          `INSERT INTO progress_images (progress_log_id, file_path, file_name, file_size, mime_type)
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [log.id, `/uploads/${file.filename}`, file.originalname, file.size, file.mimetype]
        );
        imageRecords.push(imgResult.rows[0]);
      }
    }

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Progress logged successfully.',
      log: { ...log, images: imageRecords }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Progress log error:', err);
    res.status(500).json({ success: false, message: 'Failed to save progress log.' });
  } finally {
    client.release();
  }
};

// -------------------------------------------------------
// GET /api/progress/:projectId
// Get all progress logs for a project
// -------------------------------------------------------
const getProjectProgress = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const result = await db.query(
      `SELECT
        pl.*,
        u.name AS engineer_name,
        json_agg(
          json_build_object(
            'id', pi.id,
            'file_path', pi.file_path,
            'file_name', pi.file_name,
            'caption', pi.caption
          )
        ) FILTER (WHERE pi.id IS NOT NULL) AS images
       FROM progress_logs pl
       LEFT JOIN users u ON pl.engineer_id = u.id
       LEFT JOIN progress_images pi ON pi.progress_log_id = pl.id
       WHERE pl.project_id = $1
       GROUP BY pl.id, u.name
       ORDER BY pl.log_date DESC, pl.created_at DESC
       LIMIT $2 OFFSET $3`,
      [projectId, limit, offset]
    );

    // Count total for pagination
    const countResult = await db.query(
      'SELECT COUNT(*) FROM progress_logs WHERE project_id = $1',
      [projectId]
    );

    res.json({
      success: true,
      total: parseInt(countResult.rows[0].count),
      logs: result.rows
    });
  } catch (err) {
    console.error('Get progress error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch progress logs.' });
  }
};

// -------------------------------------------------------
// POST /api/progress/sync
// Bulk sync offline progress logs (offline-first support)
// Accepts array of logs that were created offline
// -------------------------------------------------------
const syncOfflineLogs = async (req, res) => {
  const client = await db.getClient();

  try {
    const { logs } = req.body; // array of progress log objects

    if (!Array.isArray(logs) || logs.length === 0) {
      return res.status(400).json({ success: false, message: 'No logs provided.' });
    }

    await client.query('BEGIN');

    const results = [];
    for (const log of logs) {
      // Skip if already synced (check by local_id)
      const existing = await client.query(
        'SELECT id FROM progress_logs WHERE local_id = $1 AND engineer_id = $2',
        [log.local_id, req.user.id]
      );

      if (existing.rows.length > 0) {
        results.push({ local_id: log.local_id, status: 'skipped', reason: 'already synced' });
        continue;
      }

      const insertResult = await client.query(
        `INSERT INTO progress_logs (
          project_id, engineer_id, log_date, completion_percentage,
          notes, weather_condition, labor_count, local_id, is_synced
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
         RETURNING id`,
        [log.project_id, req.user.id, log.log_date, log.completion_percentage,
         log.notes, log.weather_condition, log.labor_count || 0, log.local_id]
      );

      results.push({ local_id: log.local_id, server_id: insertResult.rows[0].id, status: 'synced' });
    }

    await client.query('COMMIT');

    res.json({ success: true, results, synced: results.filter(r => r.status === 'synced').length });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, message: 'Sync failed.' });
  } finally {
    client.release();
  }
};

module.exports = { createProgressLog, getProjectProgress, syncOfflineLogs };
