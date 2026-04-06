# 🚀 Deployment Guide

## Architecture Overview

```
┌─────────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│   Vercel (Frontend) │────▶│  Render (Backend API) │────▶│  Neon/Supabase (DB) │
│   React + Vite      │     │  Node.js + Express    │     │  PostgreSQL+PostGIS │
└─────────────────────┘     └──────────┬───────────┘     └─────────────────────┘
                                        │
                             ┌──────────▼───────────┐
                             │  Render (AI Service)  │
                             │  Python + FastAPI     │
                             └──────────────────────┘
```

---

## 1. Database — Neon (Recommended free tier)

1. Sign up at [neon.tech](https://neon.tech)
2. Create a new project → copy the connection string
3. Open the SQL editor and run:
   ```sql
   -- Enable PostGIS
   CREATE EXTENSION IF NOT EXISTS postgis;
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   ```
4. Paste the full contents of `backend/src/config/schema.sql` and run
5. Your `DATABASE_URL` looks like:
   ```
   postgresql://user:pass@ep-xyz.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

**Alternative:** Supabase also provides free PostgreSQL with PostGIS enabled by default.

---

## 2. Backend — Render

1. Push code to GitHub
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect your GitHub repo, select the `backend/` folder
4. Configure:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Environment:** Node
5. Add Environment Variables:
   ```
   DATABASE_URL=<your Neon connection string>
   JWT_SECRET=<generate: openssl rand -hex 32>
   JWT_EXPIRES_IN=7d
   AI_SERVICE_URL=<your AI service URL after step 4>
   NODE_ENV=production
   ALLOWED_ORIGINS=https://your-app.vercel.app
   PORT=5000
   ```
6. Deploy and copy the service URL (e.g. `https://gis-api.onrender.com`)

### Run migrations on Render
After deploy, open Render Shell:
```bash
node -e "
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query(fs.readFileSync('./src/config/schema.sql', 'utf8'))
  .then(() => { console.log('✅ Schema applied'); pool.end(); })
  .catch(e => { console.error(e); pool.end(); });
"
```

---

## 3. AI Service — Render

1. New → Web Service → select `ai-service/` folder
2. Configure:
   - **Runtime:** Python 3
   - **Build Command:** `pip install -r requirements.txt && python train.py`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
3. No environment variables needed (models are generated at build time)
4. After deploy, copy URL → update `AI_SERVICE_URL` in backend service
5. Test: `curl https://your-ai.onrender.com/health`

**Note:** Free Render instances spin down after 15 min of inactivity (cold start ~30s).
For production, upgrade to a paid plan or use a cron ping to keep it warm.

---

## 4. Frontend — Vercel

1. Push frontend to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import repo
3. Set root directory to `frontend/`
4. Framework: **Vite**
5. Add Environment Variables:
   ```
   VITE_API_URL=https://gis-api.onrender.com/api
   VITE_AI_URL=https://your-ai.onrender.com
   ```
6. Deploy → get your URL (e.g. `https://gis-infra.vercel.app`)
7. Go back to Render backend → update `ALLOWED_ORIGINS` with this URL

---

## 5. File Uploads — Cloud Storage (Production)

For production, replace local disk uploads with cloud storage:

### Option A: Cloudinary (easiest)
```bash
npm install cloudinary multer-storage-cloudinary
```
```js
// In backend, replace multer diskStorage with:
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const storage = new CloudinaryStorage({
  cloudinary,
  params: { folder: 'gis-infra/progress', allowed_formats: ['jpg','png','webp'] }
});
```

### Option B: AWS S3
```bash
npm install @aws-sdk/client-s3 multer-s3
```

Add to backend env:
```
CLOUDINARY_CLOUD_NAME=xxx
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx
```

---

## 6. Environment Variables Reference

### Backend (Render)
| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Min 32-char random string |
| `JWT_EXPIRES_IN` | Token lifetime (e.g. `7d`) |
| `AI_SERVICE_URL` | Full URL of Python AI service |
| `ALLOWED_ORIGINS` | Comma-separated frontend origins |
| `NODE_ENV` | `production` |
| `PORT` | Auto-set by Render |

### Frontend (Vercel)
| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API base URL |
| `VITE_AI_URL` | AI service base URL |

---

## 7. CI/CD (Optional)

Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Trigger Render Deploy
        run: curl -X POST ${{ secrets.RENDER_BACKEND_DEPLOY_HOOK }}

  deploy-ai:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Trigger Render AI Deploy
        run: curl -X POST ${{ secrets.RENDER_AI_DEPLOY_HOOK }}
```

Vercel auto-deploys on push to main by default.

---

## 8. Health Checks

After deployment, verify all services:

```bash
# Backend
curl https://your-api.onrender.com/health

# AI Service
curl https://your-ai.onrender.com/health

# Test login
curl -X POST https://your-api.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@infra.gov","password":"password123"}'
```

---

## 9. Monitoring (Recommended)

- **Uptime:** UptimeRobot (free) — ping `/health` every 5 min
- **Logs:** Render dashboard built-in log viewer
- **Errors:** Add Sentry: `npm install @sentry/node`
- **DB:** Neon dashboard → query analytics

---

## 10. Security Checklist

- [ ] Change default seed passwords before going live
- [ ] Use strong JWT_SECRET (32+ chars, use `openssl rand -hex 32`)
- [ ] Enable SSL on database (already handled with `?sslmode=require`)
- [ ] Set `NODE_ENV=production`
- [ ] Restrict `ALLOWED_ORIGINS` to your exact domain
- [ ] Enable rate limiting (already built in)
- [ ] Rotate JWT secret periodically
- [ ] Set up database backups (Neon has auto-backup)
