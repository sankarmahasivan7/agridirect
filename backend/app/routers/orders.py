from decimal import Decimal, ROUND_HALF_UP

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.db.session import get_db
from app.core.deps import require_role
from app.models.models import (
    User, RoleEnum, ProductListing, Order, OrderItem, OrderStatusEnum, Transaction, Notification
)
from app.schemas.schemas import OrderCreate, OrderOut, OrderItemOut
from app.services.transport_service import create_transport_requests_for_order

router = APIRouter(prefix="/api/orders", tags=["orders"])


def _q(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _serialize_order(order: Order) -> OrderOut:
    items = [
        OrderItemOut(
            listing_id=item.listing_id,
            product_name=item.listing.product.name,
            quantity=item.quantity,
            price_at_purchase=item.price_at_purchase,
            line_subtotal=item.line_subtotal,
        )
        for item in order.items
    ]
    return OrderOut(
        id=order.id, subtotal=order.subtotal, logistics_cost=order.logistics_cost,
        platform_fee=order.platform_fee, total_amount=order.total_amount,
        delivery_location=order.delivery_location, status=order.status,
        created_at=order.created_at, items=items,
    )


@router.post("", response_model=OrderOut, status_code=201)
def create_order(
    payload: OrderCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(RoleEnum.buyer)),
):
    """
    Validates every requested quantity against the ACTUAL available quantity,
    locks the rows, and decrements inventory atomically to prevent overselling
    (spec sections 14, 15, 42). If any item fails validation, the whole order
    is rejected -- no partial fake fulfillment.
    """
    if not payload.items:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cart is empty")

    subtotal = Decimal("0")
    order_items: list[OrderItem] = []
    total_kg = Decimal("0")

    for cart_item in payload.items:
        # SELECT ... FOR UPDATE style locking to prevent two buyers oversell race conditions.
        listing = (
            db.query(ProductListing)
            .filter(ProductListing.id == cart_item.listing_id, ProductListing.is_active == True)  # noqa: E712
            .with_for_update()
            .first()
        )
        if not listing:
            raise HTTPException(status.HTTP_404_NOT_FOUND, f"Listing {cart_item.listing_id} not found")

        if cart_item.quantity < listing.min_order_quantity:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Minimum order quantity for {listing.product.name} is {listing.min_order_quantity} {listing.unit}",
            )

        if cart_item.quantity > listing.quantity_available:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Only {listing.quantity_available} {listing.unit} is currently available for {listing.product.name}",
            )

        line_subtotal = _q(cart_item.quantity * listing.price_per_unit)
        subtotal += line_subtotal
        total_kg += cart_item.quantity

        # Decrement actual inventory now, inside the same transaction.
        listing.quantity_available = listing.quantity_available - cart_item.quantity
        if listing.quantity_available <= 0:
            listing.is_active = False

        order_items.append(OrderItem(
            listing_id=listing.id,
            quantity=cart_item.quantity,
            price_at_purchase=listing.price_per_unit,
            line_subtotal=line_subtotal,
        ))

    logistics_cost = _q(total_kg * Decimal(str(settings.LOGISTICS_BASE_RATE_PER_KG)))
    platform_fee = _q(subtotal * Decimal(str(settings.PLATFORM_FEE_PERCENT)) / Decimal("100"))
    total_amount = _q(subtotal + logistics_cost + platform_fee)

    order = Order(
        buyer_id=user.buyer_profile.id,
        subtotal=subtotal,
        logistics_cost=logistics_cost,
        platform_fee=platform_fee,
        total_amount=total_amount,
        delivery_location=payload.delivery_location,
        delivery_latitude=payload.delivery_latitude,
        delivery_longitude=payload.delivery_longitude,
        status=OrderStatusEnum.PENDING,
        items=order_items,
    )
    db.add(order)
    db.flush()

    db.add(Transaction(order_id=order.id, platform_fee_amount=platform_fee, logistics_revenue_amount=logistics_cost))

    # Notify sellers of the new order (best-effort; farmer/FPO id resolved per item).
    notified = set()
    for item in order_items:
        listing = item.listing
        target_user_id = None
        if listing.farmer_id:
            target_user_id = listing.farmer.user_id
        elif listing.fpo_id:
            target_user_id = listing.fpo.user_id
        if target_user_id and target_user_id not in notified:
            db.add(Notification(
                user_id=target_user_id, title="New order received",
                message=f"You have a new order for {listing.product.name}.",
            ))
            notified.add(target_user_id)

    db.flush()
    # Automatically request and assign transport -- the buyer never has to
    # ask for this manually (spec: auto-assign based on farmer/buyer location).
    create_transport_requests_for_order(db, order)

    db.commit()
    db.refresh(order)
    return _serialize_order(order)


@router.get("/mine", response_model=list[OrderOut])
def my_orders(db: Session = Depends(get_db), user: User = Depends(require_role(RoleEnum.buyer))):
    orders = (
        db.query(Order)
        .options(joinedload(Order.items).joinedload(OrderItem.listing))
        .filter(Order.buyer_id == user.buyer_profile.id)
        .order_by(Order.created_at.desc())
        .all()
    )
    return [_serialize_order(o) for o in orders]


@router.get("/seller", response_model=list[OrderOut])
def seller_orders(db: Session = Depends(get_db), user: User = Depends(require_role(RoleEnum.farmer, RoleEnum.fpo))):
    """
    Orders that contain at least one item sold by the logged-in farmer/FPO.
    This is what powers the farmer's "My Orders" screen -- real orders,
    not just a list of the farmer's own listings.
    """
    owner_filter = (
        ProductListing.farmer_id == user.farmer_profile.id if user.role == RoleEnum.farmer
        else ProductListing.fpo_id == user.fpo_profile.id
    )
    order_ids = (
        db.query(OrderItem.order_id)
        .join(ProductListing)
        .filter(owner_filter)
        .distinct()
        .all()
    )
    order_ids = [oid for (oid,) in order_ids]
    if not order_ids:
        return []

    orders = (
        db.query(Order)
        .options(joinedload(Order.items).joinedload(OrderItem.listing))
        .filter(Order.id.in_(order_ids))
        .order_by(Order.created_at.desc())
        .all()
    )
    return [_serialize_order(o) for o in orders]


@router.put("/{order_id}/status", response_model=OrderOut)
def update_order_status(
    order_id: int, new_status: OrderStatusEnum,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(RoleEnum.farmer, RoleEnum.fpo, RoleEnum.admin)),
):
    """Farmer/FPO accepts/rejects/progresses an order (spec section 3 - Farmer)."""
    order = db.query(Order).options(joinedload(Order.items).joinedload(OrderItem.listing)).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")

    if user.role != RoleEnum.admin:
        owns_any_item = any(
            (item.listing.farmer_id == getattr(user.farmer_profile, "id", None)) or
            (item.listing.fpo_id == getattr(user.fpo_profile, "id", None))
            for item in order.items
        )
        if not owns_any_item:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have items in this order")

    if new_status == OrderStatusEnum.CANCELLED and order.status != OrderStatusEnum.CANCELLED:
        # Restore actual inventory on cancellation.
        for item in order.items:
            item.listing.quantity_available += item.quantity
            item.listing.is_active = True

    order.status = new_status
    db.commit()
    db.refresh(order)
    return _serialize_order(order)
