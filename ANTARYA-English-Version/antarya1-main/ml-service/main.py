"""
ANTARYA ML Service — FastAPI Server
=====================================
🧠 CONCEPT: What is FastAPI?

FastAPI is like Express.js but for Python. It creates HTTP endpoints
that your Express backend can call to get ML predictions.

Think of it as a RESTAURANT KITCHEN:
- Express (the waiter) takes the customer's order
- FastAPI (the kitchen) prepares the food (runs ML models)
- The waiter brings the food back to the customer

Endpoints:
  GET  /health              → "Is the kitchen open?"
  POST /predict/demand      → "How much of this product will sell?"
  POST /predict/stockout    → "When will this product run out?"
  POST /predict/simulate    → "What if there's a holiday? How does demand change?"
  POST /explain             → "WHY did you predict this?"
  POST /ceo-brief           → "Give me today's action summary"
  GET  /metrics             → "How accurate are your predictions?"
"""

import sys
from pathlib import Path

# Add parent dir to path so we can import our modules
sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

from config import DEFAULT_LEAD_TIME_DAYS, DEFAULT_SAFETY_STOCK, KIRANA_FAMILIES
from models.demand import DemandModel
from utils.features import FEATURE_COLUMNS, engineer_features
from utils.decision_engine import (
    calculate_stockout,
    calculate_reorder,
    detect_slow_moving,
    generate_actions,
)
from utils.kirana_mapper import map_product_to_family, get_family_code

# ─── Initialize FastAPI ─────────────────────────────────────
app = FastAPI(
    title="ANTARYA ML Service",
    description="Predictive Decision Engine for MSMEs",
    version="1.0.0"
)

# Allow Express backend to call us
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Load Model on Startup ──────────────────────────────────
demand_model = DemandModel()
explainer_instance = None  # Initialized after model loads


@app.on_event("startup")
async def load_models():
    """Load ML models when server starts."""
    global explainer_instance
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

    success = demand_model.load()
    if success:
        try:
            from utils.explainer import AntaryaExplainer
            model_target = getattr(demand_model, 'model', getattr(demand_model, 'regressor', None))
            if model_target:
                explainer_instance = AntaryaExplainer(
                    model_target, 
                    demand_model.feature_columns
                )
                print("[OK] SHAP Explainer initialized")
            else:
                print("[OK] Demand model ready.")
        except Exception as e:
            print(f"[WARNING] SHAP Explainer failed to init: {e}")
    else:
        print("[WARNING] ML Service started WITHOUT a trained model. Run train_v7.py first.")


# ─── Request/Response Models ────────────────────────────────

class DemandRequest(BaseModel):
    product_name: str
    category: Optional[str] = None
    current_stock: Optional[float] = None
    price: Optional[float] = 0
    horizon_days: Optional[int] = 7  # How many days to forecast
    is_holiday: Optional[bool] = False
    is_promotion: Optional[bool] = False


class SimulateRequest(BaseModel):
    product_name: str
    category: Optional[str] = None
    current_stock: Optional[float] = None
    price: Optional[float] = 0
    horizon_days: Optional[int] = 7
    is_holiday: bool = False
    is_promotion: bool = False


class ExplainRequest(BaseModel):
    product_name: str
    category: Optional[str] = None
    price: Optional[float] = 0
    is_holiday: Optional[bool] = False
    is_promotion: Optional[bool] = False


class CEOBriefRequest(BaseModel):
    products: List[dict]  # [{name, category, current_stock, price}]
    lead_time_days: Optional[int] = DEFAULT_LEAD_TIME_DAYS
    safety_stock: Optional[int] = DEFAULT_SAFETY_STOCK


# ─── Helper Functions ───────────────────────────────────────

def _build_forecast_features(product_name, category, price, horizon_days, is_holiday, is_promotion):
    """
    Build a DataFrame of features for the next N days.
    Uses the model's training data patterns as baseline.
    """
    family = map_product_to_family(product_name, category)
    family_code = get_family_code(family, demand_model.family_list) if demand_model.family_list else 0
    
    today = datetime.now()
    rows = []
    
    for day_offset in range(1, horizon_days + 1):
        target_date = today + timedelta(days=day_offset)
        row = {
            'date': target_date.strftime('%Y-%m-%d'),
            'day_of_week': target_date.weekday(),
            'day_of_month': target_date.day,
            'month': target_date.month,
            'is_weekend': 1 if target_date.weekday() >= 5 else 0,
            'is_month_start': 1 if target_date.day <= 3 else 0,
            'is_month_end': 1 if target_date.day >= 28 else 0,
            'is_holiday': int(is_holiday),
            'onpromotion': int(is_promotion),
            'family_code': family_code,
            'price': price or 0,
            # Lag & rolling features: use model's baseline averages
            # In production, these would come from the store's actual recent sales
            'lag_1': 0,
            'lag_7': 0,
            'lag_14': 0,
            'lag_28': 0,
            'rolling_mean_7d': 0,
            'rolling_mean_30d': 0,
            'rolling_std_7d': 0,
            'trend_14d': 0,
        }
        rows.append(row)
    
    return pd.DataFrame(rows), family


