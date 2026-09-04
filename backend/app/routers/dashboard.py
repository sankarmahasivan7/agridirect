from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.core.deps import require_role
from app.models.models import (
    User, RoleEnum, ProductListing, Order, OrderItem, OrderStatusEnum,
    Transaction, FarmerProfile, FPOProfile, BuyerProfile, Notification
)

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/farmer")
def farmer_dashboard(db: Session = Depends(get_db), user: User = Depends(require_role(RoleEnum.farmer))):
    farmer_id = user.farmer_profile.id
    listings = db.query(ProductListing).filter(ProductListing.farmer_id == farmer_id).all()
    active_listings = [l for l in listings if l.is_active]

    items = (
        db.query(OrderItem)
        .join(ProductListing)
        .filter(ProductListing.farmer_id == farmer_id)
        .options(joinedload(OrderItem.order))
        .all()
    )
    delivered_items = [i for i in items if i.order.status == OrderStatusEnum.DELIVERED]

    gross = sum((i.line_subtotal for i in delivered_items), Decimal("0"))
    # Farmer's share = gross minus platform fee share attributable to this farmer's line items
    # (proportional share of the order's platform fee, since fee is computed per order).
    net_earnings = Decimal("0")
    for i in delivered_items:
        order = i.order
        if order.subtotal > 0:
            share = i.line_subtotal / order.subtotal
            net_earnings += i.line_subtotal - (order.platform_fee * share)

    pending_orders = [i for i in items if i.order.status in (OrderStatusEnum.PENDING, OrderStatusEnum.CONFIRMED)]

    if not items:
        earnings_summary = {"gross": "0", "net_earnings": "0", "message": "No completed orders yet."}
    else:
        earnings_summary = {"gross": str(gross), "net_earnings": str(round(net_earnings, 2))}

    return {
        "active_listings_count": len(active_listings),
        "total_listings_count": len(listings),
        "pending_orders_count": len(pending_orders),
        "earnings": earnings_summary,
        "note": "All values are computed from actual listings and orders." if listings or items else
                "No listings or orders yet.",
    }


@router.get("/buyer")
def buyer_dashboard(db: Session = Depends(get_db), user: User = Depends(require_role(RoleEnum.buyer))):
    orders = db.query(Order).filter(Order.buyer_id == user.buyer_profile.id).all()
    if not orders:
        return {"total_orders": 0, "total_spent": "0", "message": "You have no orders yet."}
    total_spent = sum((o.total_amount for o in orders), Decimal("0"))
    return {
        "total_orders": len(orders),
        "total_spent": str(total_spent),
        "orders_by_status": {
            status.value: len([o for o in orders if o.status == status]) for status in OrderStatusEnum
        },
    }


@router.get("/fpo")
def fpo_dashboard(db: Session = Depends(get_db), user: User = Depends(require_role(RoleEnum.fpo))):
    fpo_id = user.fpo_profile.id
    listings = db.query(ProductListing).filter(ProductListing.fpo_id == fpo_id).all()
    members = db.query(FarmerProfile).filter(FarmerProfile.fpo_id == fpo_id).all()
    total_supply = sum((l.quantity_available for l in listings if l.is_active), Decimal("0"))

    return {
        "member_count": len(members),
        "active_listings_count": len([l for l in listings if l.is_active]),
        "total_supply_available": str(total_supply),
        "note": "No listings yet." if not listings else None,
    }


@router.get("/admin")
def admin_dashboard(db: Session = Depends(get_db), user: User = Depends(require_role(RoleEnum.admin))):
    total_users = db.query(User).count()
    farmers = db.query(User).filter(User.role == RoleEnum.farmer).count()
    fpos = db.query(User).filter(User.role == RoleEnum.fpo).count()
    buyers = db.query(User).filter(User.role == RoleEnum.buyer).count()

    active_listings = db.query(ProductListing).filter(ProductListing.is_active == True).count()  # noqa: E712

    orders = db.query(Order).all()
    gmv = sum((o.total_amount for o in orders), Decimal("0"))

    transactions = db.query(Transaction).all()
    platform_revenue = sum((t.platform_fee_amount for t in transactions), Decimal("0"))
    logistics_revenue = sum((t.logistics_revenue_amount for t in transactions), Decimal("0"))

    return {
        "total_users": total_users,
        "farmers": farmers,
        "fpos": fpos,
        "buyers": buyers,
        "active_listings": active_listings,
        "total_orders": len(orders),
        "gmv": str(gmv),
        "platform_fee_revenue": str(platform_revenue),
        "logistics_revenue": str(logistics_revenue),
        "note": "GMV and revenue are Rs.0 until real orders exist." if not orders else None,
    }
