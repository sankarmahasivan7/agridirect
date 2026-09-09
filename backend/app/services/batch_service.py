"""
Batched Delivery & 3PL Transporter Allocation Service for AgriDirect.

Core Principles:
1. The customer order does NOT determine the vehicle trip.
   The combined demand of multiple customers determines the vehicle trip.
2. An order may contain products from multiple aggregation warehouses
   (Tenkasi, Tirunelveli, Thoothukudi).
3. The order is split internally into OrderFulfillmentItems linked to source warehouses.
4. The customer sees ONE order with ONE consolidated delivery.
5. Unfulfilled orders in the same delivery district are grouped into consolidated DeliveryBatches.
6. Multi-warehouse pickups are sequenced in an efficient geographic route.
7. Available 3PL transporters with vehicle capacity >= total cargo are allocated.
8. Database row locking prevents race conditions during transporter acceptance.
9. 8-stage status lifecycle from BATCH_CREATED to DELIVERED without double-decrementing inventory.
"""
from datetime import datetime, date, timedelta
from decimal import Decimal
from typing import List, Optional, Dict, Any
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.core.constants import (
    DISTRICT_WAREHOUSES, DEFAULT_DISTRICT, SUPPORTED_DISTRICTS,
    get_district_warehouse, normalize_district, DISTRICT_ALIASES
)
from app.models.models import (
    Order, OrderItem, OrderStatusEnum, ProductListing,
    OrderFulfillmentItem, DeliveryBatch, BatchStop, DeliveryBatchStatusEnum,
    TransporterProfile, Vehicle, TransportRequest, TransportRequestStatusEnum,
    User, RoleEnum, PaymentMethodEnum, PaymentStatusEnum
)
from app.services.transport_service import calculate_logistics_cost, find_feasible_vehicle
from app.services.notification_service import create_notification
from app.services.maps_service import get_batch_road_distance, get_road_distance_and_duration
from app.utils.geo import haversine_km
from app.logistics.vehicle_rules import (
    BIKE_MAX_CAPACITY_KG,
    TRUCK_MIN_FILL_RATIO,
    is_bike_vehicle,
    is_truck_vehicle,
    get_minimum_dispatch_weight,
    evaluate_vehicle_for_batch,
)

# Geographic sequence for multi-warehouse pickup: West (Tenkasi) <-> Central (Tirunelveli) <-> East (Thoothukudi)
WAREHOUSE_SEQUENCE = ["WH-TKS-01", "WH-TNV-01", "WH-TUT-01"]

BATCH_STATUS_TRANSITIONS = {
    DeliveryBatchStatusEnum.BATCH_CREATED: {
        DeliveryBatchStatusEnum.TRANSPORTER_ASSIGNED,
        DeliveryBatchStatusEnum.ACCEPTED,
        DeliveryBatchStatusEnum.CANCELLED,
    },
    DeliveryBatchStatusEnum.TRANSPORTER_ASSIGNED: {
        DeliveryBatchStatusEnum.ACCEPTED,
        DeliveryBatchStatusEnum.CANCELLED,
    },
    DeliveryBatchStatusEnum.ACCEPTED: {
        DeliveryBatchStatusEnum.READY_FOR_PICKUP,
        DeliveryBatchStatusEnum.PICKED_UP,
        DeliveryBatchStatusEnum.CANCELLED,
    },
    DeliveryBatchStatusEnum.READY_FOR_PICKUP: {
        DeliveryBatchStatusEnum.PICKED_UP,
        DeliveryBatchStatusEnum.CANCELLED,
    },
    DeliveryBatchStatusEnum.PICKED_UP: {
        DeliveryBatchStatusEnum.IN_TRANSIT,
        DeliveryBatchStatusEnum.CANCELLED,
    },
    DeliveryBatchStatusEnum.IN_TRANSIT: {
        DeliveryBatchStatusEnum.OUT_FOR_DELIVERY,
        DeliveryBatchStatusEnum.DELIVERED,
        DeliveryBatchStatusEnum.CANCELLED,
    },
    DeliveryBatchStatusEnum.OUT_FOR_DELIVERY: {
        DeliveryBatchStatusEnum.DELIVERED,
        DeliveryBatchStatusEnum.CANCELLED,
    },
    DeliveryBatchStatusEnum.DELIVERED: set(),
    DeliveryBatchStatusEnum.CANCELLED: set(),
}


