"""
main.py - FastAPI AI microservice
Endpoints:
  POST /predict   - Predict completion date and delay probability
  POST /batch     - Batch predictions for multiple projects
  GET  /health    - Health check
  GET  /model-info - Model metadata
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List
import joblib
import json
import numpy as np
import os
from datetime import date, timedelta
import logging
from transformers import pipeline
from PIL import Image
import io
from fastapi import File, UploadFile

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============================================================
# App setup
# ============================================================
app = FastAPI(
    title="GIS Infrastructure AI Service",
    description="ML-powered project completion prediction and delay detection",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict to backend URL in production
    allow_methods=["*"],
    allow_headers=["*"]
)

# ============================================================
# Load models at startup
# ============================================================
MODELS_DIR = os.path.join(os.path.dirname(__file__), 'models')

def load_models():
    """Load trained models and metadata. Called at startup."""
    try:
        delay_clf = joblib.load(os.path.join(MODELS_DIR, 'delay_classifier.pkl'))
        duration_reg = joblib.load(os.path.join(MODELS_DIR, 'duration_regressor.pkl'))
        label_encoder = joblib.load(os.path.join(MODELS_DIR, 'label_encoder.pkl'))

        with open(os.path.join(MODELS_DIR, 'metadata.json')) as f:
            metadata = json.load(f)

        logger.info("loading zero-shot image classifier...")
        try:
            img_clf = pipeline("zero-shot-image-classification", model="openai/clip-vit-base-patch32")
        except Exception as e:
            logger.error(f"Failed to load image classifier: {e}")
            img_clf = None

        logger.info("✅ Models loaded successfully")
        return delay_clf, duration_reg, label_encoder, metadata, img_clf
    except FileNotFoundError as e:
        logger.error(f"❌ Model files not found: {e}")
        logger.error("Run 'python train.py' first to generate models")
        return None, None, None, None, None

delay_clf, duration_reg, label_encoder, metadata, image_classifier = load_models()


# ============================================================
# Request / Response schemas (Pydantic)
# ============================================================

class PredictionInput(BaseModel):
    """Input features for a single project prediction."""
    project_id: Optional[str] = None
    completion_pct: float = Field(ge=0, le=100, description="Current completion %")
    total_duration_days: int = Field(gt=0, description="Planned total duration")
    elapsed_days: int = Field(ge=0, description="Days since project start")
    days_remaining: float = Field(description="Days until expected deadline")
    daily_velocity: float = Field(ge=0, description="Average % completion per day")
    log_frequency: float = Field(ge=0, le=1, description="Update regularity (0-1)")
    labor_count: int = Field(ge=0, description="Number of workers on site")
    budget_ratio: float = Field(ge=0, description="Budget utilization ratio")
    total_logs: int = Field(ge=0, description="Total progress log submissions")
    category: str = Field(description="Project category")
    weather_factor: Optional[float] = Field(default=1.0, description="Weather modifier (1.0=normal)")
    is_simulation: Optional[bool] = Field(default=False)

class PredictionOutput(BaseModel):
    predicted_end_date: str
    delay_probability: float
    delay_days: int
    confidence_score: float
    is_at_risk: bool
    risk_level: str  # 'low', 'medium', 'high'
    days_saved: Optional[int] = 0
    recommendation: str
    model_version: str

class BatchInput(BaseModel):
    projects: List[PredictionInput]


# ============================================================
# Core prediction logic
# ============================================================

def encode_category(category: str, encoder) -> int:
    """Encode category string to integer. Handle unknown categories gracefully."""
    try:
        return int(encoder.transform([category])[0])
    except ValueError:
        # Unknown category - use 'other' or default to 0
        try:
            return int(encoder.transform(['other'])[0])
        except ValueError:
            return 0


def make_prediction(inp: PredictionInput) -> dict:
    """
    Core prediction function. Returns structured prediction result.
    """
    if delay_clf is None:
        raise HTTPException(status_code=503, detail="Models not loaded. Run 'python train.py' first.")

    # Apply weather/simulation factor to velocity
    effective_velocity = inp.daily_velocity * (inp.weather_factor or 1.0)

    category_encoded = encode_category(inp.category, label_encoder)

    # Build feature array in the same order as training
    features = np.array([[
        inp.completion_pct,
        inp.total_duration_days,
        inp.elapsed_days,
        inp.days_remaining,
        effective_velocity,
        inp.log_frequency,
        inp.labor_count,
        inp.budget_ratio,
        inp.total_logs,
        category_encoded
    ]])

    # --- Prediction 1: Delay probability (0-1) ---
    delay_proba = float(delay_clf.predict_proba(features)[0][1])
    is_delayed_pred = delay_clf.predict(features)[0]

    # --- Prediction 2: Total duration in days ---
    predicted_total_days = float(duration_reg.predict(features)[0])
    predicted_total_days = max(predicted_total_days, inp.elapsed_days + 1)

    # Days remaining until predicted completion
    predicted_remaining_days = max(0, predicted_total_days - inp.elapsed_days)

    # Predicted end date = today + remaining days
    predicted_end = date.today() + timedelta(days=int(predicted_remaining_days))

    # Expected end date for comparison
    expected_end = date.today() + timedelta(days=int(inp.days_remaining))
    delay_days = max(0, (predicted_end - expected_end).days)

    # Confidence: based on log frequency and amount of data
    confidence = min(0.95, 0.5 + (inp.total_logs * 0.02) + (inp.log_frequency * 0.3))

    # Risk level categorization
    if delay_proba < 0.3:
        risk_level = 'low'
    elif delay_proba < 0.7:
        risk_level = 'medium'
    else:
        risk_level = 'high'

    # Generate actionable recommendation
    recommendation = generate_recommendation(inp, delay_proba, delay_days, effective_velocity)

    # Days saved (for simulations vs baseline)
    days_saved = 0
    if inp.is_simulation:
        # Baseline: no simulation adjustments
        baseline_remaining = (100 - inp.completion_pct) / max(0.001, inp.daily_velocity)
        days_saved = max(0, int(baseline_remaining - predicted_remaining_days))

    return {
        "predicted_end_date": str(predicted_end),
        "delay_probability": round(delay_proba, 3),
        "delay_days": int(delay_days),
        "confidence_score": round(confidence, 3),
        "is_at_risk": bool(is_delayed_pred),
        "risk_level": risk_level,
        "days_saved": days_saved,
        "recommendation": recommendation,
        "model_version": metadata.get("model_version", "1.0.0") if metadata else "1.0.0"
    }


def generate_recommendation(inp: PredictionInput, delay_proba: float,
                              delay_days: int, velocity: float) -> str:
    """Generate human-readable recommendation based on prediction."""
    if delay_proba > 0.8:
        if velocity < 0.5:
            return f"⚠️ Critical: Progress velocity is very low ({velocity:.2f}%/day). " \
                   f"Consider doubling labor force and reviewing blockers immediately. " \
                   f"Estimated {delay_days} day delay."
        elif inp.budget_ratio > 1.0:
            return f"⚠️ Critical: Over budget ({inp.budget_ratio*100:.0f}% utilized). " \
                   f"Budget constraints may be slowing work. Request emergency allocation."
        else:
            return f"⚠️ High delay risk ({delay_proba*100:.0f}%). " \
                   f"Schedule an urgent site review and increase daily log frequency."
    elif delay_proba > 0.5:
        return f"⚡ Moderate risk ({delay_proba*100:.0f}%). Increasing labor by 20% " \
               f"or improving log frequency could prevent the estimated {delay_days} day delay."
    elif delay_proba > 0.3:
        return f"✅ On track with minor risk. Maintain current pace " \
               f"and ensure regular progress submissions."
    else:
        return f"✅ Project is on track. Current velocity ({velocity:.2f}%/day) " \
               f"indicates timely completion."


# ============================================================
# API Endpoints
# ============================================================

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "models_loaded": delay_clf is not None,
        "service": "GIS Infrastructure AI Service",
        "version": "1.0.0"
    }


@app.get("/model-info")
def model_info():
    if not metadata:
        raise HTTPException(status_code=503, detail="Models not loaded.")
    return {
        "version": metadata.get("model_version"),
        "features": metadata.get("feature_cols"),
        "categories": metadata.get("categories"),
        "models": ["delay_classifier (RandomForest)", "duration_regressor (GradientBoosting)"]
    }


@app.post("/predict", response_model=PredictionOutput)
def predict(inp: PredictionInput):
    """
    Predict completion date and delay risk for a single project.

    Example request:
    {
      "project_id": "abc-123",
      "completion_pct": 45.5,
      "total_duration_days": 365,
      "elapsed_days": 180,
      "days_remaining": 185,
      "daily_velocity": 0.25,
      "log_frequency": 0.7,
      "labor_count": 50,
      "budget_ratio": 0.5,
      "total_logs": 30,
      "category": "healthcare"
    }
    """
    try:
        result = make_prediction(inp)
        logger.info(f"Prediction for project {inp.project_id}: risk={result['risk_level']}")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Prediction failed: {e}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


@app.post("/batch")
def batch_predict(batch: BatchInput):
    """Batch predictions for multiple projects."""
    results = []
    for project in batch.projects:
        try:
            result = make_prediction(project)
            results.append({"project_id": project.project_id, "success": True, **result})
        except Exception as e:
            results.append({"project_id": project.project_id, "success": False, "error": str(e)})

    return {
        "total": len(results),
        "successful": sum(1 for r in results if r["success"]),
        "results": results
    }

@app.post("/analyze-image")
async def analyze_image(file: UploadFile = File(...)):
    """Computes a structural phase analysis directly from image pixels using huggingface CLIp."""
    if image_classifier is None:
        raise HTTPException(status_code=503, detail="Image classifier not verified. PyTorch integration missing.")
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")
        
        labels = [
            "empty dirt site or ground leveling",
            "building foundation and concrete poured",
            "active building framing and scaffolding",
            "finished building exterior infrastructure"
        ]
        results = image_classifier(image, candidate_labels=labels)
        
        mapping = {
            "empty dirt site or ground leveling": 10,
            "building foundation and concrete poured": 35,
            "active building framing and scaffolding": 65,
            "finished building exterior infrastructure": 95
        }
        
        top_result = results[0]
        estimated_pct = mapping.get(top_result['label'], 0)
        
        return {
            "success": True,
            "estimated_completion": estimated_pct,
            "recognized_stage": top_result['label'],
            "confidence": round(top_result['score'], 3)
        }
    except Exception as e:
        logger.error(f"Image analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
