from decimal import Decimal, ROUND_HALF_UP
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.db.session import get_db
from app.core.deps import require_role
from app.models.models import (
    User, RoleEnum, ProductListing, Order, OrderItem, OrderStatusEnum, Transaction, Notification,
    PaymentMethodEnum, PaymentStatusEnum, Payment, TransportRequest
)
from app.schemas.schemas import OrderCreate, OrderOut, OrderItemOut
from app.services.transport_service import create_transport_requests_for_order
from app.services.notification_service import notify_order_placed
from app.services.batch_service import create_fulfillment_items_for_order, create_delivery_batches, _resolve_order_district
from app.services.payment_service import create_razorpay_order

router = APIRouter(prefix="/api/orders", tags=["orders"])


def _q(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def dispatch_order_fulfillment(db: Session, order: Order):
    """
    Activates delivery jobs, splits by source warehouses, creates transport requests and batches.
    Only called when an order is confirmed (immediately for POD, or after payment verification for UPI).
    """
    # Split order internally into OrderFulfillmentItems linked to source warehouses
    create_fulfillment_items_for_order(db, order)

    # Automatically request and assign transport
    create_transport_requests_for_order(db, order)
    db.flush()

    # Automatically trigger multi-order consolidation for this delivery district
    order_district = _resolve_order_district(order)
    create_delivery_batches(db, delivery_district=order_district)
    db.flush()

    # Dispatch real-time push notifications across Buyer, Seller(s), and Transporters
    notify_order_placed(db, order)


def _serialize_order(order: Order, razorpay_order: dict = None, db: Session = None) -> OrderOut:
    items = [
        OrderItemOut(
            listing_id=item.listing_id,
            product_name=item.listing.product.name if item.listing and item.listing.product else "Produce Item",
            quantity=item.quantity,
            price_at_purchase=item.price_at_purchase,
            line_subtotal=item.line_subtotal,
        )
        for item in order.items
    ]

    rzp_order_id = razorpay_order.get("id") if razorpay_order else (
        order.payment.gateway_order_id if order.payment and order.payment.gateway_order_id else None
    )
    rzp_key_id = razorpay_order.get("key_id") if razorpay_order else (
        settings.RAZORPAY_KEY_ID if order.payment_method == PaymentMethodEnum.UPI else None
    )
    amount_paise = razorpay_order.get("amount") if razorpay_order else (
        int(order.total_amount * Decimal("100")) if order.payment_method == PaymentMethodEnum.UPI else None
    )

    is_upi = order.payment_method == PaymentMethodEnum.UPI
    upi_id = settings.DEFAULT_UPI_ID if is_upi else None
    upi_name = settings.DEFAULT_UPI_NAME if is_upi else None
    upi_uri = (
        f"upi://pay?pa={upi_id}&pn={quote(upi_name)}&mc=0000&mode=02&purpose=00&am={order.total_amount:.2f}&cu=INR&tn=AgriDirect_Order_{order.id}"
        if is_upi
        else None
    )

    transport_request_id = None
    if getattr(order, "transport_requests", None):
        transport_request_id = order.transport_requests[0].id
    elif db is not None:
        tr = db.query(TransportRequest.id).filter(TransportRequest.order_id == order.id).first()
        if tr:
            transport_request_id = tr[0]

    return OrderOut(
        id=order.id,
        subtotal=order.subtotal,
        logistics_cost=order.logistics_cost,
        platform_fee=order.platform_fee,
        total_amount=order.total_amount,
        delivery_location=order.delivery_location,
        status=order.status,
        payment_method=order.payment_method,
        payment_status=order.payment_status,
        paid_at=order.paid_at,
        farmer_settlement_amount=order.farmer_settlement_amount,
        transporter_settlement_amount=order.transporter_settlement_amount,
        platform_commission_amount=order.platform_commission_amount,
        razorpay_order_id=rzp_order_id,
        razorpay_key_id=rzp_key_id,
        amount_paise=amount_paise,
        currency="INR",
        upi_uri=upi_uri,
        upi_id=upi_id,
        upi_name=upi_name,
        transport_request_id=transport_request_id,
        created_at=order.created_at,
        items=items,
    )


@router.post("", response_model=OrderOut, status_code=201)
def create_order(
    payload: OrderCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(RoleEnum.buyer)),
):
    """
    Validates requested quantities against the ACTUAL available quantities,
    locks the rows, and decrements inventory atomically to prevent overselling.
    Supports PAY_ON_DELIVERY and UPI / ONLINE PAYMENT methods.
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

    # Determine initial status by payment method
    is_pod = payload.payment_method == PaymentMethodEnum.PAY_ON_DELIVERY
    is_upi = payload.payment_method == PaymentMethodEnum.UPI
    # POD: order is CONFIRMED, payment is PENDING, dispatch immediately
    # UPI: order is PENDING, payment is PENDING, dispatch withheld until verification
    # Legacy/unspecified: order is PENDING, dispatch immediately
    initial_order_status = OrderStatusEnum.CONFIRMED if is_pod else OrderStatusEnum.PENDING

    order = Order(
        buyer_id=user.buyer_profile.id,
        subtotal=subtotal,
        logistics_cost=logistics_cost,
        platform_fee=platform_fee,
        total_amount=total_amount,
        delivery_location=payload.delivery_location,
        delivery_latitude=payload.delivery_latitude,
        delivery_longitude=payload.delivery_longitude,
        status=initial_order_status,
        payment_method=payload.payment_method,
        payment_status=PaymentStatusEnum.PENDING,
        farmer_settlement_amount=subtotal,
        transporter_settlement_amount=logistics_cost,
        platform_commission_amount=platform_fee,
        items=order_items,
    )
    db.add(order)
    db.flush()

    db.add(Transaction(order_id=order.id, platform_fee_amount=platform_fee, logistics_revenue_amount=logistics_cost))

    rzp_order = None
    if is_pod:
        # Pay on Delivery: payment created as PENDING, fulfillment triggered immediately
        payment = Payment(
            order_id=order.id,
            amount=total_amount,
            currency="INR",
            payment_method=PaymentMethodEnum.PAY_ON_DELIVERY,
            payment_status=PaymentStatusEnum.PENDING,
            farmer_amount=subtotal,
            transporter_amount=logistics_cost,
            commission_amount=platform_fee,
        )
        db.add(payment)
        dispatch_order_fulfillment(db, order)
    elif is_upi:
        # UPI / Online Payment: Create Razorpay Order from backend.
        # Inventory is reserved, but delivery jobs are withheld until verification!
        rzp_order = create_razorpay_order(order)
        payment = Payment(
            order_id=order.id,
            amount=total_amount,
            currency="INR",
            payment_method=PaymentMethodEnum.UPI,
            payment_status=PaymentStatusEnum.PENDING,
            gateway="RAZORPAY",
            gateway_order_id=rzp_order["id"],
            farmer_amount=subtotal,
            transporter_amount=logistics_cost,
            commission_amount=platform_fee,
        )
        db.add(payment)
    else:
        # Legacy / default without payment method
        dispatch_order_fulfillment(db, order)

    db.commit()
    db.refresh(order)
    return _serialize_order(order, razorpay_order=rzp_order, db=db)


@router.get("/mine", response_model=list[OrderOut])
def my_orders(db: Session = Depends(get_db), user: User = Depends(require_role(RoleEnum.buyer))):
    orders = (
        db.query(Order)
        .options(
            joinedload(Order.items).joinedload(OrderItem.listing),
            joinedload(Order.transport_requests),
        )
        .filter(Order.buyer_id == user.buyer_profile.id)
        .order_by(Order.created_at.desc())
        .all()
    )
    return [_serialize_order(o, db=db) for o in orders]


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
        .options(
            joinedload(Order.items).joinedload(OrderItem.listing),
            joinedload(Order.transport_requests),
        )
        .filter(Order.id.in_(order_ids))
        .order_by(Order.created_at.desc())
        .all()
    )
    return [_serialize_order(o, db=db) for o in orders]


@router.put("/{order_id}/status", response_model=OrderOut)
def update_order_status(
    order_id: int, new_status: OrderStatusEnum,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(RoleEnum.farmer, RoleEnum.fpo, RoleEnum.admin)),
):
    """Farmer/FPO accepts/rejects/progresses an order (spec section 3 - Farmer)."""
    order = (
        db.query(Order)
        .options(
            joinedload(Order.items).joinedload(OrderItem.listing),
            joinedload(Order.transport_requests),
        )
        .filter(Order.id == order_id)
        .first()
    )
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
    return _serialize_order(order, db=db)
