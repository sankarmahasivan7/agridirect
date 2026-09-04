from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.models.models import ProductListing, Product, Category
from app.routers.listings import _serialize
from app.schemas.schemas import ListingOut

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
):
    """
    Returns ONLY real listings from the database (spec section 9/12).
    An empty database (or no matches) returns an empty list -- the frontend
    renders "No products are currently available." rather than inventing data.
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
    return [_serialize(listing) for listing in listings]


@router.get("/{listing_id}", response_model=ListingOut)
def listing_detail(listing_id: int, db: Session = Depends(get_db)):
    listing = db.query(ProductListing).options(
        joinedload(ProductListing.product).joinedload(Product.category),
        joinedload(ProductListing.farmer), joinedload(ProductListing.fpo),
    ).filter(ProductListing.id == listing_id).first()
    if not listing:
        raise HTTPException(404, "Listing not found")
    return _serialize(listing)
