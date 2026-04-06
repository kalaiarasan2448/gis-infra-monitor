# 🗺️ AI-Powered GIS Infrastructure Monitoring System

A production-ready full-stack platform for monitoring real-time infrastructure development using geo-tagging, AI-based predictions, and interactive dashboards.

---

## 📁 Project Structure

```
gis-infra-monitor/
├── backend/                    # Node.js + Express REST API
│   ├── src/
│   │   ├── config/             # DB, JWT, environment config
│   │   ├── controllers/        # Business logic
│   │   ├── middleware/         # Auth, error handling
│   │   ├── models/             # DB query functions
│   │   ├── routes/             # API route definitions
│   │   └── utils/              # Helper functions
│   ├── uploads/                # Uploaded progress images
│   ├── .env.example
│   └── package.json
│
├── frontend/                   # React + Vite + Tailwind
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   │   ├── auth/           # Login/Signup forms
│   │   │   ├── map/            # Leaflet map components
│   │   │   ├── dashboard/      # Charts and stats
│   │   │   ├── projects/       # Project CRUD
│   │   │   └── progress/       # Daily progress forms
│   │   ├── pages/              # Route-level page components
│   │   ├── context/            # React Context (Auth, etc.)
│   │   ├── hooks/              # Custom React hooks
│   │   ├── services/           # API call functions
│   │   └── utils/              # Frontend helpers
│   └── package.json
│
├── ai-service/                 # Python FastAPI microservice
│   ├── models/                 # Trained ML models (.pkl)
│   ├── data/                   # Sample/training datasets
│   ├── utils/                  # Feature engineering
│   ├── main.py                 # FastAPI app entry
│   ├── train.py                # Model training script
│   └── requirements.txt
│
└── docs/
    ├── API.md                  # Full API documentation
    ├── SCHEMA.md               # Database schema
    └── DEPLOYMENT.md           # Deployment guide
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.10+
- PostgreSQL 14+ with PostGIS extension
- npm or yarn

### 1. Clone the repository
```bash
git clone https://github.com/yourorg/gis-infra-monitor.git
cd gis-infra-monitor
```

### 2. Setup Backend
```bash
cd backend
cp .env.example .env
# Fill in your DB credentials and secrets in .env
npm install
npm run db:migrate     # Run DB schema
npm run db:seed        # Load sample data
npm run dev            # Start on port 5000
```

### 3. Setup Frontend
```bash
cd frontend
cp .env.example .env
# Set VITE_API_URL and VITE_AI_URL
npm install
npm run dev            # Start on port 5173
```

### 4. Setup AI Service
```bash
cd ai-service
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
python train.py            # Train the ML models
uvicorn main:app --reload --port 8000
```

---

## 🔐 Environment Variables

### Backend `.env`
```
PORT=5000
DATABASE_URL=postgresql://user:pass@localhost:5432/gis_infra
JWT_SECRET=your_super_secret_key_here
JWT_EXPIRES_IN=7d
AI_SERVICE_URL=http://localhost:8000
NODE_ENV=development
```

### Frontend `.env`
```
VITE_API_URL=http://localhost:5000/api
VITE_AI_URL=http://localhost:8000
```

---

## 👥 User Roles

| Role | Capabilities |
|------|-------------|
| **Admin** | Full access: create/delete projects, manage users, view all dashboards |
| **Engineer** | Upload progress, update assigned projects |
| **Viewer** | Read-only access to map and dashboards |

---

## 🧠 AI Features

- **Completion Prediction**: Predicts estimated finish date based on current progress velocity
- **Delay Detection**: Flags projects at risk of going over deadline
- **Simulation**: Adjust labor/budget/external factors to see revised estimates

---

## 📡 API Base URLs

| Service | Local | Production |
|---------|-------|------------|
| Backend | `http://localhost:5000/api` | `https://your-api.render.com/api` |
| AI Service | `http://localhost:8000` | `https://your-ai.render.com` |
| Frontend | `http://localhost:5173` | `https://your-app.vercel.app` |

---

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Leaflet.js, Recharts
- **Backend**: Node.js, Express.js, JWT, Multer
- **Database**: PostgreSQL + PostGIS
- **AI**: Python, FastAPI, Scikit-learn, Pandas
- **Deployment**: Vercel (FE), Render (BE + AI), Supabase/Neon (DB)
