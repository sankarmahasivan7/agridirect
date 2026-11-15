from datetime import date, timedelta, datetime
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.core.deps import get_current_user, require_role
from app.models.models import (
    User, RoleEnum, ProductListing, Product, Category, FarmerProfile, FPOProfile, OrderItem,
    BulkRequirement, SupplierMatch, BuyerProfile, Notification
)
from app.schemas.schemas import ListingCreate, ListingUpdate, ListingOut
from app.services.perishability_service import check_and_notify_perishability

router = APIRouter(prefix="/api/listings", tags=["listings"])


def _get_or_create_product(db: Session, product_name: str, category_name: str, unit: str) -> Product:
    category = db.query(Category).filter(Category.name == category_name).first()
    if not category:
        category = Category(name=category_name)
        db.add(category)
        db.flush()
    product = db.query(Product).filter(
        Product.name == product_name, Product.category_id == category.id
    ).first()
    if not product:
        product = Product(name=product_name, category_id=category.id, default_unit=unit)
        db.add(product)
        db.flush()
    return product


def _serialize(
    listing: ProductListing,
    distance_km: Optional[Decimal] = None,
    recommended_strategy: Optional[str] = None,
) -> ListingOut:
    sell_by = listing.get_expected_sell_by_date()
    days_left = (sell_by - date.today()).days if sell_by else None
    status = listing.calculate_perishability_status()
    channels = listing.get_eligible_channels()

    # Real farmer rating & review count (starts at 5.0 initially, reduced if buyer rates lowly)
    farmer_rating = 5.0
    farmer_review_count = 0
    if listing.farmer and getattr(listing.farmer, "reviews", None):
        f_revs = listing.farmer.reviews
        farmer_review_count = len(f_revs)
        if farmer_review_count > 0:
            farmer_rating = round(sum(r.rating for r in f_revs) / farmer_review_count, 1)

    # Real product/listing rating
    prod_rating = farmer_rating
    prod_review_count = 0
    if getattr(listing, "reviews", None):
        l_revs = listing.reviews
        prod_review_count = len(l_revs)
        if prod_review_count > 0:
            prod_rating = round(sum(r.rating for r in l_revs) / prod_review_count, 1)

    return ListingOut(
        id=listing.id,
        product_name=listing.product.name,
        category_name=listing.product.category.name,
        farmer_name=listing.farmer.full_name if listing.farmer else None,
        fpo_name=listing.fpo.organization_name if listing.fpo else None,
        quantity_available=listing.quantity_available,
        unit=listing.unit,
        price_per_unit=listing.price_per_unit,
        quality_grade=listing.quality_grade,
        harvest_date=listing.harvest_date,
        available_from=listing.available_from,
        available_until=listing.available_until,
        location=listing.location,
        min_order_quantity=listing.min_order_quantity,
        is_perishable=listing.is_perishable,
        shelf_life_days=listing.shelf_life_days,
        expected_sell_by_date=sell_by,
        perishability_level=listing.perishability_level,
        storage_requirement=listing.storage_requirement,
        perishability_status=status,
        days_remaining=days_left,
        eligible_channels=channels,
        is_active=listing.is_active,
        distance_km=distance_km,
        recommended_strategy=recommended_strategy,
        created_at=listing.created_at,
        farmer_rating=farmer_rating,
        farmer_review_count=farmer_review_count,
        product_rating=prod_rating,
        product_review_count=prod_review_count,
    )


@router.post("", response_model=ListingOut, status_code=201)
def create_listing(
    payload: ListingCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(RoleEnum.farmer, RoleEnum.fpo)),
):
    """
    CRITICAL: whatever the farmer/FPO enters here is saved EXACTLY as entered
    (spec section 8). No transformation, no randomization of price/quantity.
    """
    product = _get_or_create_product(db, payload.product_name, payload.category_name, payload.unit)

    expected_sell_by = payload.expected_sell_by_date
    if not expected_sell_by and payload.is_perishable:
        base = payload.harvest_date or date.today()
        life = payload.shelf_life_days or 7
        expected_sell_by = base + timedelta(days=life)

    listing = ProductListing(
        product_id=product.id,
        quantity_available=payload.quantity_available,
        unit=payload.unit,
        price_per_unit=payload.price_per_unit,
        quality_grade=payload.quality_grade,
        harvest_date=payload.harvest_date,
        available_from=payload.available_from,
        available_until=payload.available_until,
        location=payload.location,
        min_order_quantity=payload.min_order_quantity or 0,
        is_perishable=payload.is_perishable,
        shelf_life_days=payload.shelf_life_days,
        expected_sell_by_date=expected_sell_by,
        perishability_level=payload.perishability_level or "HIGH",
        storage_requirement=payload.storage_requirement,
        certification_info=payload.certification_info,
        image_url=payload.image_url,
    )
    if user.role == RoleEnum.farmer:
        listing.farmer_id = user.farmer_profile.id
    else:
        listing.fpo_id = user.fpo_profile.id

    db.add(listing)
    db.commit()
    db.refresh(listing)
    check_and_notify_perishability(db, listing)
    check_and_assign_advance_demands(db, listing)
    return _serialize(listing)