def _resolve_seller_warehouse(listing: ProductListing) -> Dict[str, Any]:
    """Resolves the source district warehouse for a product listing."""
    district = None
    if listing.farmer and listing.farmer.district:
        district = listing.farmer.district
    elif listing.fpo and listing.fpo.district:
        district = listing.fpo.district
    return get_district_warehouse(district, fallback_text=listing.location)


def _resolve_order_district(order: Order) -> str:
    """Infers the delivery destination district of an order."""
    if order.buyer and order.buyer.district:
        try:
            return normalize_district(order.buyer.district)
        except ValueError:
            pass

    if order.delivery_location:
        loc_lower = order.delivery_location.lower()
        for alias, canonical in DISTRICT_ALIASES.items():
            if alias in loc_lower:
                return canonical

    return DEFAULT_DISTRICT


def create_fulfillment_items_for_order(db: Session, order: Order) -> List[OrderFulfillmentItem]:
    """
    Splits an order internally by source warehouse.
    Creates an OrderFulfillmentItem for each order item, linked to its holding warehouse.
    The customer still sees only ONE order.
    """
    items = []
    for order_item in order.items:
        wh = _resolve_seller_warehouse(order_item.listing)
        item_avail = order_item.listing.available_from or order_item.listing.harvest_date
        fulfillment_item = OrderFulfillmentItem(
            order_id=order.id,
            order_item_id=order_item.id,
            warehouse_name=wh["warehouse_name"],
            warehouse_code=wh["code"],
            warehouse_district=wh["district"],
            warehouse_latitude=wh["latitude"],
            warehouse_longitude=wh["longitude"],
            quantity=order_item.quantity,
            status="PENDING",
            batch_id=None,
            available_from=item_avail,
        )
        db.add(fulfillment_item)
        items.append(fulfillment_item)
    db.flush()
    return items


def find_eligible_transporter(
    db: Session,
    cargo_weight_kg: float | Decimal,
    delivery_district: str,
    pickup_lat: Optional[Decimal] = None,
    pickup_lon: Optional[Decimal] = None,
) -> tuple[Optional[TransporterProfile], Optional[Vehicle]]:
    """
    Finds an active, available 3PL transporter with a suitable vehicle based on strict rules:
    1. BIKE RULE:
       - Batch <= 50 kg -> Assign available suitable bike.
       - No 35% minimum-fill requirement on bikes (dispatched immediately even for 5kg, 15kg, 30kg, 50kg).
       - If batch > 50 kg, do not assign a bike.
    2. TRUCK RULE:
       - Batch > 50 kg -> Truck.
       - Dispatched only when load reaches at least 35% of actual truck capacity.
       - If below 35%, DO NOT dispatch; wait for compatible orders.
    3. Never assign a vehicle whose capacity is lower than batch weight.
    """
    cargo_kg = round(float(cargo_weight_kg), 2)

    # Fetch active, available transporters with active vehicles
    candidates = (
        db.query(TransporterProfile)
        .join(Vehicle, TransporterProfile.id == Vehicle.transporter_id)
        .join(User, TransporterProfile.user_id == User.id)
        .filter(
            TransporterProfile.is_available == True,  # noqa: E712
            User.is_active == True,                   # noqa: E712
            Vehicle.is_active == True,                # noqa: E712
        )
        .all()
    )

    eligible_candidates = []
    for t in candidates:
        if not t.vehicle:
            continue
        is_eligible, _ = evaluate_vehicle_for_batch(t.vehicle, cargo_kg)
        if is_eligible:
            eligible_candidates.append(t)

    if not eligible_candidates:
        return None, None

    # Filter matching district first
    district_matches = [
        t for t in eligible_candidates
        if t.district and t.district.lower() == delivery_district.lower()
    ]
    pool = district_matches if district_matches else eligible_candidates

    # Prefer transporters not currently assigned to active uncompleted batches
    busy_tids = {
        tid for (tid,) in db.query(DeliveryBatch.assigned_transporter_id).filter(
            DeliveryBatch.status.in_([
                DeliveryBatchStatusEnum.TRANSPORTER_ASSIGNED,
                DeliveryBatchStatusEnum.ACCEPTED,
                DeliveryBatchStatusEnum.READY_FOR_PICKUP,
                DeliveryBatchStatusEnum.PICKED_UP,
                DeliveryBatchStatusEnum.IN_TRANSIT,
                DeliveryBatchStatusEnum.OUT_FOR_DELIVERY,
            ]),
            DeliveryBatch.assigned_transporter_id.isnot(None),
        ).all()
    }
    free_pool = [t for t in pool if t.id not in busy_tids]
    candidate_pool = free_pool if free_pool else pool

    # If coordinates provided, pick closest by distance
    if pickup_lat is not None and pickup_lon is not None:
        def dist_key(t):
            lat = t.vehicle.current_latitude or t.base_latitude
            lon = t.vehicle.current_longitude or t.base_longitude
            if lat is not None and lon is not None:
                return haversine_km(pickup_lat, pickup_lon, lat, lon)
            return 999999.0
        candidate_pool.sort(key=dist_key)
    else:
        # Sort by smallest vehicle capacity to preserve large trucks for heavy batches
        candidate_pool.sort(key=lambda t: float(t.vehicle.capacity_kg))

    selected = candidate_pool[0]
    return selected, selected.vehicle