# ─── ENDPOINTS ──────────────────────────────────────────────

@app.get("/health")
async def health_check():
    """Is the ML service running?"""
    return {
        "status": "healthy",
        "model_loaded": demand_model.is_loaded,
        "model_version": demand_model.metrics.get('model_version', 'N/A'),
        "timestamp": datetime.now().isoformat()
    }


@app.post("/predict/demand")
async def predict_demand(req: DemandRequest):
    """
    📈 DEMAND FORECAST
    Predicts demand for a product for the next N days.
    Returns prediction + honest intervals + metadata.
    """
    if not demand_model.is_loaded:
        raise HTTPException(503, "Model not trained yet. Run train.py first.")
    
    features_df, family = _build_forecast_features(
        req.product_name, req.category, req.price,
        req.horizon_days, req.is_holiday, req.is_promotion
    )
    
    predictions = demand_model.predict(features_df)
    if not isinstance(predictions, list):
        predictions = [predictions]
    
    today = datetime.now()
    forecasts = []
    for i, pred in enumerate(predictions):
        target_date = today + timedelta(days=i+1)
        pred['date'] = target_date.strftime('%Y-%m-%d')
        pred['day_name'] = target_date.strftime('%A')
        forecasts.append(pred)
    
    return {
        "product": req.product_name,
        "mapped_family": family,
        "forecasts": forecasts,
        "model_info": {
            "type": "LightGBM",
            "training_data": "Corporación Favorita",
            "expected_error": f"{demand_model.metrics.get('test_mape', 'N/A')}%"
        }
    }


@app.post("/predict/stockout")
async def predict_stockout(req: DemandRequest):
    """
    📦 STOCKOUT PREDICTION
    When will this product run out, based on the demand forecast?
    Also returns smart reorder recommendation.
    """
    if not demand_model.is_loaded:
        raise HTTPException(503, "Model not trained yet.")
    
    if req.current_stock is None:
        raise HTTPException(400, "current_stock is required for stockout prediction")
    
    features_df, family = _build_forecast_features(
        req.product_name, req.category, req.price,
        req.horizon_days, req.is_holiday, req.is_promotion
    )
    
    predictions = demand_model.predict(features_df)
    if not isinstance(predictions, list):
        predictions = [predictions]
    
    daily_demands = [p['predicted_demand'] for p in predictions]
    
    stockout = calculate_stockout(req.current_stock, daily_demands)
    reorder = calculate_reorder(
        daily_demands, req.current_stock,
        DEFAULT_LEAD_TIME_DAYS, DEFAULT_SAFETY_STOCK
    )
    
    return {
        "product": req.product_name,
        "current_stock": req.current_stock,
        "daily_forecasts": daily_demands,
        "stockout": stockout,
        "reorder": reorder,
    }