def check_and_assign_advance_demands(db: Session, listing: ProductListing):
    """
    Priority Advance Booking Auto-Assignment:
    When a farmer lists produce, automatically matches and assigns it with FIRST PRIORITY
    to the earliest buyers who submitted advance crop demands (ordered by created_at ASC).
    """
    if listing.quantity_available <= 0 or not listing.is_active:
        return

    # Find open advance demands for this product, ordered by earliest applicant first (FIRST PRIORITY)
    open_demands = (
        db.query(BulkRequirement)
        .options(
            joinedload(BulkRequirement.buyer).joinedload(BuyerProfile.user),
            joinedload(BulkRequirement.matches),
            joinedload(BulkRequirement.product)
        )
        .filter(
            BulkRequirement.product_id == listing.product_id,
            BulkRequirement.status.in_(["OPEN", "PARTIALLY_MATCHED"])
        )
        .order_by(BulkRequirement.created_at.asc())
        .all()
    )

    if not open_demands:
        return

    seller_name = (
        listing.farmer.full_name if listing.farmer
        else (listing.fpo.organization_name if listing.fpo else "Verified Producer")
    )

    for demand in open_demands:
        if listing.quantity_available <= 0:
            break

        already_matched = sum(m.matched_quantity for m in (demand.matches or []))
        needed = demand.required_quantity - already_matched
        if needed <= 0:
            demand.status = "MATCHED"
            continue

        alloc_qty = min(listing.quantity_available, needed)
        if alloc_qty > 0:
            # Create SupplierMatch record
            match = SupplierMatch(
                requirement_id=demand.id,
                listing_id=listing.id,
                matched_quantity=alloc_qty,
                farmer_price=listing.price_per_unit,
                logistics_cost=Decimal("0"),
                platform_fee=Decimal("0"),
            )
            db.add(match)

            # Deduct from listing available quantity to reserve it for priority buyer
            listing.quantity_available -= alloc_qty
            if (already_matched + alloc_qty) >= demand.required_quantity:
                demand.status = "MATCHED"
            else:
                demand.status = "PARTIALLY_MATCHED"

            # 1. Send push notification to the early applicant Buyer
            if demand.buyer and demand.buyer.user_id:
                db.add(Notification(
                    user_id=demand.buyer.user_id,
                    title=f"🎉 Advance Booking Assigned: {alloc_qty} kg {listing.product.name} Reserved!",
                    message=(
                        f"Fresh {listing.product.name} has arrived from {seller_name}. "
                        f"Your advance booking has been assigned with #1 PRIORITY! "
                        f"({alloc_qty} kg reserved at ₹{listing.price_per_unit}/kg)."
                    ),
                    notification_type="ORDER",
                    link="/buyer/advance-demands",
                    is_read=False,
                    created_at=datetime.utcnow(),
                ))

            # 2. Send notification to the Farmer
            if listing.farmer and listing.farmer.user_id:
                buyer_display = demand.buyer.full_name if demand.buyer else "Advance Buyer"
                db.add(Notification(
                    user_id=listing.farmer.user_id,
                    title=f"🎯 Advance Demand Auto-Matched ({alloc_qty} kg)!",
                    message=(
                        f"{alloc_qty} kg of your {listing.product.name} listing was automatically allocated "
                        f"to priority buyer {buyer_display}."
                    ),
                    notification_type="ORDER",
                    link="/farmer/dashboard",
                    is_read=False,
                    created_at=datetime.utcnow(),
                ))

    if listing.quantity_available <= 0:
        listing.is_active = False

    db.commit()
    db.refresh(listing)



@router.get("/mine", response_model=list[ListingOut])
def my_listings(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(RoleEnum.farmer, RoleEnum.fpo)),
):
    q = db.query(ProductListing).options(
        joinedload(ProductListing.product).joinedload(Product.category),
        joinedload(ProductListing.farmer), joinedload(ProductListing.fpo),
    )
    if user.role == RoleEnum.farmer:
        q = q.filter(ProductListing.farmer_id == user.farmer_profile.id)
    else:
        q = q.filter(ProductListing.fpo_id == user.fpo_profile.id)
    listings = q.order_by(ProductListing.created_at.desc()).all()
    for l in listings:
        if l.is_active:
            check_and_notify_perishability(db, l)
    return [_serialize(l) for l in listings]


def _get_owned_listing(db: Session, listing_id: int, user: User) -> ProductListing:
    listing = db.query(ProductListing).filter(ProductListing.id == listing_id).first()
    if not listing:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Listing not found")
    owns = (
        (user.role == RoleEnum.farmer and listing.farmer_id == user.farmer_profile.id) or
        (user.role == RoleEnum.fpo and listing.fpo_id == user.fpo_profile.id)
    )
    if not owns:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not own this listing")
    return listing


@router.put("/{listing_id}", response_model=ListingOut)
def update_listing(
    listing_id: int, payload: ListingUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(RoleEnum.farmer, RoleEnum.fpo)),
):
    listing = _get_owned_listing(db, listing_id, user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(listing, field, value)
    db.commit()
    db.refresh(listing)
    return _serialize(listing)


@router.delete("/{listing_id}", status_code=204)
def delete_listing(
    listing_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(RoleEnum.farmer, RoleEnum.fpo)),
):
    listing = _get_owned_listing(db, listing_id, user)
    has_orders = db.query(OrderItem).filter(OrderItem.listing_id == listing_id).first() is not None
    if has_orders:
        listing.is_active = False
        db.commit()
    else:
        db.delete(listing)
        db.commit()