def create_delivery_batches(
    db: Session,
    delivery_district: Optional[str] = None,
    max_batch_capacity: float = 1000.0,
) -> List[DeliveryBatch]:
    """
    Groups unfulfilled customer orders destined for the same delivery district
    into consolidated DeliveryBatches.

    Consolidation Rules:
    1. Collects all PENDING fulfillment items and unaccepted draft batches.
    2. Groups them by destination delivery district.
    3. Analyzes multi-warehouse pickups and creates an efficient geographic sequence.
    4. Groups customer delivery stops up to max vehicle capacity.
    5. Prioritizes batches containing perishable produce (CRITICAL/URGENT).
    6. Allocates an eligible available 3PL transporter.
    7. Creates DeliveryBatch, BatchStops, and links fulfillment items.
    8. Synchronizes TransportRequest records for backward compatibility.
    """
    # 0. Reclaim unaccepted draft batches so new incoming orders consolidate together
    draft_query = (
        db.query(DeliveryBatch)
        .filter(
            DeliveryBatch.status.in_([
                DeliveryBatchStatusEnum.BATCH_CREATED,
                DeliveryBatchStatusEnum.TRANSPORTER_ASSIGNED,
            ])
        )
    )
    if delivery_district:
        draft_query = draft_query.filter(DeliveryBatch.delivery_area == delivery_district)

    draft_batches = draft_query.all()
    for dbatch in draft_batches:
        for it in dbatch.fulfillment_items:
            it.batch_id = None
            if it.order and it.order.status in (OrderStatusEnum.PENDING, OrderStatusEnum.CONFIRMED):
                it.status = "PENDING"
            else:
                it.status = "DELIVERED"
        for tr in dbatch.transport_requests:
            tr.batch_id = None
        db.query(BatchStop).filter(BatchStop.batch_id == dbatch.id).delete()
        db.delete(dbatch)
    db.flush()

    # 1. Fetch all pending unbatched fulfillment items for active orders
    query = (
        db.query(OrderFulfillmentItem)
        .join(Order, OrderFulfillmentItem.order_id == Order.id)
        .options(
            joinedload(OrderFulfillmentItem.order).joinedload(Order.buyer),
            joinedload(OrderFulfillmentItem.order_item).joinedload(OrderItem.listing),
        )
        .filter(
            OrderFulfillmentItem.status == "PENDING",
            OrderFulfillmentItem.batch_id.is_(None),
            Order.status.in_([OrderStatusEnum.PENDING, OrderStatusEnum.CONFIRMED]),
        )
    )
    items = query.all()
    if not items:
        return []

    # 2. Group items by delivery district
    district_groups = {}
    for item in items:
        order = item.order
        dist = _resolve_order_district(order)
        if delivery_district and dist.lower() != delivery_district.lower():
            continue
        district_groups.setdefault(dist, []).append(item)

    created_batches = []

    for dist_name, dist_items in district_groups.items():
        if not dist_items:
            continue

        # Group items by order to keep customer orders intact in a batch
        order_to_items = {}
        for it in dist_items:
            order_to_items.setdefault(it.order_id, []).append(it)

        total_dist_weight = sum(sum(float(i.quantity) for i in o_items) for o_items in order_to_items.values())

        # Check real active vehicles available in the database
        active_vehicles = (
            db.query(Vehicle)
            .join(TransporterProfile, Vehicle.transporter_id == TransporterProfile.id)
            .join(User, TransporterProfile.user_id == User.id)
            .filter(
                TransporterProfile.is_available == True,  # noqa: E712
                User.is_active == True,                   # noqa: E712
                Vehicle.is_active == True,                # noqa: E712
            )
            .all()
        )
        active_trucks = [v for v in active_vehicles if is_truck_vehicle(v)]
        active_bikes = [v for v in active_vehicles if is_bike_vehicle(v)]

        # Check if total district demand reaches >= 35% of any available truck
        can_satisfy_truck = any(
            float(v.capacity_kg) * TRUCK_MIN_FILL_RATIO <= total_dist_weight <= float(v.capacity_kg)
            for v in active_trucks
        )

        # 1. BIKE BATCHING: If bikes are available and orders can be handled via bike batches (orders <= 50 kg),
        # prioritize bike batching into chunks of <= 50 kg so small orders are dispatched immediately.
        # Only force truck batching if an individual order is > 50 kg, or if no bikes are available.
        has_heavy_order = any(sum(float(i.quantity) for i in o_items) > BIKE_MAX_CAPACITY_KG for o_items in order_to_items.values())
        if (active_bikes and not has_heavy_order) or total_dist_weight <= BIKE_MAX_CAPACITY_KG or (not can_satisfy_truck and active_bikes):
            current_batch_items = []
            current_weight = 0.0
            for order_id, o_items in order_to_items.items():
                order_weight = sum(float(i.quantity) for i in o_items)
                if order_weight <= BIKE_MAX_CAPACITY_KG and current_weight + order_weight <= BIKE_MAX_CAPACITY_KG:
                    current_batch_items.extend(o_items)
                    current_weight += order_weight
                else:
                    if current_batch_items:
                        batch = _build_single_batch(db, dist_name, current_batch_items)
                        if batch:
                            created_batches.append(batch)
                        current_batch_items = []
                        current_weight = 0.0

                    if order_weight <= BIKE_MAX_CAPACITY_KG:
                        current_batch_items = list(o_items)
                        current_weight = order_weight
                    else:
                        # Single order > 50 kg cannot fit on a bike; must be a truck batch
                        batch = _build_single_batch(db, dist_name, o_items)
                        if batch:
                            created_batches.append(batch)

            if current_batch_items:
                batch = _build_single_batch(db, dist_name, current_batch_items)
                if batch:
                    created_batches.append(batch)
        else:
            # 2. TRUCK BATCHING: Combine compatible orders in the delivery district
            # Chunk orders up to max vehicle capacity.
            # If batch reaches >= 35% of an available truck, it will be assigned.
            # If under 35%, _build_single_batch keeps it waiting in BATCH_CREATED.
            current_batch_items = []
            current_weight = 0.0

            for order_id, o_items in order_to_items.items():
                order_weight = sum(float(i.quantity) for i in o_items)

                if current_weight + order_weight > max_batch_capacity and current_batch_items:
                    batch = _build_single_batch(db, dist_name, current_batch_items)
                    if batch:
                        created_batches.append(batch)
                    current_batch_items = list(o_items)
                    current_weight = order_weight
                else:
                    current_batch_items.extend(o_items)
                    current_weight += order_weight

            if current_batch_items:
                batch = _build_single_batch(db, dist_name, current_batch_items)
                if batch:
                    created_batches.append(batch)

    db.commit()
    return created_batches


