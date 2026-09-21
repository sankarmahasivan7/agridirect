from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.core.deps import get_current_user, require_role
from app.models.models import (
    User, RoleEnum, Product, Category, ProductListing, BulkRequirement, SupplierMatch, Notification, BuyerProfile
)
from app.schemas.schemas import AdvanceDemandCreate, AdvanceDemandOut, AdvanceDemandMatchOut

router = APIRouter(prefix="/api/advance-demands", tags=["advance-demands"])


def _serialize_demand(r: BulkRequirement) -> AdvanceDemandOut:
    matches_out = []
    matched_total = Decimal("0")
    for m in (r.matches or []):
        matched_total += m.matched_quantity
        fname = None
        if m.listing:
            if m.listing.farmer:
                fname = m.listing.farmer.full_name
            elif m.listing.fpo:
                fname = m.listing.fpo.organization_name
        matches_out.append(AdvanceDemandMatchOut(
            id=m.id,
            listing_id=m.listing_id,
            farmer_name=fname or "Verified Farmer",
            matched_quantity=m.matched_quantity,
            farmer_price=m.farmer_price,
            matched_at=None,
        ))

    b_name = None
    b_phone = None
    if r.buyer:
        b_name = r.buyer.full_name
        if r.buyer.user:
            b_phone = r.buyer.user.phone

    req_qty = r.required_quantity or Decimal("0")
    rem_qty = max(Decimal("0"), req_qty - matched_total)

    return AdvanceDemandOut(
        id=r.id,
        buyer_id=r.buyer_id,
        buyer_name=b_name,
        buyer_phone=b_phone,
        product_id=r.product_id,
        product_name=r.product.name if r.product else "Produce",
        required_quantity=req_qty,
        matched_quantity=matched_total,
        remaining_quantity=rem_qty,
        unit=r.unit or "kg",
        needed_by=r.needed_by,
        delivery_location=r.delivery_location,
        quality_grade=r.quality_grade,
        status=r.status,
        created_at=r.created_at,
        matches=matches_out,
    )


@router.post("", response_model=AdvanceDemandOut, status_code=201)
def create_advance_demand(
    payload: AdvanceDemandCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(RoleEnum.buyer)),
):
    """
    Advance Demand & Early Booking Engine:
    1. Buyer applies early for produce needed in upcoming days.
    2. Broadcasts high-priority push notifications to ALL registered farmers.
    3. If active listings already exist, matches immediately with priority.
    """
    clean_name = payload.product_name.strip()
    product = db.query(Product).filter(Product.name.ilike(clean_name)).first()
    if not product:
        product = db.query(Product).filter(Product.name.ilike(f"%{clean_name}%")).first()
    if not product:
        category = db.query(Category).first()
        if not category:
            category = Category(name="Vegetables")
            db.add(category)
            db.flush()
        product = Product(name=clean_name.title(), category_id=category.id, default_unit=payload.unit)
        db.add(product)
        db.flush()

    if not getattr(user, "buyer_profile", None):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Buyer profile required to create advance demand")

    req = BulkRequirement(
        buyer_id=user.buyer_profile.id,
        product_id=product.id,
        required_quantity=payload.required_quantity,
        unit=payload.unit or "kg",
        needed_by=payload.needed_by,
        delivery_location=payload.delivery_location,
        quality_grade=payload.quality_grade,
        delivery_latitude=Decimal(str(payload.delivery_latitude)) if payload.delivery_latitude else None,
        delivery_longitude=Decimal(str(payload.delivery_longitude)) if payload.delivery_longitude else None,
        status="OPEN",
        created_at=datetime.utcnow(),
    )
    db.add(req)
    db.flush()

    # Broadcast push notification to all registered farmers
    farmers = db.query(User).filter(User.role == RoleEnum.farmer).all()
    for f in farmers:
        notif = Notification(
            user_id=f.id,
            title=f"📢 Advance Demand: {payload.required_quantity} kg {product.name}",
            message=f"Buyer needs {payload.required_quantity} kg {product.name} by {payload.needed_by.strftime('%d %b %Y') if payload.needed_by else 'upcoming days'} in {payload.delivery_location}. Deliver to warehouse to secure first-priority guaranteed sale!",
            notification_type="DEMAND",
            link="/farmer/inventory",
            is_read=False,
            created_at=datetime.utcnow(),
        )
        db.add(notif)

    # Check if there are already active listings for this product that can be auto-allocated with first priority
    existing_listings = (
        db.query(ProductListing)
        .filter(
            ProductListing.product_id == product.id,
            ProductListing.is_active == True,
            ProductListing.quantity_available > 0
        )
        .order_by(ProductListing.created_at.asc())
        .all()
    )

    remaining_needed = payload.required_quantity
    for l in existing_listings:
        if remaining_needed <= 0:
            break
        alloc_qty = min(l.quantity_available, remaining_needed)
        if alloc_qty > 0:
            match = SupplierMatch(
                requirement_id=req.id,
                listing_id=l.id,
                matched_quantity=alloc_qty,
                farmer_price=l.price_per_unit,
                logistics_cost=Decimal("0"),
                platform_fee=Decimal("0"),
            )
            db.add(match)
            l.quantity_available -= alloc_qty
            if l.quantity_available <= 0:
                l.is_active = False
            remaining_needed -= alloc_qty

    if remaining_needed <= 0:
        req.status = "MATCHED"
    elif remaining_needed < payload.required_quantity:
        req.status = "PARTIALLY_MATCHED"
    else:
        req.status = "OPEN"

    db.commit()
    db.refresh(req)
    return _serialize_demand(req)


