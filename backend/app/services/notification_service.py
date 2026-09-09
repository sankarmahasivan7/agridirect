"""
Platform-wide push notification service for AgriDirect.
Dispatches real-time event updates across Buyers, Farmers, FPOs, and Transporters.
"""
from typing import Optional, List
from sqlalchemy.orm import Session

from app.models.models import (
    Notification, Order, TransportRequest, TransporterProfile, User, RoleEnum
)


def create_notification(
    db: Session,
    user_id: int,
    title: str,
    message: str,
    notification_type: str = "INFO",
    link: Optional[str] = None,
) -> Notification:
    """Creates and persists an in-app push notification for a user."""
    notif = Notification(
        user_id=user_id,
        title=title,
        message=message,
        notification_type=notification_type,
        link=link,
        is_read=False,
    )
    db.add(notif)
    return notif


def notify_order_placed(db: Session, order: Order):
    """
    Called when a buyer places an order:
    1. Notifies Buyer of successful placement and warehouse fulfillment.
    2. Notifies each Seller (Farmer/FPO) of purchased items.
    3. Notifies Transporters of newly available transport jobs.
    """
    # 1. Buyer Notification
    if order.buyer and order.buyer.user_id:
        create_notification(
            db=db,
            user_id=order.buyer.user_id,
            title=f"Order #{order.id} Placed Successfully!",
            message=(
                f"Your order of {len(order.items)} item(s) (₹{order.total_amount}) has been confirmed. "
                f"Consignment is dispatched via District Central Warehouse to {order.delivery_location}."
            ),
            notification_type="ORDER",
            link="/buyer/orders",
        )

    # 2. Seller Notifications (deduplicated per seller)
    notified_sellers = set()
    for item in order.items:
        listing = item.listing
        seller_uid = None
        if listing.farmer_id and listing.farmer:
            seller_uid = listing.farmer.user_id
        elif listing.fpo_id and listing.fpo:
            seller_uid = listing.fpo.user_id

        if seller_uid and seller_uid not in notified_sellers:
            create_notification(
                db=db,
                user_id=seller_uid,
                title=f"New Order Received: #{order.id}",
                message=(
                    f"A buyer placed an order for {item.quantity} {listing.unit} of {listing.product.name}. "
                    f"Prepare consignment for District Warehouse fulfillment."
                ),
                notification_type="ORDER",
                link="/farmer/orders",
            )
            notified_sellers.add(seller_uid)

    # 3. Transporter Notifications
    # Check transport requests created for this order
    transport_requests = db.query(TransportRequest).filter(TransportRequest.order_id == order.id).all()
    assigned_user_ids = set()

    for req in transport_requests:
        # If already assigned to a specific vehicle/transporter
        if req.assigned_vehicle and req.assigned_vehicle.transporter:
            trans_uid = req.assigned_vehicle.transporter.user_id
            assigned_user_ids.add(trans_uid)
            create_notification(
                db=db,
                user_id=trans_uid,
                title=f"New Transport Assignment: Consignment #{req.id}",
                message=(
                    f"Consignment #{req.id} ready at {req.pickup_location} ({req.weight_kg} kg). "
                    f"Deliver to {req.destination_location}. Estimated payout: ₹{req.logistics_cost}."
                ),
                notification_type="TRANSPORT",
                link="/transporter/dashboard",
            )

    # Broadcast to all available transporters in the platform if any request is still pending
    pending_reqs = [r for r in transport_requests if r.assigned_vehicle_id is None]
    if pending_reqs:
        available_transporters = (
            db.query(TransporterProfile)
            .join(User, TransporterProfile.user_id == User.id)
            .filter(TransporterProfile.is_available == True, User.is_active == True)  # noqa: E712
            .all()
        )
        for tp in available_transporters:
            if tp.user_id not in assigned_user_ids:
                req0 = pending_reqs[0]
                create_notification(
                    db=db,
                    user_id=tp.user_id,
                    title=f"Transport Job Available: Consignment #{req0.id}",
                    message=(
                        f"New delivery job from {req0.pickup_location} to {req0.destination_location} "
                        f"({req0.weight_kg} kg). Payout: ₹{req0.logistics_cost}. Accept now in your dashboard."
                    ),
                    notification_type="TRANSPORT",
                    link="/transporter/dashboard",
                )


