from typing import Optional, Dict, Any
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.deps import get_current_user
from app.models.models import User, Product, ProductListing
from app.services.ai_service import get_demand_forecast, get_price_recommendation
from app.services.route_optimization_service import optimize_transport_routes
from app.services.gemini_service import process_ai_interaction
from app.services.google_route_optimizer import plan_and_optimize_routes, explain_route_decision
from app.schemas.schemas import (
    DemandForecastOut, PriceRecommendationOut, RouteOptimizationOut,
    VoiceInteractIn, VoiceInteractOut, RouteExplainIn
)

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.get("/demand-prediction", response_model=DemandForecastOut)
def demand_prediction(product_name: str, location: Optional[str] = None, db: Session = Depends(get_db)):
    """
    Predicts future demand using actual historical orders and buyer requirements from the database.
    Honesty guarantee:
    - If insufficient historical data exists, returns:
      "Not enough historical data for reliable forecasting."
    - Displays:
      * ACTUAL SUPPLY
      * AI FORECAST
      * POTENTIAL SUPPLY GAP
    - Never fabricates fake predictions.
    """
    product = db.query(Product).filter(Product.name.ilike(product_name)).first()
    if not product:
        raise HTTPException(404, f"No product named '{product_name}' exists yet")

    result = get_demand_forecast(product.name, product.category.name, location, db=db)

    return DemandForecastOut(
        product_name=product.name,
        location=location,
        actual_supply=Decimal(str(result.get("actual_supply", 0.0))),
        ai_forecast=Decimal(str(result["ai_forecast"])) if result.get("ai_forecast") is not None else None,
        forecast_quantity=Decimal(str(result.get("forecast_quantity", 0.0))),
        potential_supply_gap=Decimal(str(result["potential_supply_gap"])) if result.get("potential_supply_gap") is not None else None,
        has_sufficient_data=result.get("has_sufficient_data", False),
        historical_points_count=result.get("historical_points_count", 0),
        status_message=result.get("status_message", "Not enough historical data for reliable forecasting."),
        trend=result.get("trend", "UNKNOWN"),
        forecast_change_percent=result.get("forecast_change_percent"),
        target_date=result.get("target_date"),
        mae=result.get("mae"),
        rmse=result.get("rmse"),
        r2=result.get("r2"),
        note=result.get("note"),
        label="AI FORECAST",
    )


@router.get("/price-recommendation/{listing_id}", response_model=PriceRecommendationOut)
def price_recommendation(listing_id: int, db: Session = Depends(get_db)):
    """
    Recommends a fair market price range based on historical data, demand, location, and perishability.
    Hard rule: NEVER mutates or overrides the farmer's listed price.
    """
    listing = db.query(ProductListing).filter(ProductListing.id == listing_id).first()
    if not listing:
        raise HTTPException(404, "Listing not found")

    rec = get_price_recommendation(db, listing)
    return PriceRecommendationOut(
        product_name=listing.product.name,
        actual_farmer_price=listing.price_per_unit,
        recommended_min=rec["recommended_min"],
        recommended_max=rec["recommended_max"],
        recommended_range_str=rec.get("recommended_range_str"),
        label="AI RECOMMENDATION",
        reasoning=rec["reasoning"],
        price_autonomy_guarantee=rec.get(
            "price_autonomy_guarantee",
            "The AI recommendation never automatically changes the farmer's price. You maintain 100% price autonomy."
        ),
        perishability_status=rec.get("perishability_status"),
        expected_sell_by_date=rec.get("expected_sell_by_date"),
        recommended_action=rec.get("recommended_action"),
        eligible_channels=rec.get("eligible_channels", []),
    )


@router.get("/route-optimization", response_model=RouteOptimizationOut)
def route_optimization(
    vehicle_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Optimizes pickup and delivery routes for real pending/accepted logistics jobs using Google OR-Tools.
    Optimizes distance, vehicle capacity, minimal trips, delivery constraints, and perishability priority.
    If no real jobs exist in the database, returns an honest empty state.
    """
    return optimize_transport_routes(db, user, vehicle_id)


@router.post("/voice/interact", response_model=VoiceInteractOut)
def voice_assistant_interact(
    payload: VoiceInteractIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Role-aware AI Voice Assistant interaction endpoint.
    Processes voice or text requests through Gemini API decision layer with strictly validated tool calls.
    Returns honest responses based on real database records in English or Tamil.
    """
    result = process_ai_interaction(
        db=db,
        user=user,
        user_prompt=payload.user_prompt,
        conversation_history=payload.conversation_history,
        language=payload.language or "en",
    )
    return VoiceInteractOut(
        response_text=result.get("response_text", ""),
        language=result.get("language", "en"),
        user_role=result.get("user_role", user.role.value if hasattr(user.role, "value") else str(user.role)),
        actions_executed=result.get("actions_executed", []),
        timestamp=result.get("timestamp", ""),
    )


@router.post("/logistics/explain-route")
def explain_route(
    payload: RouteExplainIn,
    user: User = Depends(get_current_user),
):
    """
    Provides an AI explanation for why a specific vehicle and route was chosen.
    Explains vehicle capacity, bike <= 50kg immediate dispatch rule, truck >= 35% fill threshold,
    and multi-warehouse sequencing.
    """
    explanation = explain_route_decision(payload.route_plan)
    return {
        "explanation": explanation,
        "label": "AI ROUTE EXPLANATION",
    }


@router.get("/logistics/plans")
def get_route_plans(
    vehicle_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Generates intelligent route optimization plans using Google Distance Matrix & Road Networks
    across the 3 pilot warehouses (Tenkasi, Tirunelveli, Thoothukudi).
    Groups compatible orders and enforces Bike <= 50kg and Truck >= 35% fill constraints.
    """
    return plan_and_optimize_routes(db=db, transporter_user=user, preferred_vehicle_id=vehicle_id)

