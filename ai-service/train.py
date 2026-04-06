"""
train.py - Train the ML models for:
1. Completion Date Prediction (Gradient Boosting Regression)
2. Delay Detection (Random Forest Classifier)

Run this before starting the API:
  python train.py
"""

import pandas as pd
import numpy as np
from sklearn.ensemble import GradientBoostingRegressor, RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, accuracy_score
import joblib
import os
import json

# Paths
MODELS_DIR = os.path.join(os.path.dirname(__file__), 'models')
DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
os.makedirs(MODELS_DIR, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)


def generate_sample_data(n_samples: int = 1000) -> pd.DataFrame:
    """
    Generate realistic synthetic infrastructure project data for training.
    In production, replace this with actual historical project data from your DB.
    """
    np.random.seed(42)

    categories = ['education', 'healthcare', 'road', 'water', 'electricity', 'housing']

    data = []
    for i in range(n_samples):
        category = np.random.choice(categories)

        # Project duration varies by category (days)
        duration_ranges = {
            'road': (180, 730),
            'healthcare': (365, 1095),
            'education': (180, 730),
            'water': (120, 548),
            'electricity': (90, 365),
            'housing': (365, 1460)
        }
        total_days = np.random.randint(*duration_ranges[category])

        # How far into the project we are (0.1 to 0.95)
        elapsed_fraction = np.random.uniform(0.1, 0.95)
        elapsed_days = int(total_days * elapsed_fraction)

        # Current completion - should roughly match time elapsed but with variance
        # Good projects: completion > elapsed fraction, Bad: less
        base_velocity = np.random.uniform(0.5, 1.5)  # 1.0 = on track
        completion_pct = min(100, elapsed_fraction * base_velocity * 100 + np.random.normal(0, 5))
        completion_pct = max(0, completion_pct)

        # Labor: affects speed
        labor_count = np.random.randint(5, 200)

        # Budget utilization (0 = 0% spent, 1 = 100% spent)
        budget_ratio = min(1.5, elapsed_fraction * np.random.uniform(0.7, 1.3))

        # Log frequency: how consistently engineers submit updates (0-1)
        log_frequency = np.random.uniform(0.1, 1.0)

        # Daily velocity: % completion per day
        daily_velocity = (completion_pct / max(1, elapsed_days))

        # Days remaining until expected deadline
        days_remaining = total_days - elapsed_days

        # Weather/external factor (simulated)
        weather_factor = np.random.uniform(0.6, 1.2)

        # --- LABEL GENERATION ---
        # How many extra days beyond deadline will this project take?
        # Based on: current velocity vs required velocity
        required_velocity = (100 - completion_pct) / max(1, days_remaining)
        velocity_ratio = daily_velocity / max(0.001, required_velocity)

        # velocity_ratio < 1 means behind schedule
        if velocity_ratio < 0.7:
            # Significantly behind - likely big delay
            delay_days = int(np.random.uniform(30, 180) * (1 - velocity_ratio))
        elif velocity_ratio < 0.9:
            # Slightly behind
            delay_days = int(np.random.uniform(0, 45) * (1 - velocity_ratio))
        else:
            # On track or ahead - small to no delay
            delay_days = max(0, int(np.random.normal(0, 10)))

        actual_total_days = total_days + delay_days
        is_delayed = 1 if delay_days > 14 else 0  # More than 2 weeks = delayed

        data.append({
            'completion_pct': round(completion_pct, 2),
            'total_duration_days': total_days,
            'elapsed_days': elapsed_days,
            'days_remaining': days_remaining,
            'daily_velocity': round(daily_velocity, 4),
            'log_frequency': round(log_frequency, 3),
            'labor_count': labor_count,
            'budget_ratio': round(budget_ratio, 3),
            'total_logs': int(elapsed_days * log_frequency),
            'category': category,
            'weather_factor': round(weather_factor, 2),
            # Labels
            'delay_days': delay_days,
            'actual_total_days': actual_total_days,
            'is_delayed': is_delayed
        })

    df = pd.DataFrame(data)
    df.to_csv(os.path.join(DATA_DIR, 'training_data.csv'), index=False)
    print(f"✅ Generated {n_samples} training samples → data/training_data.csv")
    print(f"   Delayed projects: {df['is_delayed'].sum()} ({df['is_delayed'].mean()*100:.1f}%)")
    return df


def prepare_features(df: pd.DataFrame):
    """
    Encode categorical features and return feature matrix X.
    """
    le = LabelEncoder()
    df = df.copy()
    df['category_encoded'] = le.fit_transform(df['category'])

    # Save encoder for use in predictions
    joblib.dump(le, os.path.join(MODELS_DIR, 'label_encoder.pkl'))

    feature_cols = [
        'completion_pct', 'total_duration_days', 'elapsed_days',
        'days_remaining', 'daily_velocity', 'log_frequency',
        'labor_count', 'budget_ratio', 'total_logs', 'category_encoded'
    ]

    return df[feature_cols], le, feature_cols


def train_delay_predictor(df: pd.DataFrame, X: pd.DataFrame):
    """
    Random Forest Classifier: predicts whether a project will be delayed.
    Binary classification: 0 = on-time, 1 = delayed (>14 days late)
    """
    y = df['is_delayed']

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    model = RandomForestClassifier(
        n_estimators=200,
        max_depth=8,
        min_samples_split=10,
        random_state=42,
        class_weight='balanced'  # Handle imbalanced classes
    )
    model.fit(X_train, y_train)

    # Evaluate
    y_pred = model.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    print(f"✅ Delay Classifier - Accuracy: {acc*100:.1f}%")

    joblib.dump(model, os.path.join(MODELS_DIR, 'delay_classifier.pkl'))
    return model


def train_duration_predictor(df: pd.DataFrame, X: pd.DataFrame):
    """
    Gradient Boosting Regressor: predicts total project duration in days.
    We then use this to calculate predicted completion date.
    """
    y = df['actual_total_days']

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    model = GradientBoostingRegressor(
        n_estimators=300,
        learning_rate=0.05,
        max_depth=5,
        subsample=0.8,
        random_state=42
    )
    model.fit(X_train, y_train)

    # Evaluate
    y_pred = model.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    print(f"✅ Duration Regressor - MAE: {mae:.1f} days")

    joblib.dump(model, os.path.join(MODELS_DIR, 'duration_regressor.pkl'))
    return model


def save_metadata(le, feature_cols):
    """Save model metadata for the API to load."""
    metadata = {
        'feature_cols': feature_cols,
        'categories': list(le.classes_),
        'model_version': '1.0.0'
    }
    with open(os.path.join(MODELS_DIR, 'metadata.json'), 'w') as f:
        json.dump(metadata, f, indent=2)
    print("✅ Metadata saved → models/metadata.json")


if __name__ == '__main__':
    print("\n🔧 Training AI models for GIS Infrastructure Monitor\n")

    print("📊 Generating training data...")
    df = generate_sample_data(n_samples=2000)

    print("\n🔨 Preparing features...")
    X, le, feature_cols = prepare_features(df)

    print("\n🌲 Training Delay Classifier (Random Forest)...")
    train_delay_predictor(df, X)

    print("\n📈 Training Duration Regressor (Gradient Boosting)...")
    train_duration_predictor(df, X)

    save_metadata(le, feature_cols)

    print("\n🎉 Training complete! Models saved to ./models/")
    print("   You can now start the API: uvicorn main:app --reload --port 8000\n")