def notify_transport_accepted(db: Session, req: TransportRequest):
    """Called when a transporter accepts a transport request."""
    trans_name = (
        req.assigned_vehicle.transporter.full_name
        if req.assigned_vehicle and req.assigned_vehicle.transporter
        else "Carrier"
    )

    # 1. Notify Buyer
    if req.order and req.order.buyer and req.order.buyer.user_id:
        create_notification(
            db=db,
            user_id=req.order.buyer.user_id,
            title=f"Transporter Assigned: Consignment #{req.id}",
            message=(
                f"Transporter {trans_name} has accepted your consignment from {req.pickup_location}. "
                f"Preparing for pickup and transit."
            ),
            notification_type="TRANSPORT",
            link="/transport/my-requests",
        )

    # 2. Notify Seller
    if req.order and req.order.items:
        for item in req.order.items:
            seller_uid = None
            if item.listing.farmer_id and item.listing.farmer:
                seller_uid = item.listing.farmer.user_id
            elif item.listing.fpo_id and item.listing.fpo:
                seller_uid = item.listing.fpo.user_id
            if seller_uid:
                create_notification(
                    db=db,
                    user_id=seller_uid,
                    title=f"Carrier Assigned: Consignment #{req.id}",
                    message=f"Transporter {trans_name} is scheduled to pick up order produce from {req.pickup_location}.",
                    notification_type="TRANSPORT",
                    link="/farmer/orders",
                )


def notify_transport_status_update(db: Session, req: TransportRequest, new_status: str):
    """Dispatches notifications across status lifecycle: PICKUP -> IN_TRANSIT -> DELIVERED."""
    trans_name = (
        req.assigned_vehicle.transporter.full_name
        if req.assigned_vehicle and req.assigned_vehicle.transporter
        else "Carrier"
    )
    buyer_uid = req.order.buyer.user_id if req.order and req.order.buyer else req.requested_by_user_id

    if new_status == "PICKUP":
        if buyer_uid:
            create_notification(
                db=db,
                user_id=buyer_uid,
                title=f"Consignment #{req.id} Picked Up",
                message=f"Your produce has been picked up from {req.pickup_location} by {trans_name}.",
                notification_type="DELIVERY",
                link=f"/transport/track/{req.id}",
            )

    elif new_status == "IN_TRANSIT":
        if buyer_uid:
            eta_str = f"~{req.estimated_transit_minutes} mins" if req.estimated_transit_minutes else "in transit"
            create_notification(
                db=db,
                user_id=buyer_uid,
                title=f"Shipment #{req.id} In Transit!",
                message=f"Consignment is on the road to {req.destination_location} (ETA: {eta_str}). Live GPS tracking active.",
                notification_type="DELIVERY",
                link=f"/transport/track/{req.id}",
            )

    elif new_status == "DELIVERED":
        # 1. Buyer Notification
        if buyer_uid:
            create_notification(
                db=db,
                user_id=buyer_uid,
                title=f"Order #{req.order_id or req.id} Delivered!",
                message=f"Your fresh produce has arrived at {req.destination_location}. Thank you for supporting direct farmers!",
                notification_type="DELIVERY",
                link="/buyer/orders",
            )

        # 2. Seller Notification
        if req.order and req.order.items:
            for item in req.order.items:
                seller_uid = None
                if item.listing.farmer_id and item.listing.farmer:
                    seller_uid = item.listing.farmer.user_id
                elif item.listing.fpo_id and item.listing.fpo:
                    seller_uid = item.listing.fpo.user_id
                if seller_uid:
                    create_notification(
                        db=db,
                        user_id=seller_uid,
                        title=f"Order #{req.order_id or req.id} Delivered",
                        message=f"Produce delivered to buyer. Net earnings credited to your balance.",
                        notification_type="ORDER",
                        link="/farmer/orders",
                    )

        # 3. Transporter Notification
        if req.assigned_vehicle and req.assigned_vehicle.transporter:
            create_notification(
                db=db,
                user_id=req.assigned_vehicle.transporter.user_id,
                title=f"Consignment #{req.id} Completed",
                message=f"Delivery confirmed at {req.destination_location}. Logistics fee payout of ₹{req.logistics_cost} credited.",
                notification_type="TRANSPORT",
                link="/transporter/dashboard",
            )

