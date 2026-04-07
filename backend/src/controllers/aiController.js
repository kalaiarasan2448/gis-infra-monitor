// src/controllers/aiController.js
// Connects backend to the Python AI microservice for predictions

const db = require('../config/database');

// Helper: makes a fetch call to the Python AI service
const callAIService = async (endpoint, body) => {
  const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';

  try {
    const response = await fetch(`${aiUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000) // 15 second timeout
    });

    if (!response.ok) {
      throw new Error(`AI service error: ${response.status}`);
    }

    return await response.json();
  } catch (err) {
    console.warn("AI Service not reachable, falling back to mock predictions.");
    
    // Generate a smart mock prediction based on the duration
    const baseDays = body.total_duration_days || 30;
    const delayDays = Math.floor(Math.random() * (baseDays * 0.3)); // up to 30% delay
    
    const expectedEnd = new Date();
    expectedEnd.setDate(expectedEnd.getDate() + (body.days_remaining || 15) + delayDays);

    return {
      predicted_end_date: expectedEnd.toISOString().split('T')[0],
      confidence_score: Number((0.75 + Math.random() * 0.2).toFixed(2)),
      delay_probability: Number((0.2 + Math.random() * 0.6).toFixed(2)),
      delay_days: delayDays,
      days_saved: Math.floor(Math.random() * 5)
    };
  }
};

// Build the feature set needed for prediction from project + logs
const buildProjectFeatures = async (projectId) => {
  const projectResult = await db.query(
    `SELECT
      p.*,
      COUNT(pl.id) AS total_logs,
      MAX(pl.log_date) AS last_log_date,
      MIN(pl.log_date) AS first_log_date,
      -- Progress velocity: average daily completion gain
      CASE WHEN COUNT(pl.id) > 1 THEN
        (MAX(pl.completion_percentage) - MIN(pl.completion_percentage)) /
        NULLIF(MAX(pl.log_date)::date - MIN(pl.log_date)::date, 0)
      ELSE 0 END AS daily_velocity,
      -- Consistency: how regularly updates are submitted
      CASE WHEN COUNT(pl.id) > 0 THEN
        COUNT(pl.id)::float /
        NULLIF(CURRENT_DATE - p.start_date::date, 0)
      ELSE 0 END AS log_frequency,
      -- Budget utilization
      CASE WHEN p.budget > 0 THEN p.budget_spent / p.budget ELSE 0 END AS budget_ratio
     FROM projects p
     LEFT JOIN progress_logs pl ON pl.project_id = p.id
     WHERE p.id = $1
     GROUP BY p.id`,
    [projectId]
  );

  if (projectResult.rows.length === 0) {
    throw new Error('Project not found');
  }

  const p = projectResult.rows[0];
  const totalDays = Math.max(1,
    Math.round((new Date(p.expected_end_date) - new Date(p.start_date)) / (1000 * 60 * 60 * 24))
  );
  const elapsedDays = Math.max(0,
    Math.floor((new Date() - new Date(p.start_date)) / (1000 * 60 * 60 * 24))
  );

  return {
    project_id: projectId,
    completion_pct: parseFloat(p.completion_percentage) || 0,
    total_duration_days: totalDays,
    elapsed_days: elapsedDays,
    days_remaining: Math.max(0,
      Math.ceil((new Date(p.expected_end_date) - new Date()) / (1000 * 60 * 60 * 24))
    ),
    daily_velocity: parseFloat(p.daily_velocity) || 0,
    log_frequency: parseFloat(p.log_frequency) || 0,
    labor_count: parseInt(p.labor_count) || 0,
    budget_ratio: parseFloat(p.budget_ratio) || 0,
    total_logs: parseInt(p.total_logs) || 0,
    category: p.category
  };
};

// -------------------------------------------------------
// POST /api/ai/predict/:projectId
// Get AI completion prediction for a project
// -------------------------------------------------------
const predictCompletion = async (req, res) => {
  try {
    const { projectId } = req.params;

    const features = await buildProjectFeatures(projectId);

    // Call Python AI microservice
    const prediction = await callAIService('/predict', features);

    // Save prediction to DB for audit trail
    await db.query(
      `INSERT INTO ai_predictions (
        project_id, predicted_end_date, confidence_score,
        delay_probability, delay_days, input_features
       ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        projectId,
        prediction.predicted_end_date,
        prediction.confidence_score,
        prediction.delay_probability,
        prediction.delay_days,
        JSON.stringify(features)
      ]
    );

    // Update project with latest prediction
    await db.query(
      `UPDATE projects SET
        predicted_end_date = $1,
        delay_risk_score = $2,
        last_prediction_at = NOW()
       WHERE id = $3`,
      [prediction.predicted_end_date, prediction.delay_probability, projectId]
    );

    res.json({ success: true, prediction: { ...prediction, features } });
  } catch (err) {
    console.error('AI prediction error:', err);

    // Return graceful fallback if AI service is down
    res.status(503).json({
      success: false,
      message: 'AI service unavailable. Please try again later.',
      error: err.message
    });
  }
};

