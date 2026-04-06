-- ============================================================
-- GIS Infrastructure Monitoring System - Database Schema
-- PostgreSQL 14+ with PostGIS extension
-- ============================================================

-- Enable PostGIS extension for geospatial support
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- USERS TABLE
-- Stores all platform users with role-based access
-- ============================================================
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20) NOT NULL DEFAULT 'viewer'
                  CHECK (role IN ('admin', 'engineer', 'viewer')),
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast email lookups (login)
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- ============================================================
-- PROJECTS TABLE
-- Core infrastructure project records with geospatial data
-- ============================================================
CREATE TABLE projects (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                  VARCHAR(255) NOT NULL,
  description           TEXT,
  category              VARCHAR(50) NOT NULL
                          CHECK (category IN ('education', 'healthcare', 'road',
                                              'water', 'electricity', 'housing', 'other')),
  status                VARCHAR(30) NOT NULL DEFAULT 'planning'
                          CHECK (status IN ('planning', 'active', 'on_hold',
                                            'completed', 'cancelled')),
  -- Geospatial: Point geometry for project location (SRID 4326 = WGS84/GPS)
  location              GEOMETRY(POINT, 4326) NOT NULL,
  -- Store raw lat/lng for easy access without PostGIS functions
  latitude              DECIMAL(10, 8) NOT NULL,
  longitude             DECIMAL(11, 8) NOT NULL,
  address               TEXT,
  -- Optional: polygon for land area boundary
  boundary              GEOMETRY(POLYGON, 4326),

  -- Project timeline
  start_date            DATE NOT NULL,
  expected_end_date     DATE NOT NULL,
  actual_end_date       DATE,

  -- Financials
  budget                DECIMAL(15, 2) DEFAULT 0,
  budget_spent          DECIMAL(15, 2) DEFAULT 0,

  -- Progress tracking
  completion_percentage DECIMAL(5, 2) DEFAULT 0.00
                          CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
  labor_count           INTEGER DEFAULT 0,

  -- AI prediction fields
  predicted_end_date    DATE,
  delay_risk_score      DECIMAL(4, 3),  -- 0.000 to 1.000
  last_prediction_at    TIMESTAMPTZ,

  -- Relationships
  created_by            UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_engineer_id  UUID REFERENCES users(id) ON DELETE SET NULL,

  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Spatial index for fast geo queries (e.g., "find projects near me")
CREATE INDEX idx_projects_location ON projects USING GIST(location);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_category ON projects(category);
CREATE INDEX idx_projects_engineer ON projects(assigned_engineer_id);

-- ============================================================
-- PROGRESS_LOGS TABLE
-- Daily progress submissions by field engineers
-- ============================================================
CREATE TABLE progress_logs (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id            UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  engineer_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  log_date              DATE NOT NULL DEFAULT CURRENT_DATE,
  completion_percentage DECIMAL(5, 2) NOT NULL
                          CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
  notes                 TEXT,
  weather_condition     VARCHAR(50),  -- sunny, rainy, cloudy, stormy
  labor_count           INTEGER DEFAULT 0,
  materials_used        JSONB,        -- { "cement": 50, "steel": 20 }

  -- Location where photo was taken (GPS from mobile)
  gps_location          GEOMETRY(POINT, 4326),

  -- Sync status for offline-first support
  is_synced             BOOLEAN DEFAULT true,
  local_id              VARCHAR(100),  -- client-side temp ID for offline

  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_progress_project ON progress_logs(project_id);
CREATE INDEX idx_progress_engineer ON progress_logs(engineer_id);
CREATE INDEX idx_progress_date ON progress_logs(log_date DESC);

-- ============================================================
-- PROGRESS_IMAGES TABLE
-- Images attached to progress logs
-- ============================================================
CREATE TABLE progress_images (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  progress_log_id UUID NOT NULL REFERENCES progress_logs(id) ON DELETE CASCADE,
  file_path       VARCHAR(500) NOT NULL,   -- relative path in uploads/
  file_name       VARCHAR(255) NOT NULL,
  file_size       INTEGER,                 -- bytes
  mime_type       VARCHAR(100),
  caption         TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_images_log ON progress_images(progress_log_id);

-- ============================================================
-- AI_PREDICTIONS TABLE
-- Store prediction history for audit and model improvement
-- ============================================================
CREATE TABLE ai_predictions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id            UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  predicted_end_date    DATE NOT NULL,
  confidence_score      DECIMAL(4, 3),   -- 0 to 1
  delay_probability     DECIMAL(4, 3),   -- 0 to 1
  delay_days            INTEGER DEFAULT 0,

  -- Input features used for this prediction
  input_features        JSONB NOT NULL,

  -- Which ML model version generated this
  model_version         VARCHAR(50) DEFAULT '1.0.0',

  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_predictions_project ON ai_predictions(project_id);

-- ============================================================
-- SIMULATION_RUNS TABLE
-- Stores user-initiated "what-if" simulations
-- ============================================================
CREATE TABLE simulation_runs (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  run_by            UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Simulation parameters adjusted by user
  sim_labor_count   INTEGER,
  sim_budget        DECIMAL(15, 2),
  sim_weather_factor DECIMAL(3, 2),  -- 0.5 = bad weather, 1.0 = normal, 1.2 = great
  sim_notes         TEXT,

  -- Simulation result
  predicted_end_date DATE,
  days_saved         INTEGER,

  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AUDIT_LOGS TABLE
-- Track important system events for admin review
-- ============================================================
CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  action      VARCHAR(100) NOT NULL,  -- 'project.created', 'user.login', etc.
  entity_type VARCHAR(50),
  entity_id   UUID,
  details     JSONB,
  ip_address  INET,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);

-- ============================================================
-- TRIGGER: auto-update updated_at on row change
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TRIGGER: sync completion_percentage from latest progress log
-- ============================================================
CREATE OR REPLACE FUNCTION sync_project_completion()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE projects
  SET
    completion_percentage = NEW.completion_percentage,
    labor_count = NEW.labor_count,
    updated_at = NOW()
  WHERE id = NEW.project_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_completion_on_progress
  AFTER INSERT ON progress_logs
  FOR EACH ROW EXECUTE FUNCTION sync_project_completion();

-- ============================================================
-- VIEWS: Convenience views for common queries
-- ============================================================

-- Project summary with engineer info and progress
CREATE VIEW project_summary AS
SELECT
  p.id,
  p.name,
  p.category,
  p.status,
  p.latitude,
  p.longitude,
  p.start_date,
  p.expected_end_date,
  p.completion_percentage,
  p.budget,
  p.budget_spent,
  p.delay_risk_score,
  p.predicted_end_date,
  u.name AS engineer_name,
  u.email AS engineer_email,
  -- Days remaining or overdue
  (p.expected_end_date - CURRENT_DATE) AS days_remaining,
  -- Budget utilization percentage
  CASE WHEN p.budget > 0
    THEN ROUND((p.budget_spent / p.budget * 100)::numeric, 2)
    ELSE 0
  END AS budget_utilization_pct
FROM projects p
LEFT JOIN users u ON p.assigned_engineer_id = u.id;

-- Recent progress activity feed
CREATE VIEW activity_feed AS
SELECT
  pl.id,
  pl.project_id,
  p.name AS project_name,
  pl.log_date,
  pl.completion_percentage,
  pl.notes,
  pl.weather_condition,
  u.name AS engineer_name,
  (SELECT COUNT(*) FROM progress_images pi WHERE pi.progress_log_id = pl.id) AS image_count
FROM progress_logs pl
JOIN projects p ON pl.project_id = p.id
JOIN users u ON pl.engineer_id = u.id
ORDER BY pl.created_at DESC;

-- ============================================================
-- SEED DATA: Sample users (passwords are bcrypt hashed "password123")
-- ============================================================
INSERT INTO users (name, email, password_hash, role) VALUES
  ('Admin User',        'admin@infra.gov',    '$2b$10$rNCLuCBxpLEbKFQUC7fYT.x7Ql4J2gZ3ySGlJ8EzXBbMkW7dNpH5a', 'admin'),
  ('Ravi Engineer',     'ravi@infra.gov',     '$2b$10$rNCLuCBxpLEbKFQUC7fYT.x7Ql4J2gZ3ySGlJ8EzXBbMkW7dNpH5a', 'engineer'),
  ('Priya Engineer',    'priya@infra.gov',    '$2b$10$rNCLuCBxpLEbKFQUC7fYT.x7Ql4J2gZ3ySGlJ8EzXBbMkW7dNpH5a', 'engineer'),
  ('District Viewer',   'viewer@district.gov','$2b$10$rNCLuCBxpLEbKFQUC7fYT.x7Ql4J2gZ3ySGlJ8EzXBbMkW7dNpH5a', 'viewer');
