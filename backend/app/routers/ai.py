from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.deps import get_current_user
from app.models.models import User, Product, ProductListing
from app.services.ai_service import get_demand_forecast, get_price_recommendation
from app.schemas.schemas import DemandForecastOut, PriceRecommendationOut

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.get("/demand-prediction", response_model=DemandForecastOut)
def demand_prediction(product_name: str, location: str | None = None, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.name.ilike(product_name)).first()
    if not product:
        raise HTTPException(404, f"No product named '{product_name}' exists yet")

    result = get_demand_forecast(product.name, product.category.name, location)
    if not result.get("available"):
        return DemandForecastOut(
            product_name=product.name, location=location, forecast_quantity=0,
            trend="UNKNOWN", forecast_change_percent=None, mae=None, rmse=None, r2=None,
            note=result.get("note"),
        )

    # current active supply for trend comparison (real DB data)
    current_supply = sum(
        float(l.quantity_available) for l in
        db.query(ProductListing).filter(ProductListing.product_id == product.id, ProductListing.is_active == True).all()  # noqa: E712
    )
    forecast_qty = result["forecast_quantity"]
    if current_supply > 0:
        change_pct = round(((forecast_qty - current_supply) / current_supply) * 100, 1)
        trend = "HIGH" if change_pct > 10 else ("LOW" if change_pct < -10 else "STABLE")
    else:
        change_pct = None
        trend = "UNKNOWN"

    return DemandForecastOut(
        product_name=product.name, location=location, forecast_quantity=forecast_qty,
        trend=trend, forecast_change_percent=change_pct,
        mae=result.get("mae"), rmse=result.get("rmse"), r2=result.get("r2"),
    )


@router.get("/price-recommendation/{listing_id}", response_model=PriceRecommendationOut)
def price_recommendation(listing_id: int, db: Session = Depends(get_db)):
    listing = db.query(ProductListing).filter(ProductListing.id == listing_id).first()
    if not listing:
        raise HTTPException(404, "Listing not found")

    rec = get_price_recommendation(db, listing)
    return PriceRecommendationOut(
        product_name=listing.product.name,
        actual_farmer_price=listing.price_per_unit,
        recommended_min=rec["recommended_min"],
        recommended_max=rec["recommended_max"],
        reasoning=rec["reasoning"],
    )