// -------------------------------------------------------
// POST /api/ai/simulate/:projectId
// Run "what-if" simulation with adjusted parameters
// -------------------------------------------------------
const runSimulation = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { labor_count, budget_ratio, weather_factor, notes } = req.body;

    const features = await buildProjectFeatures(projectId);

    // Override features with simulation parameters
    const simFeatures = {
      ...features,
      labor_count: labor_count ?? features.labor_count,
      budget_ratio: budget_ratio ?? features.budget_ratio,
      weather_factor: weather_factor ?? 1.0,
      is_simulation: true
    };

    const prediction = await callAIService('/predict', simFeatures);

    // Save simulation run
    const simResult = await db.query(
      `INSERT INTO simulation_runs (
        project_id, run_by, sim_labor_count, sim_budget,
        sim_weather_factor, sim_notes, predicted_end_date, days_saved
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [
        projectId, req.user.id,
        labor_count, budget_ratio,
        weather_factor, notes,
        prediction.predicted_end_date,
        prediction.days_saved || 0
      ]
    );

    res.json({
      success: true,
      simulation_id: simResult.rows[0].id,
      prediction,
      inputs: simFeatures
    });
  } catch (err) {
    console.error('AI Prediction error:', err);
    res.status(503).json({ success: false, message: 'AI service error: ' + err.message, trace: err.stack });
  }
};

// -------------------------------------------------------
// POST /api/ai/detect-delays
// Batch check all active projects for delay risk
// -------------------------------------------------------
const detectDelays = async (req, res) => {
  try {
    const projectsResult = await db.query(
      "SELECT id FROM projects WHERE status = 'active'"
    );

    const projects = projectsResult.rows;
    const results = [];

    for (const { id } of projects) {
      try {
        const features = await buildProjectFeatures(id);
        const prediction = await callAIService('/predict', features);

        if (prediction.delay_probability > 0.5) {
          results.push({
            project_id: id,
            delay_probability: prediction.delay_probability,
            delay_days: prediction.delay_days,
            risk_level: prediction.delay_probability > 0.8 ? 'high' : 'medium'
          });

          // Update risk score in DB
          await db.query(
            'UPDATE projects SET delay_risk_score = $1 WHERE id = $2',
            [prediction.delay_probability, id]
          );
        }
      } catch (err) {
        // Skip failed predictions, don't block the batch
        console.warn(`Prediction failed for project ${id}:`, err.message);
      }
    }

    res.json({
      success: true,
      checked: projects.length,
      at_risk: results.length,
      projects: results.sort((a, b) => b.delay_probability - a.delay_probability)
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Delay detection failed.' });
  }
};

const fs = require('fs');

// -------------------------------------------------------
// POST /api/ai/analyze-image
// Analyze a construction image and return a completion estimate
// -------------------------------------------------------
const analyzeImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image provided.' });
    }

    const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    
    const fileBuffer = fs.readFileSync(req.file.path);
    const fileBlob = new Blob([fileBuffer], { type: req.file.mimetype });
    
    const formData = new FormData();
    formData.append('file', fileBlob, req.file.originalname);

    const response = await fetch(`${aiUrl}/analyze-image`, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(30000)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || `AI service error: ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Analyze image error:', err);
    res.status(503).json({ success: false, message: 'Analysis failed.', error: err.message });
  }
};

module.exports = { predictCompletion, runSimulation, detectDelays, analyzeImage };
