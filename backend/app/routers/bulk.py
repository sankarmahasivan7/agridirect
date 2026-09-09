from datetime import date
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.core.config import settings
from app.core.deps import require_role
from app.models.models import (
    User, RoleEnum, Product, ProductListing, BulkRequirement, SupplierMatch
)
from app.schemas.schemas import BulkRequirementCreate, BulkMatchResult, MatchOut, BulkRequirementOut
from app.services.transport_service import calculate_logistics_cost
from app.utils.geo import haversine_km, resolve_location_coords

router = APIRouter(prefix="/api/bulk-requirements", tags=["bulk"])


@router.post("", response_model=BulkMatchResult, status_code=201)
def create_bulk_requirement(
    payload: BulkRequirementCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(RoleEnum.buyer)),
):
    """
    Supply-demand matching engine (spec section 16):
    1. Searches actual active farmer/FPO listings only.
    2. Ranks candidate listings using multi-criteria formula:
       - product compatibility (strict query filter)
       - quality grade match (matching grade prioritized)
       - perishability & shelf-life (avoids spoilage risk)
       - estimated delivered unit cost (farmer price + logistics + 2% platform fee)
       - proximity/distance (nearby farmers prioritized)
       - available quantity (larger batches prioritized to reduce fragmentation)
    3. Multi-supplier collective fulfillment (e.g. Farmer A 300kg + Farmer B 500kg + FPO 200kg = 1000kg).
    4. Honest supply gap reporting (e.g. '700 kg available, 300 kg supply gap.')
       NEVER invent missing quantity.
    5. Shows actual farmer price separately from logistics cost and platform fee.
    6. Farmer/FPO remains direct seller; AgriDirect only coordinates without commercial intermediaries.
    """
    product = db.query(Product).filter(Product.name.ilike(payload.product_name.strip())).first()
    if not product:
        # Check partial match
        product = db.query(Product).filter(Product.name.ilike(f"%{payload.product_name.strip()}%")).first()
    if not product:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            f"No product named '{payload.product_name}' exists yet. Please verify product name."
        )

    # Determine buyer delivery coordinates
    b_lat = float(payload.delivery_latitude) if payload.delivery_latitude is not None else None
    b_lon = float(payload.delivery_longitude) if payload.delivery_longitude is not None else None

    if (b_lat is None or b_lon is None) and user.buyer_profile:
        if user.buyer_profile.default_latitude is not None and user.buyer_profile.default_longitude is not None:
            b_lat = float(user.buyer_profile.default_latitude)
            b_lon = float(user.buyer_profile.default_longitude)

    if (b_lat is None or b_lon is None) and payload.delivery_location:
        res_lat, res_lon = resolve_location_coords(payload.delivery_location)
        if res_lat is not None and res_lon is not None:
            b_lat, b_lon = res_lat, res_lon

    requirement = BulkRequirement(
        buyer_id=user.buyer_profile.id,
        product_id=product.id,
        required_quantity=payload.required_quantity,
        unit=payload.unit,
        needed_by=payload.needed_by,
        delivery_location=payload.delivery_location,
        quality_grade=payload.quality_grade,
        delivery_latitude=Decimal(str(round(b_lat, 6))) if b_lat is not None else None,
        delivery_longitude=Decimal(str(round(b_lon, 6))) if b_lon is not None else None,
    )
    db.add(requirement)
    db.flush()

    # Query REAL, currently-active listings for this product
    candidates = (
        db.query(ProductListing)
        .options(
            joinedload(ProductListing.farmer),
            joinedload(ProductListing.fpo),
            joinedload(ProductListing.product),
        )
        .filter(
            ProductListing.product_id == product.id,
            ProductListing.is_active == True,          # noqa: E712
            ProductListing.quantity_available > 0,
        )
        .all()
    )

    candidate_evaluations = []
    for listing in candidates:
        # Determine seller details & coordinates
        if listing.farmer:
            seller_name = listing.farmer.full_name
            seller_type = "farmer"
            seller_loc = listing.farmer.farm_location or listing.farmer.village_town or listing.location or "Farm"
            s_lat = float(listing.farmer.farm_latitude) if listing.farmer.farm_latitude is not None else None
            s_lon = float(listing.farmer.farm_longitude) if listing.farmer.farm_longitude is not None else None
        elif listing.fpo:
            seller_name = listing.fpo.organization_name
            seller_type = "fpo"
            seller_loc = listing.fpo.location or listing.location or "FPO Facility"
            s_lat = float(listing.fpo.latitude) if listing.fpo.latitude is not None else None
            s_lon = float(listing.fpo.longitude) if listing.fpo.longitude is not None else None
        else:
            seller_name = "Independent Producer"
            seller_type = "farmer"
            seller_loc = listing.location or "Local Area"
            s_lat, s_lon = None, None

        # Distance calculation
        dist_km = 0.0
        if b_lat is not None and b_lon is not None and s_lat is not None and s_lon is not None:
            dist_km = haversine_km(b_lat, b_lon, s_lat, s_lon)

        status = listing.calculate_perishability_status()
        if status == "EXPIRED":
            continue

        strategy = (
            "aggregation_hub"
            if dist_km > settings.LOGISTICS_LONG_DISTANCE_THRESHOLD_KM
            else "direct"
        )

        # Quality match penalty (0 = match or not specified, 1 = mismatch)
        quality_penalty = 0
        if payload.quality_grade and payload.quality_grade.strip():
            req_q = payload.quality_grade.strip().lower()
            lst_q = (listing.quality_grade or "").strip().lower()
            if req_q not in lst_q and lst_q not in req_q:
                quality_penalty = 1

        # Perishability & shelf life penalty
        perishability_penalty = 0
        if listing.is_perishable:
            if payload.needed_by and listing.shelf_life_days is not None:
                days_ahead = (payload.needed_by - date.today()).days
                if days_ahead > listing.shelf_life_days:
                    perishability_penalty += 2
            # Perishable batches over long distances have higher spoilage risk
            if dist_km > 150.0:
                perishability_penalty += 1

        # Prioritize suitable bulk buyers for urgent batches approaching sell-by date
        urgency_priority = 1
        if status in ["CRITICAL", "URGENT", "SELL SOON"] and dist_km <= 100.0:
            urgency_priority = 0

        # Estimated delivered cost per unit
        sample_weight = min(float(payload.required_quantity), float(listing.quantity_available))
        logistics_for_sample = calculate_logistics_cost(sample_weight, dist_km, strategy)
        unit_logistics = (logistics_for_sample / Decimal(str(sample_weight))) if sample_weight > 0 else Decimal("0")
        fee_pct = Decimal(str(settings.PLATFORM_FEE_PERCENT)) / Decimal("100")
        unit_platform_fee = listing.price_per_unit * fee_pct
        est_delivered_unit_cost = listing.price_per_unit + unit_logistics + unit_platform_fee

        # Multi-criteria rank key:
        # (quality_penalty, urgency_priority, perishability_penalty, est_delivered_unit_cost, dist_km, -available_qty)
        rank_key = (
            quality_penalty,
            urgency_priority,
            perishability_penalty,
            float(est_delivered_unit_cost),
            round(dist_km, 2),
            -float(listing.quantity_available),
        )

        candidate_evaluations.append({
            "rank_key": rank_key,
            "listing": listing,
            "seller_name": seller_name,
            "seller_type": seller_type,
            "seller_loc": seller_loc,
            "dist_km": dist_km,
            "strategy": strategy,
        })

    # Sort candidates according to multi-criteria ranking
    candidate_evaluations.sort(key=lambda x: x["rank_key"])

    # Multi-supplier collective fulfillment
    remaining = payload.required_quantity
    matches_out: list[MatchOut] = []
    matched_total = Decimal("0")
    total_farmer_price = Decimal("0")
    total_logistics_cost = Decimal("0")
    total_platform_fee = Decimal("0")

    for cand in candidate_evaluations:
        if remaining <= 0:
            break
        listing = cand["listing"]
        take = min(remaining, listing.quantity_available)
        if take <= 0:
            continue

        dist_km = cand["dist_km"]
        strategy = cand["strategy"]

        farmer_subtotal = Decimal(str(round(take * listing.price_per_unit, 2)))
        logistics_fee = calculate_logistics_cost(take, dist_km, strategy)
        fee_pct = Decimal(str(settings.PLATFORM_FEE_PERCENT)) / Decimal("100")
        plat_fee = Decimal(str(round(farmer_subtotal * fee_pct, 2)))
        delivered_subtotal = farmer_subtotal + logistics_fee + plat_fee

        total_farmer_price += farmer_subtotal
        total_logistics_cost += logistics_fee
        total_platform_fee += plat_fee
        matched_total += take
        remaining -= take

        db.add(SupplierMatch(
            requirement_id=requirement.id,
            listing_id=listing.id,
            matched_quantity=take,
            farmer_price=listing.price_per_unit,
            logistics_cost=logistics_fee,
            platform_fee=plat_fee,
        ))

        matches_out.append(MatchOut(
            listing_id=listing.id,
            product_name=listing.product.name,
            seller_name=cand["seller_name"],
            farmer_or_fpo=cand["seller_name"],
            seller_type=cand["seller_type"],
            matched_quantity=take,
            unit=listing.unit,
            price_per_unit=listing.price_per_unit,
            farmer_subtotal=farmer_subtotal,
            distance_km=Decimal(str(round(dist_km, 1))) if dist_km > 0 else Decimal("0"),
            logistics_cost=logistics_fee,
            platform_fee=plat_fee,
            delivered_subtotal=delivered_subtotal,
            quality_grade=listing.quality_grade,
            is_perishable=listing.is_perishable,
            shelf_life_days=listing.shelf_life_days,
            location=cand["seller_loc"],
            line_subtotal=delivered_subtotal,
        ))

    # Honest supply gap calculation
    def _format_qty(qty: Decimal) -> str:
        if qty == int(qty):
            return str(int(qty))
        return f"{qty:.2f}".rstrip("0").rstrip(".")

    supply_gap = max(Decimal("0"), payload.required_quantity - matched_total)
    if supply_gap > 0:
        summary_msg = f"{_format_qty(matched_total)} {payload.unit} available, {_format_qty(supply_gap)} {payload.unit} supply gap."
        requirement.status = "PARTIALLY_MATCHED" if matched_total > 0 else "OPEN"
    else:
        summary_msg = f"{_format_qty(matched_total)} {payload.unit} fully matched across {len(matches_out)} producer(s)."
        requirement.status = "MATCHED"

    total_delivered_cost = total_farmer_price + total_logistics_cost + total_platform_fee
    db.commit()

    return BulkMatchResult(
        requirement_id=requirement.id,
        product_name=product.name,
        required_quantity=payload.required_quantity,
        unit=payload.unit,
        quality_grade=payload.quality_grade,
        matched_quantity=matched_total,
        supply_gap=supply_gap,
        total_farmer_price=total_farmer_price,
        total_logistics_cost=total_logistics_cost,
        total_platform_fee=total_platform_fee,
        total_delivered_cost=total_delivered_cost,
        matches=matches_out,
        summary_message=summary_msg,
    )