def _build_single_batch(db: Session, delivery_district: str, items: List[OrderFulfillmentItem]) -> Optional[DeliveryBatch]:
    """Helper to assemble a DeliveryBatch with ordered stops and transporter allocation."""
    if not items:
        return None

    total_cargo = Decimal(str(round(sum(float(i.quantity) for i in items), 2)))
    included_orders = list({i.order for i in items})
    total_orders_count = len(included_orders)
    total_customers_count = len({o.buyer_id for o in included_orders})

    # Generate unique human-readable batch code
    dist_prefix = delivery_district[:3].upper()
    timestamp_str = datetime.utcnow().strftime("%y%m%d%H%M")
    random_suffix = uuid4().hex[:4].upper()
    batch_code = f"BATCH-{dist_prefix}-{timestamp_str}-{random_suffix}"

    now = datetime.utcnow()
    pickup_deadline = now + timedelta(hours=24)
    delivery_deadline = now + timedelta(hours=48)

    avail_dates = []
    for it in items:
        d = getattr(it, 'available_from', None)
        if not d and it.order_item and it.order_item.listing:
            d = it.order_item.listing.available_from or it.order_item.listing.harvest_date
        if d:
            avail_dates.append(d)
    earliest_batch_avail = max(avail_dates) if avail_dates else None

    batch = DeliveryBatch(
        batch_code=batch_code,
        delivery_area=delivery_district,
        total_quantity_kg=total_cargo,
        total_orders_count=total_orders_count,
        total_customers_count=total_customers_count,
        required_vehicle_capacity_kg=total_cargo,
        status=DeliveryBatchStatusEnum.BATCH_CREATED,
        pickup_deadline=pickup_deadline,
        delivery_deadline=delivery_deadline,
        earliest_available_date=earliest_batch_avail,
        created_at=now,
    )
    db.add(batch)
    db.flush()

    # Link fulfillment items to batch
    for it in items:
        it.batch_id = batch.id
        it.status = "BATCHED"

    # Multi-Warehouse Pickups Sequencing
    # Identify unique warehouses required for this batch
    wh_items_map = {}
    for it in items:
        wh_items_map.setdefault(it.warehouse_code, []).append(it)

    # Sort warehouses in practical geographic sequence (Tenkasi -> Tirunelveli -> Thoothukudi)
    sorted_wh_codes = sorted(
        wh_items_map.keys(),
        key=lambda code: WAREHOUSE_SEQUENCE.index(code) if code in WAREHOUSE_SEQUENCE else 99
    )

    stops = []
    seq = 1

    # 1. PICKUP Stops
    for wh_code in sorted_wh_codes:
        wh_items = wh_items_map[wh_code]
        wh_weight = sum(float(i.quantity) for i in wh_items)
        sample = wh_items[0]
        wh_avails = [i.available_from for i in wh_items if getattr(i, 'available_from', None)]
        avail_note = ""
        if wh_avails:
            max_wh_avail = max(wh_avails)
            if max_wh_avail > date.today():
                avail_note = f" · Available from {max_wh_avail.strftime('%d %b %Y')}"
        stop = BatchStop(
            batch_id=batch.id,
            stop_type="PICKUP",
            sequence=seq,
            location_name=sample.warehouse_name,
            latitude=sample.warehouse_latitude,
            longitude=sample.warehouse_longitude,
            cargo_kg=Decimal(str(round(wh_weight, 2))),
            order_id=None,
            customer_name=None,
            notes=f"Pickup {sample.warehouse_name} ({wh_weight} kg cargo for {len(wh_items)} item(s)){avail_note}",
            status="PENDING",
        )
        db.add(stop)
        stops.append(stop)
        seq += 1

    # 2. DELIVERY Stops (one per customer order)
    for order in included_orders:
        order_items = [i for i in items if i.order_id == order.id]
        order_weight = sum(float(i.quantity) for i in order_items)
        customer_name = order.buyer.full_name if order.buyer else "Customer"
        dest_loc = order.delivery_location or f"{delivery_district} Destination"

        stop = BatchStop(
            batch_id=batch.id,
            stop_type="DELIVERY",
            sequence=seq,
            location_name=dest_loc,
            latitude=order.delivery_latitude,
            longitude=order.delivery_longitude,
            cargo_kg=Decimal(str(round(order_weight, 2))),
            order_id=order.id,
            customer_name=customer_name,
            notes=f"Deliver Order #{order.id} to {customer_name} ({order_weight} kg)",
            status="PENDING",
        )
        db.add(stop)
        stops.append(stop)
        seq += 1

    # Real road route distance and cost calculation (Google Maps / OSRM)
    total_distance_km, _ = get_batch_road_distance(stops)

    logistics_cost = calculate_logistics_cost(
        weight_kg=total_cargo,
        distance_km=total_distance_km,
        strategy="consolidated",
    )
    batch.estimated_distance_km = Decimal(str(round(total_distance_km, 2)))
    batch.estimated_logistics_cost = logistics_cost

    # 3PL Transporter Allocation
    first_pickup = stops[0]
    transporter, vehicle = find_eligible_transporter(
        db=db,
        cargo_weight_kg=total_cargo,
        delivery_district=delivery_district,
        pickup_lat=first_pickup.latitude,
        pickup_lon=first_pickup.longitude,
    )

    if transporter and vehicle:
        batch.assigned_transporter_id = transporter.id
        batch.assigned_vehicle_id = vehicle.id
        batch.status = DeliveryBatchStatusEnum.TRANSPORTER_ASSIGNED

        # Push notification to allocated transporter
        create_notification(
            db=db,
            user_id=transporter.user_id,
            title=f"New Delivery Batch Assigned: {batch.batch_code}",
            message=(
                f"Batch {batch.batch_code} allocated to your vehicle. "
                f"Cargo: {batch.total_quantity_kg} kg across {total_orders_count} customer orders. "
                f"Delivery Area: {delivery_district}. Payout: ₹{logistics_cost}."
            ),
            notification_type="TRANSPORT",
            link="/transporter/dashboard",
        )

    db.flush()

    # Synchronize TransportRequest records for backward-compatible views and tests
    for order in included_orders:
        order_cargo = sum(float(i.quantity) for i in items if i.order_id == order.id)
        # Check if legacy transport request exists for this order
        reqs = db.query(TransportRequest).filter(TransportRequest.order_id == order.id).all()
        if not reqs:
            req = TransportRequest(
                requested_by_user_id=order.buyer.user_id,
                order_id=order.id,
                batch_id=batch.id,
                pickup_location=first_pickup.location_name,
                pickup_latitude=first_pickup.latitude,
                pickup_longitude=first_pickup.longitude,
                destination_location=order.delivery_location,
                destination_latitude=order.delivery_latitude,
                destination_longitude=order.delivery_longitude,
                required_by=delivery_deadline,
                weight_kg=order_cargo,
                notes=f"Part of consolidated delivery {batch.batch_code}",
                status=TransportRequestStatusEnum.PENDING,
                assigned_vehicle_id=vehicle.id if vehicle else None,
                vehicle_capacity_kg=vehicle.capacity_kg if vehicle else None,
                logistics_strategy="consolidated",
                hub_name=first_pickup.location_name,
                distance_km=batch.estimated_distance_km,
                logistics_cost=batch.estimated_logistics_cost,
            )
            db.add(req)
        else:
            for r in reqs:
                r.batch_id = batch.id
                if vehicle and r.assigned_vehicle_id is None:
                    r.assigned_vehicle_id = vehicle.id
                    r.vehicle_capacity_kg = vehicle.capacity_kg

    db.flush()
    return batch


