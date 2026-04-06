# 📡 API Documentation

Base URL: `http://localhost:5000/api`  
All protected routes require: `Authorization: Bearer <token>`

---

## Authentication

### POST `/auth/register`
Create a new user account.

**Request:**
```json
{
  "name": "Ravi Kumar",
  "email": "ravi@infra.gov",
  "password": "securePassword123"
}
```

**Response `201`:**
```json
{
  "success": true,
  "token": "eyJhbGci...",
  "user": { "id": "uuid", "name": "Ravi Kumar", "email": "ravi@infra.gov", "role": "viewer" }
}
```

---

### POST `/auth/login`

**Request:**
```json
{ "email": "admin@infra.gov", "password": "password123" }
```

**Response `200`:**
```json
{
  "success": true,
  "token": "eyJhbGci...",
  "user": { "id": "uuid", "name": "Admin User", "email": "admin@infra.gov", "role": "admin" }
}
```

---

### GET `/auth/me` 🔒
Returns the authenticated user's profile.

---

### GET `/auth/users` 🔒 Admin only
List all platform users.

---

## Projects

### GET `/projects`
Get all projects. Supports query params:
- `?status=active` — filter by status
- `?category=healthcare` — filter by category
- `?engineer_id=uuid` — filter by assigned engineer
- `?bbox=minLon,minLat,maxLon,maxLat` — geospatial bounding box filter

**Response `200`:**
```json
{
  "success": true,
  "count": 10,
  "projects": [
    {
      "id": "uuid",
      "name": "District Hospital Wing",
      "category": "healthcare",
      "status": "active",
      "latitude": 13.0827,
      "longitude": 80.2707,
      "completion_percentage": "74.00",
      "expected_end_date": "2025-04-30",
      "days_remaining": 23,
      "engineer_name": "Ravi Kumar",
      "delay_risk_score": "0.710",
      "last_update": "2025-01-10"
    }
  ]
}
```

---

### GET `/projects/:id`
Get a single project with recent progress logs.

**Response includes:**
- Full project details
- `boundary_geojson` — GeoJSON polygon if boundary was set
- `recentLogs` — latest 10 progress log entries with images

---

### POST `/projects` 🔒 Admin/Engineer
Create a new project.

**Request:**
```json
{
  "name": "Government Primary School Block C",
  "description": "8 classrooms + labs",
  "category": "education",
  "latitude": 12.9716,
  "longitude": 77.5946,
  "address": "Bengaluru South, Karnataka",
  "start_date": "2025-01-15",
  "expected_end_date": "2025-12-31",
  "budget": 4500000,
  "assigned_engineer_id": "uuid-optional",
  "boundary_coordinates": [
    [77.594, 12.971], [77.596, 12.971],
    [77.596, 12.973], [77.594, 12.973]
  ]
}
```

**Response `201`:**
```json
{
  "success": true,
  "project": { "id": "uuid", "name": "...", "status": "planning", ... }
}
```

---

### PUT `/projects/:id` 🔒 Admin/Assigned Engineer

**Request** (all fields optional):
```json
{
  "status": "active",
  "completion_percentage": 55,
  "budget_spent": 2500000,
  "labor_count": 80
}
```

---

### DELETE `/projects/:id` 🔒 Admin only

---

### GET `/projects/stats/summary` 🔒
Dashboard statistics.

**Response:**
```json
{
  "stats": {
    "total_projects": "10",
    "active_projects": "7",
    "completed_projects": "2",
    "overdue_projects": "1",
    "high_risk_projects": "3",
    "avg_completion": "52.4",
    "total_budget": "306800000",
    "total_spent": "174700000"
  },
  "categoryBreakdown": [
    { "category": "road", "count": "3", "avg_completion": "61.0" }
  ],
  "monthlyProgress": [
    { "month": "2024-11-01T00:00:00.000Z", "projects_updated": "6", "avg_completion": "48.2" }
  ]
}
```

---

## Progress Logs

### POST `/progress` 🔒 Admin/Engineer
Submit a daily progress log. Send as `multipart/form-data` to include images.

**Form fields:**
| Field | Type | Required |
|-------|------|----------|
| project_id | UUID | ✅ |
| completion_percentage | number 0-100 | ✅ |
| log_date | date | No (defaults to today) |
| notes | string | No |
| weather_condition | sunny/cloudy/rainy/stormy | No |
| labor_count | integer | No |
| images | file[] | No (max 10) |
| gps_lat | float | No |
| gps_lng | float | No |

**Response `201`:**
```json
{
  "success": true,
  "log": {
    "id": "uuid",
    "completion_percentage": "65.00",
    "log_date": "2025-01-15",
    "images": [{ "id": "uuid", "file_path": "/uploads/img.jpg" }]
  }
}
```

---

### GET `/progress/:projectId` 🔒
Get paginated progress logs for a project.

Query params: `?limit=20&offset=0`

---

### POST `/progress/sync/offline` 🔒 Admin/Engineer
Bulk sync offline-created progress logs.

**Request:**
```json
{
  "logs": [
    {
      "local_id": "offline_1234_abc",
      "project_id": "uuid",
      "completion_percentage": 55,
      "log_date": "2025-01-10",
      "notes": "Created while offline",
      "labor_count": 45
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "synced": 1,
  "results": [{ "local_id": "offline_1234_abc", "server_id": "uuid", "status": "synced" }]
}
```

---

## AI Predictions

### POST `/ai/predict/:projectId` 🔒
Run AI completion prediction for a project.

**Response:**
```json
{
  "success": true,
  "prediction": {
    "predicted_end_date": "2025-05-20",
    "delay_probability": 0.712,
    "delay_days": 50,
    "confidence_score": 0.831,
    "is_at_risk": true,
    "risk_level": "high",
    "recommendation": "⚠️ High delay risk (71%). Increasing labor by 20% could prevent the estimated 50 day delay.",
    "model_version": "1.0.0"
  }
}
```

---

### POST `/ai/simulate/:projectId` 🔒
Run what-if simulation.

**Request:**
```json
{
  "labor_count": 120,
  "budget_ratio": 1.1,
  "weather_factor": 1.2,
  "notes": "Emergency fund released"
}
```

**Response:** Same as predict, plus `days_saved` and `simulation_id`.

---

### POST `/ai/detect-delays` 🔒 Admin only
Batch delay scan for all active projects.

**Response:**
```json
{
  "checked": 7,
  "at_risk": 3,
  "projects": [
    {
      "project_id": "uuid",
      "delay_probability": 0.84,
      "delay_days": 45,
      "risk_level": "high"
    }
  ]
}
```

---

## AI Service Endpoints (Python FastAPI — port 8000)

### POST `/predict`
Direct AI prediction endpoint.

### POST `/batch`
Batch predictions for multiple projects.

### GET `/health`
Health check: `{ "status": "healthy", "models_loaded": true }`

### GET `/model-info`
Returns model version, feature list, and supported categories.

---

## Error Responses

All errors follow this format:
```json
{
  "success": false,
  "message": "Human-readable error description"
}
```

| Code | Meaning |
|------|---------|
| 400 | Validation error |
| 401 | Not authenticated / token expired |
| 403 | Insufficient role |
| 404 | Resource not found |
| 409 | Conflict (e.g. email exists) |
| 503 | AI service unavailable |