@app.post("/predict/simulate")
async def simulate(req: SimulateRequest):
    """
    🔮 BUSINESS TIME MACHINE
    
    Shows what happens to demand when you change:
    - Holiday: ON/OFF
    - Promotion: ON/OFF
    - Forecast horizon: 1-30 days
    
    Returns BASELINE (no changes) vs SIMULATED (with changes)
    so the user sees the exact DELTA.
    """
    if not demand_model.is_loaded:
        raise HTTPException(503, "Model not trained yet.")
    
    # Baseline: no holiday, no promo
    baseline_df, family = _build_forecast_features(
        req.product_name, req.category, req.price,
        req.horizon_days, False, False
    )
    baseline_preds = demand_model.predict(baseline_df)
    if not isinstance(baseline_preds, list):
        baseline_preds = [baseline_preds]
    
    # Simulated: with the user's toggles
    sim_df, _ = _build_forecast_features(
        req.product_name, req.category, req.price,
        req.horizon_days, req.is_holiday, req.is_promotion
    )
    sim_preds = demand_model.predict(sim_df)
    if not isinstance(sim_preds, list):
        sim_preds = [sim_preds]
    
    # Calculate deltas
    today = datetime.now()
    comparisons = []
    for i in range(len(baseline_preds)):
        base = baseline_preds[i]['predicted_demand']
        sim = sim_preds[i]['predicted_demand']
        delta = sim - base
        delta_pct = round((delta / base * 100), 1) if base > 0 else 0
        target_date = today + timedelta(days=i+1)
        
        comparisons.append({
            'date': target_date.strftime('%Y-%m-%d'),
            'day_name': target_date.strftime('%A'),
            'baseline_demand': base,
            'simulated_demand': sim,
            'delta': round(delta, 1),
            'delta_pct': delta_pct,
        })
    
    # Stockout comparison (if stock provided)
    stockout_comparison = None
    if req.current_stock is not None:
        base_demands = [p['predicted_demand'] for p in baseline_preds]
        sim_demands = [p['predicted_demand'] for p in sim_preds]
        stockout_comparison = {
            'baseline': calculate_stockout(req.current_stock, base_demands),
            'simulated': calculate_stockout(req.current_stock, sim_demands),
        }
    
    return {
        "product": req.product_name,
        "simulation_params": {
            "is_holiday": req.is_holiday,
            "is_promotion": req.is_promotion,
            "horizon_days": req.horizon_days,
        },
        "comparisons": comparisons,
        "stockout_comparison": stockout_comparison,
        "total_baseline": round(sum(p['predicted_demand'] for p in baseline_preds), 1),
        "total_simulated": round(sum(p['predicted_demand'] for p in sim_preds), 1),
    }


@app.post("/explain")
async def explain_prediction(req: ExplainRequest):
    """
    🔍 SHAP EXPLANATION
    Shows WHY the model predicted a certain demand.
    """
    if not demand_model.is_loaded:
        raise HTTPException(503, "Model not trained yet.")
    if explainer_instance is None:
        raise HTTPException(503, "SHAP explainer not available.")
    
    features_df, family = _build_forecast_features(
        req.product_name, req.category, req.price, 1, req.is_holiday, req.is_promotion
    )
    
    # Get prediction
    prediction = demand_model.predict(features_df)
    
    # Get SHAP explanation
    explanation = explainer_instance.explain(features_df[demand_model.feature_columns])
    
    return {
        "product": req.product_name,
        "mapped_family": family,
        "prediction": prediction,
        "explanation": explanation,
    }


@app.post("/ceo-brief")
async def ceo_brief(req: CEOBriefRequest):
    """
    👔 CEO BRIEF
    Generates the daily action summary from ML predictions.
    
    Input: List of products with current stock
    Output: Prioritized action list + summary stats
    """
    if not demand_model.is_loaded:
        raise HTTPException(503, "Model not trained yet.")
    
    all_predictions = []
    
    for product in req.products:
        name = product.get('name', 'Unknown')
        category = product.get('category', None)
        stock = product.get('current_stock', 0)
        price = product.get('price', 0)
        
        features_df, family = _build_forecast_features(name, category, price, 7, False, False)
        predictions = demand_model.predict(features_df)
        if not isinstance(predictions, list):
            predictions = [predictions]
        
        daily_demands = [p['predicted_demand'] for p in predictions]
        
        stockout = calculate_stockout(stock, daily_demands)
        reorder = calculate_reorder(daily_demands, stock, req.lead_time_days, req.safety_stock)
        slow_moving = detect_slow_moving(daily_demands, 0, 0, 0)
        
        all_predictions.append({
            'product_name': name,
            'family': family,
            'current_stock': stock,
            'forecast_7d': daily_demands,
            'total_forecast': round(sum(daily_demands), 1),
            'stockout': stockout,
            'reorder': reorder,
            'slow_moving': slow_moving,
        })
    
    # Generate prioritized actions
    actions = generate_actions(all_predictions)
    
    # Summary stats
    total_forecast_revenue = 0
    critical_count = sum(1 for a in actions if a['priority'] == 'CRITICAL')
    high_count = sum(1 for a in actions if a['priority'] == 'HIGH')
    
    return {
        "generated_at": datetime.now().isoformat(),
        "data_points": len(req.products) * 7,  # products × 7 days forecast
        "prediction_runs": len(req.products),
        "actions": actions,
        "summary": {
            "critical_alerts": critical_count,
            "high_alerts": high_count,
            "total_actions": len(actions),
            "products_analyzed": len(req.products),
        },
        "model_info": demand_model.get_model_info(),
    }


@app.get("/metrics")
async def get_metrics():
    """
    📊 FORECAST MONITORING
    Returns model evaluation metrics for the trust layer.
    """
    if not demand_model.is_loaded:
        raise HTTPException(503, "Model not trained yet.")
    
    return demand_model.get_model_info()


# ─── Run Server ─────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
