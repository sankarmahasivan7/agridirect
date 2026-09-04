from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.deps import require_role
from app.models.models import (
    User, RoleEnum, Product, ProductListing, BulkRequirement, SupplierMatch
)
from app.schemas.schemas import BulkRequirementCreate, BulkMatchResult, MatchOut

router = APIRouter(prefix="/api/bulk-requirements", tags=["bulk"])


@router.post("", response_model=BulkMatchResult, status_code=201)
def create_bulk_requirement(
    payload: BulkRequirementCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(RoleEnum.buyer)),
):
    """
    Greedy supplier matching against REAL, currently-active listings only
    (spec section 16). If total available supply is less than requested,
    we report the actual matched quantity and the honest supply gap --
    we never fabricate additional supply to make the numbers look complete.
    """
    product = db.query(Product).filter(Product.name.ilike(payload.product_name)).first()
    if not product:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No product named '{payload.product_name}' exists yet")

    requirement = BulkRequirement(
        buyer_id=user.buyer_profile.id,
        product_id=product.id,
        required_quantity=payload.required_quantity,
        unit=payload.unit,
        needed_by=payload.needed_by,
        delivery_location=payload.delivery_location,
    )
    db.add(requirement)
    db.flush()

    candidates = (
        db.query(ProductListing)
        .filter(
            ProductListing.product_id == product.id,
            ProductListing.is_active == True,          # noqa: E712
            ProductListing.quantity_available > 0,
        )
        .order_by(ProductListing.price_per_unit.asc())  # cheapest real supply first
        .all()
    )

    remaining = payload.required_quantity
    matches_out: list[MatchOut] = []
    matched_total = Decimal("0")

    for listing in candidates:
        if remaining <= 0:
            break
        take = min(remaining, listing.quantity_available)
        if take <= 0:
            continue
        db.add(SupplierMatch(requirement_id=requirement.id, listing_id=listing.id, matched_quantity=take))
        matched_total += take
        remaining -= take
        owner_name = listing.farmer.full_name if listing.farmer else (listing.fpo.organization_name if listing.fpo else "Unknown")
        matches_out.append(MatchOut(
            listing_id=listing.id, farmer_or_fpo=owner_name,
            matched_quantity=take, price_per_unit=listing.price_per_unit,
        ))

    requirement.status = "MATCHED" if remaining <= 0 else ("PARTIALLY_MATCHED" if matched_total > 0 else "OPEN")
    db.commit()

    return BulkMatchResult(
        requirement_id=requirement.id,
        product_name=product.name,
        required_quantity=payload.required_quantity,
        matched_quantity=matched_total,
        supply_gap=max(Decimal("0"), payload.required_quantity - matched_total),
        matches=matches_out,
    )