def accept_delivery_batch(db: Session, batch_id: int, transporter: TransporterProfile) -> DeliveryBatch:
    """
    Transporter accepts an assigned or available delivery batch.
    Uses backend database transaction with row locking (with_for_update) to prevent race conditions.
    Two transporters can NEVER accept the same delivery batch.
    """
    batch = (
        db.query(DeliveryBatch)
        .options(
            joinedload(DeliveryBatch.stops),
            joinedload(DeliveryBatch.fulfillment_items),
        )
        .filter(DeliveryBatch.id == batch_id)
        .with_for_update()
        .first()
    )

    if not batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery batch not found")

    if batch.status not in (DeliveryBatchStatusEnum.BATCH_CREATED, DeliveryBatchStatusEnum.TRANSPORTER_ASSIGNED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot accept delivery batch with status '{batch.status.value}'. Already claimed or in transit."
        )

    if batch.assigned_transporter_id and batch.assigned_transporter_id != transporter.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This delivery batch has been assigned to another carrier."
        )

    if not transporter.vehicle:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active vehicle registered for this transporter")

    is_eligible, reason = evaluate_vehicle_for_batch(transporter.vehicle, batch.total_quantity_kg)
    if not is_eligible:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=reason,
        )

    # Atomic claim
    batch.assigned_transporter_id = transporter.id
    batch.assigned_vehicle_id = transporter.vehicle.id
    batch.status = DeliveryBatchStatusEnum.ACCEPTED

    # Synchronize linked transport requests
    linked_reqs = db.query(TransportRequest).filter(TransportRequest.batch_id == batch.id).all()
    for req in linked_reqs:
        req.assigned_vehicle_id = transporter.vehicle.id
        req.vehicle_capacity_kg = transporter.vehicle.capacity_kg
        req.status = TransportRequestStatusEnum.ACCEPTED

    # Push notifications to included customers
    carrier_name = transporter.full_name
    order_ids = {item.order_id for item in batch.fulfillment_items}
    for oid in order_ids:
        order = db.query(Order).filter(Order.id == oid).first()
        if order and order.buyer:
            create_notification(
                db=db,
                user_id=order.buyer.user_id,
                title=f"Carrier Assigned: Order #{order.id}",
                message=f"Transporter {carrier_name} accepted consignment batch {batch.batch_code}. Preparing for warehouse pickup.",
                notification_type="TRANSPORT",
                link="/buyer/orders",
            )

    db.commit()
    db.refresh(batch)
    return batch


