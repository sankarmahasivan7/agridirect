from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.core.config import settings
from app.models.models import ProductListing, Product, Category
from app.routers.listings import _serialize
from app.schemas.schemas import ListingOut
from app.utils.geo import haversine_km

router = APIRouter(prefix="/api/marketplace", tags=["marketplace"])


@router.get("", response_model=list[ListingOut])
def browse_marketplace(
    db: Session = Depends(get_db),
    q: Optional[str] = Query(None, description="Search by product name"),
    category: Optional[str] = None,
    location: Optional[str] = None,
    min_price: Optional[Decimal] = None,
    max_price: Optional[Decimal] = None,
    min_quantity: Optional[Decimal] = None,
    quality_grade: Optional[str] = None,
    is_perishable: Optional[bool] = None,
    channel: Optional[str] = Query(None, description="Buyer channel: consumer, restaurant, retailer, processor"),
    perishability_status: Optional[str] = Query(None, description="Status filter: FRESH, SELL SOON, URGENT, CRITICAL"),
    buyer_lat: Optional[float] = Query(None, description="Buyer latitude for proximity sorting"),
    buyer_lon: Optional[float] = Query(None, description="Buyer longitude for proximity sorting"),
):
    """
    Returns ONLY real listings from the database (spec section 9/12).
    Enforces food safety: products past their sell-by date (EXPIRED) are NEVER
    offered to consumers.
    Prioritizes nearby buyers and urgent batches to reduce avoidable post-harvest waste.
    """
    query = db.query(ProductListing).options(
        joinedload(ProductListing.product).joinedload(Product.category),
        joinedload(ProductListing.farmer), joinedload(ProductListing.fpo),
    ).filter(ProductListing.is_active == True, ProductListing.quantity_available > 0)  # noqa: E712

    if q:
        query = query.join(Product).filter(Product.name.ilike(f"%{q}%"))
    if category:
        query = query.join(Category, Product.category_id == Category.id).filter(Category.name.ilike(f"%{category}%"))
    if location:
        query = query.filter(ProductListing.location.ilike(f"%{location}%"))
    if min_price is not None:
        query = query.filter(ProductListing.price_per_unit >= min_price)
    if max_price is not None:
        query = query.filter(ProductListing.price_per_unit <= max_price)
    if min_quantity is not None:
        query = query.filter(ProductListing.quantity_available >= min_quantity)
    if quality_grade:
        query = query.filter(ProductListing.quality_grade == quality_grade)
    if is_perishable is not None:
        query = query.filter(ProductListing.is_perishable == is_perishable)

    listings = query.order_by(ProductListing.created_at.desc()).all()

    items_with_dist = []
    eff_channel = (channel or "consumer").upper()

    for listing in listings:
        status = listing.calculate_perishability_status()
        channels = listing.get_eligible_channels()

        # Food Safety Rule: NEVER offer products to consumers after they are no longer safe for human consumption
        if status == "EXPIRED":
            continue

        # Secondary channel routing (consumer vs restaurant/retailer/processor)
        if eff_channel == "CONSUMER" and "CONSUMER" not in channels:
            continue
        elif eff_channel in ["PROCESSOR", "RESTAURANT", "RETAILER"] and eff_channel not in channels:
            continue

        if perishability_status and status.upper() != perishability_status.strip().upper():
            continue

        dist_km = None
        s_lat, s_lon = None, None
        if listing.farmer and listing.farmer.farm_latitude is not None and listing.farmer.farm_longitude is not None:
            s_lat = float(listing.farmer.farm_latitude)
            s_lon = float(listing.farmer.farm_longitude)
        elif listing.fpo and listing.fpo.latitude is not None and listing.fpo.longitude is not None:
            s_lat = float(listing.fpo.latitude)
            s_lon = float(listing.fpo.longitude)

        strategy = "direct"
        if buyer_lat is not None and buyer_lon is not None and s_lat is not None and s_lon is not None:
            dist_val = haversine_km(buyer_lat, buyer_lon, s_lat, s_lon)
            dist_km = Decimal(str(round(dist_val, 2)))
            strategy = (
                "aggregation_hub"
                if dist_val > settings.LOGISTICS_LONG_DISTANCE_THRESHOLD_KM
                else "direct"
            )

        serialized = _serialize(listing, distance_km=dist_km, recommended_strategy=strategy)

        # Prioritize nearby buyers for urgent / sell-soon batches to reduce avoidable waste
        urgency_priority = 1
        if status in ["CRITICAL", "URGENT"] and dist_km is not None and float(dist_km) <= 50.0:
            urgency_priority = 0  # Highest priority for nearby off-take

        sort_key = (
            urgency_priority if (buyer_lat is not None and buyer_lon is not None) else 0,
            float(dist_km) if dist_km is not None else float("inf"),
            -listing.id
        )
        items_with_dist.append((sort_key, serialized))

    if buyer_lat is not None and buyer_lon is not None:
        items_with_dist.sort(key=lambda x: x[0])

    return [item[1] for item in items_with_dist]


@router.get("/{listing_id}", response_model=ListingOut)
def listing_detail(listing_id: int, db: Session = Depends(get_db)):
    listing = db.query(ProductListing).options(
        joinedload(ProductListing.product).joinedload(Product.category),
        joinedload(ProductListing.farmer), joinedload(ProductListing.fpo),
    ).filter(ProductListing.id == listing_id).first()
    if not listing:
        raise HTTPException(404, "Listing not found")
    return _serialize(listing)