@router.get("", response_model=list[BulkRequirementOut])
def list_bulk_requirements(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(RoleEnum.buyer, RoleEnum.admin)),
):
    query = db.query(BulkRequirement).options(
        joinedload(BulkRequirement.product),
        joinedload(BulkRequirement.matches).joinedload(SupplierMatch.listing).joinedload(ProductListing.farmer),
        joinedload(BulkRequirement.matches).joinedload(SupplierMatch.listing).joinedload(ProductListing.fpo),
    )
    if user.role == RoleEnum.buyer:
        query = query.filter(BulkRequirement.buyer_id == user.buyer_profile.id)
    reqs = query.order_by(BulkRequirement.created_at.desc()).all()

    out = []
    for r in reqs:
        m_list = []
        for m in r.matches:
            owner = (
                m.listing.farmer.full_name
                if m.listing.farmer
                else (m.listing.fpo.organization_name if m.listing.fpo else "Producer")
            )
            s_type = "fpo" if m.listing.fpo else "farmer"
            f_sub = (
                m.matched_quantity * m.farmer_price
                if m.farmer_price
                else m.matched_quantity * m.listing.price_per_unit
            )
            l_cost = m.logistics_cost or Decimal("0")
            p_fee = m.platform_fee or Decimal("0")
            d_sub = f_sub + l_cost + p_fee
            m_list.append(MatchOut(
                listing_id=m.listing_id,
                product_name=r.product.name,
                seller_name=owner,
                farmer_or_fpo=owner,
                seller_type=s_type,
                matched_quantity=m.matched_quantity,
                unit=r.unit,
                price_per_unit=m.farmer_price or m.listing.price_per_unit,
                farmer_subtotal=Decimal(str(round(f_sub, 2))),
                distance_km=None,
                logistics_cost=l_cost,
                platform_fee=p_fee,
                delivered_subtotal=Decimal(str(round(d_sub, 2))),
                quality_grade=m.listing.quality_grade,
                is_perishable=m.listing.is_perishable,
                shelf_life_days=m.listing.shelf_life_days,
                location=m.listing.location,
                line_subtotal=Decimal(str(round(d_sub, 2))),
            ))
        out.append(BulkRequirementOut(
            id=r.id,
            product_name=r.product.name,
            required_quantity=r.required_quantity,
            unit=r.unit,
            needed_by=r.needed_by,
            delivery_location=r.delivery_location,
            quality_grade=r.quality_grade,
            status=r.status,
            matches=m_list,
            created_at=r.created_at,
        ))
    return out
