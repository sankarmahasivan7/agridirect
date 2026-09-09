from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.core.deps import require_role
from app.models.models import (
    User, RoleEnum, ProductListing, Order, OrderItem, OrderStatusEnum,
    Transaction, FarmerProfile, FPOProfile, BuyerProfile, Notification, Review
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

    from app.services.perishability_service import check_and_notify_perishability
    urgent_lots = []
    for l in active_listings:
        st = l.calculate_perishability_status()
        if st in ["SELL SOON", "URGENT", "CRITICAL"]:
            check_and_notify_perishability(db, l)
            urgent_lots.append({
                "listing_id": l.id,
                "product_name": l.product.name,
                "quantity": float(l.quantity_available),
                "unit": l.unit,
                "status": st,
                "sell_by_date": l.get_expected_sell_by_date().isoformat() if l.get_expected_sell_by_date() else None,
            })

    reviews = (
        db.query(Review)
        .options(joinedload(Review.buyer), joinedload(Review.product))
        .filter(Review.farmer_id == farmer_id)
        .order_by(Review.created_at.desc())
        .all()
    )
    total_reviews = len(reviews)
    avg_rating = round(sum(r.rating for r in reviews) / total_reviews, 1) if total_reviews > 0 else 0.0
    waste_reports = [r for r in reviews if r.is_waste_reported]
    recent_reviews = [
        {
            "id": r.id,
            "order_id": r.order_id,
            "buyer_name": r.buyer.full_name if r.buyer else "Verified Buyer",
            "product_name": r.product_name or (r.product.name if r.product else "Produce Item"),
            "rating": r.rating,
            "comment": r.comment,
            "image_url": r.image_url,
            "is_waste_reported": r.is_waste_reported,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in reviews[:10]
    ]

    return {
        "active_listings_count": len(active_listings),
        "total_listings_count": len(listings),
        "pending_orders_count": len(pending_orders),
        "earnings": earnings_summary,
        "perishability_alerts": urgent_lots,
        "urgent_listings_count": len(urgent_lots),
        "rating_summary": {
            "average_rating": avg_rating,
            "total_reviews": total_reviews,
            "waste_reports_count": len(waste_reports),
            "recent_reviews": recent_reviews,
        },
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
    buyers = db.query(User).filter(User.role == RoleEnum.buyer).count()
    transporters = db.query(User).filter(User.role == RoleEnum.transporter).count()

    active_listings = db.query(ProductListing).filter(ProductListing.is_active == True).count()  # noqa: E712

    orders = db.query(Order).all()
    gmv = sum((o.total_amount for o in orders), Decimal("0"))

    transactions = db.query(Transaction).all()
    platform_revenue = sum((t.platform_fee_amount for t in transactions), Decimal("0"))
    logistics_revenue = sum((t.logistics_revenue_amount for t in transactions), Decimal("0"))

    return {
        "total_users": total_users,
        "farmers": farmers,
        "buyers": buyers,
        "transporters": transporters,
        "active_listings": active_listings,
        "total_orders": len(orders),
        "gmv": str(gmv),
        "platform_fee_revenue": str(platform_revenue),
        "logistics_revenue": str(logistics_revenue),
        "note": "GMV and revenue are Rs.0 until real orders exist." if not orders else None,
    }
