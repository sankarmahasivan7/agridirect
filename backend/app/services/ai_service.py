"""
AI forecasting & price recommendation logic.

Hard rule enforced throughout this module: nothing here ever writes to
ProductListing.quantity_available or ProductListing.price_per_unit. AI output
is always returned as a separate, clearly-labeled structure (spec sections
20-21, 43).
"""
import json
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path
from typing import Optional

import joblib
import pandas as pd
from sqlalchemy.orm import Session

from app.models.models import ProductListing, Product

ML_DIR = Path(__file__).resolve().parents[3] / "ml"
DEMAND_MODEL_PATH = ML_DIR / "models" / "demand_model.joblib"
DEMAND_METRICS_PATH = ML_DIR / "models" / "demand_model_metrics.json"
PRICE_MODEL_PATH = ML_DIR / "models" / "price_model.joblib"
PRICE_METRICS_PATH = ML_DIR / "models" / "price_model_metrics.json"

_demand_model_cache = None
_price_model_cache = None


def _load_demand_model():
    global _demand_model_cache
    if _demand_model_cache is None and DEMAND_MODEL_PATH.exists():
        _demand_model_cache = joblib.load(DEMAND_MODEL_PATH)
    return _demand_model_cache


def _load_price_model():
    global _price_model_cache
    if _price_model_cache is None and PRICE_MODEL_PATH.exists():
        _price_model_cache = joblib.load(PRICE_MODEL_PATH)
    return _price_model_cache


def get_demand_forecast(product_name: str, category_name: str, location: Optional[str] = None) -> dict:
    bundle = _load_demand_model()
    if bundle is None:
        return {
            "available": False,
            "note": "Not enough historical data to generate a forecast. Train the demand model first.",
        }

    model = bundle["model"]
    target_date = date.today() + timedelta(days=7)

    row = pd.DataFrame([{
        "month": target_date.month,
        "day_of_week": target_date.weekday(),
        "day_of_year": target_date.timetuple().tm_yday,
        "price": 0,  # unknown at forecast time; model treats as neutral input
        "prev_week_demand": 0,
        "prev_month_demand": 0,
        "product_name": product_name,
        "category": category_name,
        "location": location or "Chennai",
        "is_festival": False,
    }])

    predicted = float(model.predict(row)[0])

    metrics = {}
    if DEMAND_METRICS_PATH.exists():
        metrics = json.loads(DEMAND_METRICS_PATH.read_text())

    return {
        "available": True,
        "forecast_quantity": round(predicted, 2),
        "target_date": target_date.isoformat(),
        "mae": metrics.get("mae"),
        "rmse": metrics.get("rmse"),
        "r2": metrics.get("r2"),
    }


def _predict_market_price(product_name: str, category_name: str, location: Optional[str], forecast_quantity: Optional[float]):
    """
    Predicts today's real market rate for this product/location from the
    trained price model (app/../ml/training/train_price_model.py) -- i.e.
    what this product is actually going for in the market right now, based
    on historical price/demand/season patterns, NOT any one farmer's listed
    price. Returns None if the price model hasn't been trained yet.
    """
    bundle = _load_price_model()
    if bundle is None:
        return None

    model = bundle["model"]
    today = date.today()
    row = pd.DataFrame([{
        "month": today.month,
        "day_of_week": today.weekday(),
        "day_of_year": today.timetuple().tm_yday,
        "demand_quantity": forecast_quantity if forecast_quantity is not None else 0,
        "product_name": product_name,
        "category": category_name,
        "location": location or "Chennai",
        "is_festival": False,
    }])
    predicted = float(model.predict(row)[0])

    metrics = {}
    if PRICE_METRICS_PATH.exists():
        metrics = json.loads(PRICE_METRICS_PATH.read_text())
    return {"predicted_price": predicted, "mae": metrics.get("mae"), "rmse": metrics.get("rmse"), "r2": metrics.get("r2")}


def get_price_recommendation(db: Session, listing: ProductListing) -> dict:
    """
    Primary signal: the trained market-price model's prediction for this
    product/location today -- a genuine "current market rate" estimate
    learned from historical price data, independent of what this or any
    other single farmer happens to have listed (this is the fix for the
    earlier version, which just averaged the platform's own active
    listings -- circular when only one or two farmers have listed a
    product). If the price model hasn't been trained yet, this honestly
    falls back to averaging comparable real listings instead of pretending
    to have a market-trained estimate.

    Returns a recommended RANGE, never a single overriding number, and never
    touches listing.price_per_unit.
    """
    forecast = get_demand_forecast(listing.product.name, listing.product.category.name, listing.location)
    forecast_qty = forecast.get("forecast_quantity") if forecast.get("available") else None

    market = _predict_market_price(listing.product.name, listing.product.category.name, listing.location, forecast_qty)

    if market is not None:
        base_price = market["predicted_price"]
        reasoning_parts = [
            f"Trained market-price model estimates the current going rate for {listing.product.name} "
            f"in {listing.location or 'this region'} at approx Rs.{base_price:.2f}/unit, based on historical "
            f"price and demand patterns (not this listing's own price)."
        ]
        if market.get("mae") is not None:
            reasoning_parts.append(f"Model accuracy on held-out data: MAE {market['mae']}, R2 {market['r2']}.")
        source = "market_model"
    else:
        # Honest fallback: no trained price model yet, so use comparable real listings.
        same_product_prices = [
            float(l.price_per_unit) for l in
            db.query(ProductListing)
            .filter(ProductListing.product_id == listing.product_id, ProductListing.is_active == True)  # noqa: E712
            .all()
        ] or [float(listing.price_per_unit)]
        base_price = sum(same_product_prices) / len(same_product_prices)
        reasoning_parts = [
            f"No trained market-price model available yet, so this is the average of {len(same_product_prices)} "
            f"comparable active listing(s) for {listing.product.name}: Rs.{base_price:.2f}/unit."
        ]
        source = "listing_average_fallback"

    adjustment = 0.0
    if forecast.get("available"):
        current_supply = sum(
            float(l.quantity_available) for l in
            db.query(ProductListing).filter(
                ProductListing.product_id == listing.product_id, ProductListing.is_active == True  # noqa: E712
            ).all()
        )
        if current_supply > 0 and forecast_qty > current_supply * 1.1:
            adjustment = 0.05
            reasoning_parts.append(
                f"Forecast demand ({forecast_qty} units) exceeds current listed supply "
                f"({current_supply} units), suggesting some upward pressure."
            )
        elif current_supply > 0 and forecast_qty < current_supply * 0.8:
            adjustment = -0.04
            reasoning_parts.append(
                f"Forecast demand ({forecast_qty} units) is below current listed supply "
                f"({current_supply} units), suggesting some softening."
            )

    recommended_min = Decimal(str(round(base_price * (1 + adjustment - 0.03), 2)))
    recommended_max = Decimal(str(round(base_price * (1 + adjustment + 0.05), 2)))

    return {
        "recommended_min": recommended_min,
        "recommended_max": recommended_max,
        "reasoning": " ".join(reasoning_parts),
        "source": source,
    }