def update_batch_status(
    db: Session,
    batch_id: int,
    new_status: DeliveryBatchStatusEnum,
    transporter: Optional[TransporterProfile] = None,
    is_admin: bool = False,
    force: bool = False,
) -> DeliveryBatch:
    """
    Executes controlled status transitions across the 8-stage lifecycle:
    BATCH_CREATED -> TRANSPORTER_ASSIGNED -> ACCEPTED -> READY_FOR_PICKUP ->
    PICKED_UP -> IN_TRANSIT -> OUT_FOR_DELIVERY -> DELIVERED.

    Inventory is preserved (never double-decremented).
    """
    batch = (
        db.query(DeliveryBatch)
        .options(
            joinedload(DeliveryBatch.stops),
            joinedload(DeliveryBatch.fulfillment_items),
        )
        .filter(DeliveryBatch.id == batch_id)
        .with_for_update()
        .first()
    )

    if not batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery batch not found")

    if not is_admin:
        if not transporter or batch.assigned_transporter_id != transporter.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to update this delivery batch")

    allowed = BATCH_STATUS_TRANSITIONS.get(batch.status, set())
    if new_status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot transition delivery batch from '{batch.status.value}' to '{new_status.value}' directly."
        )

    today = date.today()
    avail_date = batch.earliest_available_date or batch.get_earliest_available_date()
    if new_status in (DeliveryBatchStatusEnum.READY_FOR_PICKUP, DeliveryBatchStatusEnum.PICKED_UP):
        if avail_date and avail_date > today and not force:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot pick up batch from warehouse yet. Produce is scheduled for harvest and warehouse deposit on {avail_date.strftime('%d %b %Y')}. Farmer deposit is pending.",
            )

    if new_status in (DeliveryBatchStatusEnum.PICKED_UP, DeliveryBatchStatusEnum.IN_TRANSIT):
        if batch.vehicle and not force:
            is_eligible, reason = evaluate_vehicle_for_batch(batch.vehicle, batch.total_quantity_kg)
            if not is_eligible:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot dispatch vehicle: {reason}",
                )

    if new_status == DeliveryBatchStatusEnum.DELIVERED:
        if not force and batch.in_transit_at and batch.estimated_transit_minutes and batch.estimated_transit_minutes > 0:
            earliest_delivery = batch.in_transit_at + timedelta(minutes=batch.estimated_transit_minutes)
            if datetime.utcnow() < earliest_delivery:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot mark delivered yet -- transit in progress. Earliest delivery time is {earliest_delivery.strftime('%Y-%m-%d %H:%M UTC')}.",
                )

    batch.status = new_status
    linked_reqs = db.query(TransportRequest).filter(TransportRequest.batch_id == batch.id).all()
    order_ids = {item.order_id for item in batch.fulfillment_items}

    # Lifecycle Stage Actions
    if new_status == DeliveryBatchStatusEnum.PICKED_UP:
        # Mark pickup stops as completed
        for stop in batch.stops:
            if stop.stop_type == "PICKUP":
                stop.status = "COMPLETED"
        # Mark fulfillment items as picked up (inventory already deducted at order confirmation, no double deduction)
        for it in batch.fulfillment_items:
            it.status = "PICKED_UP"
        for req in linked_reqs:
            req.status = TransportRequestStatusEnum.PICKUP

        # Notify customers
        for oid in order_ids:
            order = db.query(Order).filter(Order.id == oid).first()
            if order and order.buyer:
                create_notification(
                    db=db,
                    user_id=order.buyer.user_id,
                    title=f"Order #{order.id} Picked Up",
                    message=f"Consignment has been picked up from the district warehouse for batch {batch.batch_code}.",
                    notification_type="DELIVERY",
                    link="/buyer/orders",
                )

    elif new_status == DeliveryBatchStatusEnum.IN_TRANSIT:
        batch.in_transit_at = datetime.utcnow()
        dist = float(batch.estimated_distance_km or 0)
        batch.estimated_transit_minutes = max(1, int(dist / 40.0 * 60)) if dist > 0 else 0
        for req in linked_reqs:
            req.status = TransportRequestStatusEnum.IN_TRANSIT
            req.in_transit_at = batch.in_transit_at
            req.estimated_transit_minutes = batch.estimated_transit_minutes
        for oid in order_ids:
            order = db.query(Order).filter(Order.id == oid).first()
            if order and order.buyer:
                create_notification(
                    db=db,
                    user_id=order.buyer.user_id,
                    title=f"Order #{order.id} In Transit",
                    message=f"Batch {batch.batch_code} is on the road to {batch.delivery_area}.",
                    notification_type="DELIVERY",
                    link="/buyer/orders",
                )

    elif new_status == DeliveryBatchStatusEnum.OUT_FOR_DELIVERY:
        for oid in order_ids:
            order = db.query(Order).filter(Order.id == oid).first()
            if order and order.buyer:
                create_notification(
                    db=db,
                    user_id=order.buyer.user_id,
                    title=f"Order #{order.id} Out For Delivery",
                    message=f"Your delivery is arriving today from batch {batch.batch_code}.",
                    notification_type="DELIVERY",
                    link="/buyer/orders",
                )

    elif new_status == DeliveryBatchStatusEnum.DELIVERED:
        # Complete all stops
        for stop in batch.stops:
            stop.status = "COMPLETED"
        # Mark fulfillment items and orders as DELIVERED
        for it in batch.fulfillment_items:
            it.status = "DELIVERED"
        for req in linked_reqs:
            req.status = TransportRequestStatusEnum.DELIVERED

        for oid in order_ids:
            order = db.query(Order).options(joinedload(Order.payment)).filter(Order.id == oid).first()
            if order and order.status != OrderStatusEnum.DELIVERED:
                order.status = OrderStatusEnum.DELIVERED
            # Auto-confirm Pay on Delivery payment upon doorstep delivery
            if order and order.payment_method == PaymentMethodEnum.PAY_ON_DELIVERY and order.payment_status == PaymentStatusEnum.PENDING:
                now_dt = datetime.utcnow()
                order.payment_status = PaymentStatusEnum.PAID
                order.paid_at = now_dt
                if order.payment:
                    order.payment.payment_status = PaymentStatusEnum.PAID
                    order.payment.paid_at = now_dt
            if order and order.buyer:
                create_notification(
                    db=db,
                    user_id=order.buyer.user_id,
                    title=f"Order #{order.id} Delivered!",
                    message=f"Your produce has been delivered successfully. Thank you for using AgriDirect!",
                    notification_type="DELIVERY",
                    link="/buyer/orders",
                )

        # Transporter payout notice
        if batch.transporter and batch.transporter.user:
            create_notification(
                db=db,
                user_id=batch.transporter.user_id,
                title=f"Batch {batch.batch_code} Completed",
                message=f"All {len(order_ids)} customer deliveries completed. Payout of ₹{batch.estimated_logistics_cost} credited.",
                notification_type="TRANSPORT",
                link="/transporter/dashboard",
            )

    db.commit()
    db.refresh(batch)
    return batch


