# 🗄️ Database Schema Reference

## Tables Overview

| Table | Purpose |
|-------|---------|
| `users` | Authentication + role management |
| `projects` | Core infrastructure project records |
| `progress_logs` | Daily engineer progress submissions |
| `progress_images` | Photos attached to progress logs |
| `ai_predictions` | AI prediction history for audit |
| `simulation_runs` | What-if simulation results |
| `audit_logs` | System event tracking |

---

## Entity Relationship Diagram

```
users (1) ─────────── (M) projects [created_by]
users (1) ─────────── (M) projects [assigned_engineer_id]
projects (1) ────────── (M) progress_logs
users (1) ─────────── (M) progress_logs [engineer_id]
progress_logs (1) ───── (M) progress_images
projects (1) ────────── (M) ai_predictions
projects (1) ────────── (M) simulation_runs
users (1) ─────────── (M) simulation_runs [run_by]
users (1) ─────────── (M) audit_logs
```

---

## Key Table Details

### projects
The central table. Uses **PostGIS** geometry types:
- `location GEOMETRY(POINT, 4326)` — GPS point (WGS84 coordinate system)
- `boundary GEOMETRY(POLYGON, 4326)` — optional land area polygon

**SRID 4326** is the standard for GPS/Google Maps coordinates (latitude/longitude degrees).

Key computed/trigger-updated columns:
- `completion_percentage` — auto-synced from latest progress_log via trigger
- `delay_risk_score` — updated by AI service after each prediction

### progress_logs
- `gps_location GEOMETRY(POINT, 4326)` — where the photo/update was taken
- `is_synced BOOLEAN` — false for offline-created logs pending sync
- `local_id VARCHAR` — client-generated temp ID for deduplication during sync

### Useful PostGIS Queries

```sql
-- Find all projects within 50km of Chennai
SELECT name, latitude, longitude,
       ST_Distance(
         location::geography,
         ST_SetSRID(ST_MakePoint(80.2707, 13.0827), 4326)::geography
       ) / 1000 AS distance_km
FROM projects
WHERE ST_DWithin(
  location::geography,
  ST_SetSRID(ST_MakePoint(80.2707, 13.0827), 4326)::geography,
  50000  -- 50,000 meters = 50km
)
ORDER BY distance_km;

-- Get projects in a bounding box (map viewport)
SELECT * FROM projects
WHERE ST_Within(
  location,
  ST_MakeEnvelope(72.0, 8.0, 80.0, 20.0, 4326)  -- West India bbox
);

-- Projects grouped by state/region using PostGIS clustering
SELECT
  ST_ClusterDBSCAN(location, 1.0, 3) OVER () AS cluster_id,
  id, name, latitude, longitude
FROM projects;
```

---

## Indexes

| Table | Index | Type | Purpose |
|-------|-------|------|---------|
| `users` | `idx_users_email` | BTree | Fast login lookup |
| `users` | `idx_users_role` | BTree | Role filtering |
| `projects` | `idx_projects_location` | **GIST** | Geospatial queries |
| `projects` | `idx_projects_status` | BTree | Status filter |
| `projects` | `idx_projects_category` | BTree | Category filter |
| `progress_logs` | `idx_progress_project` | BTree | Logs per project |
| `progress_logs` | `idx_progress_date` | BTree | Chronological queries |

GIST index is the PostGIS spatial index type — required for any `ST_Within`, `ST_DWithin`, `ST_Intersects` queries to be fast.

---

## Views

### `project_summary`
Pre-joined view with engineer info, days remaining, and budget utilization.

```sql
SELECT * FROM project_summary WHERE status = 'active' ORDER BY days_remaining ASC;
```

### `activity_feed`
Recent progress updates across all projects.

```sql
SELECT * FROM activity_feed LIMIT 20;
```

---

## Automatic Triggers

| Trigger | Table | Event | Action |
|---------|-------|-------|--------|
| `update_users_updated_at` | users | UPDATE | Sets `updated_at = NOW()` |
| `update_projects_updated_at` | projects | UPDATE | Sets `updated_at = NOW()` |
| `sync_completion_on_progress` | progress_logs | INSERT | Updates `projects.completion_percentage` |