@router.get("/mine", response_model=List[AdvanceDemandOut])
def my_advance_demands(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(RoleEnum.buyer)),
):
    """Returns all advance demands placed by the current authenticated buyer."""
    if not getattr(user, "buyer_profile", None):
        return []
    reqs = (
        db.query(BulkRequirement)
        .options(
            joinedload(BulkRequirement.product),
            joinedload(BulkRequirement.buyer).joinedload(BuyerProfile.user),
            joinedload(BulkRequirement.matches).joinedload(SupplierMatch.listing).joinedload(ProductListing.farmer),
            joinedload(BulkRequirement.matches).joinedload(SupplierMatch.listing).joinedload(ProductListing.fpo),
        )
        .filter(BulkRequirement.buyer_id == user.buyer_profile.id)
        .order_by(BulkRequirement.created_at.desc())
        .all()
    )
    return [_serialize_demand(r) for r in reqs]


@router.get("/open", response_model=List[AdvanceDemandOut])
def open_advance_demands(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Returns active buyer advance demands so farmers can plan their harvest,
    bring produce to the warehouse, and fulfill priority orders.
    """
    reqs = (
        db.query(BulkRequirement)
        .options(
            joinedload(BulkRequirement.product),
            joinedload(BulkRequirement.buyer).joinedload(BuyerProfile.user),
            joinedload(BulkRequirement.matches).joinedload(SupplierMatch.listing),
        )
        .filter(BulkRequirement.status.in_(["OPEN", "PARTIALLY_MATCHED"]))
        .order_by(BulkRequirement.created_at.desc())
        .limit(50)
        .all()
    )
    return [_serialize_demand(r) for r in reqs]


@router.post("/{demand_id}/cancel", response_model=AdvanceDemandOut)
def cancel_advance_demand(
    demand_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(RoleEnum.buyer)),
):
    """Allows buyer to cancel an open advance booking request and restore allocated stock."""
    req = (
        db.query(BulkRequirement)
        .options(
            joinedload(BulkRequirement.matches).joinedload(SupplierMatch.listing),
            joinedload(BulkRequirement.product)
        )
        .filter(BulkRequirement.id == demand_id, BulkRequirement.buyer_id == user.buyer_profile.id)
        .first()
    )
    if not req:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Advance demand not found.")

    if req.status == "CLOSED":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Advance demand is already closed.")

    # Restore listing inventory if matched
    for m in req.matches:
        if m.listing:
            m.listing.quantity_available += m.matched_quantity
            m.listing.is_active = True

    req.status = "CLOSED"
    db.commit()
    db.refresh(req)
    return _serialize_demand(req)