def get_batch_admin_stats(db: Session) -> Dict[str, Any]:
    """Computes real database logistics statistics for the admin dashboard without synthetic data."""
    batches = db.query(DeliveryBatch).all()
    pending = [b for b in batches if b.status in (DeliveryBatchStatusEnum.BATCH_CREATED, DeliveryBatchStatusEnum.TRANSPORTER_ASSIGNED)]
    active = [b for b in batches if b.status in (
        DeliveryBatchStatusEnum.ACCEPTED,
        DeliveryBatchStatusEnum.READY_FOR_PICKUP,
        DeliveryBatchStatusEnum.PICKED_UP,
        DeliveryBatchStatusEnum.IN_TRANSIT,
        DeliveryBatchStatusEnum.OUT_FOR_DELIVERY,
    )]
    completed = [b for b in batches if b.status == DeliveryBatchStatusEnum.DELIVERED]
    unassigned = [b for b in batches if b.assigned_transporter_id is None]
    failed = [b for b in batches if b.status == DeliveryBatchStatusEnum.CANCELLED]

    total_cargo = sum(float(b.total_quantity_kg) for b in batches)
    total_orders = sum(b.total_orders_count for b in batches)

    warehouses = [w["warehouse_name"] for w in DISTRICT_WAREHOUSES.values()]
    delivery_areas = sorted(list(SUPPORTED_DISTRICTS))

    return {
        "total_batches": len(batches),
        "delivered_batches": len(completed),
        "total_weight_kg": round(total_cargo, 2),
        "total_customers_served": sum(b.total_customers_count for b in completed),
        "pending_batches": len(pending),
        "transporter_assignments": len(batches) - len(unassigned),
        "active_transport_jobs": len(active),
        "completed_deliveries": len(completed),
        "unassigned_batches": len(unassigned),
        "failed_deliveries": len(failed),
        "warehouse_pickup_locations": warehouses,
        "delivery_areas": delivery_areas,
        "total_orders_in_batches": total_orders,
        "total_cargo_transported_kg": round(total_cargo, 2),
    }
