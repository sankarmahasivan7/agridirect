"""
Auto-creates real transport requests when a buyer's order is placed, and
picks the actual nearest feasible vehicle for each one.

Key design choice: a single order can contain items from several different
farmers/FPOs. Rather than trying to build one multi-stop route across
unrelated farms (which would need a real routing engine to be honest about),
we split the order into ONE transport request PER SELLER. Each request gets
its own pickup point (that seller's real farm/FPO location) and is matched
independently to the closest feasible vehicle -- which naturally means two
far-apart farmers in the same order can end up assigned to two different,
geographically-appropriate vehicles, without any fabricated routing.
"""
from collections import defaultdict
from datetime import datetime, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.constants import get_district_warehouse
from app.models.models import (
    Order, OrderItem, ProductListing, TransportRequest, TransportRequestStatusEnum,
    Vehicle, TransporterProfile,
)
from app.utils.geo import haversine_km
from app.services.maps_service import get_road_distance_and_duration

DEFAULT_REQUIRED_WITHIN_DAYS = 2


def calculate_logistics_cost(
    weight_kg: float | Decimal, distance_km: float | Decimal = 0.0, strategy: str = "direct"
) -> Decimal:
    """
    Computes logistics cost using configurable rules from app.core.config.settings:
    Cost = Base Dispatch Fee + (Rate per km * Distance km) + (Rate per kg * Weight kg)
    If strategy is 'consolidated', applies the configured discount percentage.
    """
    base_fee = Decimal(str(settings.LOGISTICS_BASE_DISPATCH_FEE))
    rate_km = Decimal(str(settings.LOGISTICS_RATE_PER_KM))
    rate_kg = Decimal(str(settings.LOGISTICS_RATE_PER_KG))

    d_km = Decimal(str(round(float(distance_km or 0.0), 2)))
    w_kg = Decimal(str(round(float(weight_kg or 0.0), 2)))

    cost = base_fee + (rate_km * d_km) + (rate_kg * w_kg)
    if strategy == "consolidated":
        discount_pct = Decimal(str(settings.LOGISTICS_CONSOLIDATION_DISCOUNT_PCT)) / Decimal("100")
        cost = cost * (Decimal("1.0") - discount_pct)

    return Decimal(str(round(cost, 2)))


def determine_logistics_strategy(
    pickup_lat=None, pickup_lon=None, dest_lat=None, dest_lon=None, db: Session = None, current_order_id: int = None
) -> tuple[str, str | None]:
    """
    Determines logistics strategy according to real distance and geographic batching:
    - Long-distance (> settings.LOGISTICS_LONG_DISTANCE_THRESHOLD_KM, e.g. 80km):
      'aggregation_hub' with intermediate regional cross-dock hub (logistics only, never buys/resells).
    - Consolidated delivery (when multiple orders / requests share route or destination area within threshold):
      'consolidated' (with 20% discount applied to logistics cost).
    - Direct farmer -> consumer:
      'direct'
    """
    dist_km = 0.0
    if pickup_lat is not None and pickup_lon is not None and dest_lat is not None and dest_lon is not None:
        dist_km = haversine_km(pickup_lat, pickup_lon, dest_lat, dest_lon)

    # 1. Long-distance routing (> threshold, e.g. 80 km) -> Aggregation Hub
    if dist_km > settings.LOGISTICS_LONG_DISTANCE_THRESHOLD_KM:
        hub_name = "Madurai Regional Agri-Logistics Transit Hub"
        return "aggregation_hub", hub_name

    # 2. Consolidated delivery check
    # Check if there are other pending/active transport requests headed to nearby destination (within 25km)
    if db is not None and dest_lat is not None and dest_lon is not None:
        other_requests = (
            db.query(TransportRequest)
            .filter(
                TransportRequest.status.in_([
                    TransportRequestStatusEnum.PENDING,
                    TransportRequestStatusEnum.ACCEPTED,
                    TransportRequestStatusEnum.PICKUP,
                    TransportRequestStatusEnum.REQUESTED,
                    TransportRequestStatusEnum.ASSIGNED,
                ])
            )
        )
        if current_order_id:
            other_requests = other_requests.filter(TransportRequest.order_id != current_order_id)
        candidates = other_requests.limit(20).all()
        for cand in candidates:
            if cand.destination_latitude is not None and cand.destination_longitude is not None:
                d = haversine_km(dest_lat, dest_lon, cand.destination_latitude, cand.destination_longitude)
                if d <= 25.0:  # within 25 km destination cluster
                    return "consolidated", None

    # 3. Direct farmer -> consumer
    return "direct", None


def _busy_vehicle_ids(db: Session) -> set:
    rows = (
        db.query(TransportRequest.assigned_vehicle_id)
        .filter(TransportRequest.status.in_([
            TransportRequestStatusEnum.ACCEPTED,
            TransportRequestStatusEnum.PICKUP,
            TransportRequestStatusEnum.IN_TRANSIT,
            TransportRequestStatusEnum.ASSIGNED,
        ]))
        .filter(TransportRequest.assigned_vehicle_id.isnot(None))
        .all()
    )
    return {vid for (vid,) in rows}


def find_feasible_vehicle(db: Session, weight_kg, pickup_lat=None, pickup_lon=None):
    """
    Among active, currently-free, available-transporter vehicles with enough
    capacity: if we know the pickup point AND at least one candidate has a
    known position (live GPS, falling back to the transporter's registered
    base location), pick the CLOSEST one -- real straight-line distance, not
    a guess. Vehicles with an unknown position are still eligible but sort
    after any vehicle whose distance we can actually compute. If we have no
    pickup coordinates at all, we fall back to best-fit-by-capacity (the
    smallest vehicle that still fits). Returns None -- never a fabricated
    vehicle -- if nothing fits.
    """
    busy_ids = _busy_vehicle_ids(db)
    query = (
        db.query(Vehicle)
        .join(TransporterProfile, Vehicle.transporter_id == TransporterProfile.id)
        .filter(
            Vehicle.is_active == True,               # noqa: E712
            TransporterProfile.is_available == True,  # noqa: E712
            Vehicle.capacity_kg >= weight_kg,
        )
    )
    if busy_ids:
        query = query.filter(~Vehicle.id.in_(busy_ids))
    candidates = query.all()
    from app.logistics.vehicle_rules import evaluate_vehicle_for_batch
    candidates = [v for v in candidates if evaluate_vehicle_for_batch(v, weight_kg)[0]]
    if not candidates:
        return None

    if pickup_lat is None or pickup_lon is None:
        return sorted(candidates, key=lambda v: v.capacity_kg)[0]

    def vehicle_distance(v):
        lat = v.current_latitude if v.current_latitude is not None else (v.transporter.base_latitude if v.transporter else None)
        lon = v.current_longitude if v.current_longitude is not None else (v.transporter.base_longitude if v.transporter else None)
        if lat is None or lon is None:
            return float("inf")
        return haversine_km(pickup_lat, pickup_lon, lat, lon)

    ranked = sorted(candidates, key=lambda v: (vehicle_distance(v), v.capacity_kg))
    return ranked[0]


def _seller_warehouse_pickup_info(listing: ProductListing):
    """
    Implements 1-warehouse-per-district strategy:
    Resolves the seller's registered district (Tenkasi, Tirunelveli, Thoothukudi)
    and returns (warehouse_label, warehouse_lat, warehouse_lon, warehouse_dict, seller_name).
    """
    seller_district = None
    seller_name = "Direct Farmer"
    fallback_loc = listing.location

    if listing.farmer_id and listing.farmer:
        f = listing.farmer
        seller_name = f.full_name
        seller_district = f.district
        fallback_loc = f.farm_location or listing.location or f.village_town
    elif listing.fpo_id and listing.fpo:
        fpo = listing.fpo
        seller_name = fpo.organization_name
        seller_district = fpo.district
        fallback_loc = fpo.location or listing.location

    warehouse = get_district_warehouse(seller_district, fallback_loc)
    label = f"{warehouse['warehouse_name']} ({warehouse['address']})"
    return label, warehouse["latitude"], warehouse["longitude"], warehouse, seller_name


def create_transport_requests_for_order(db: Session, order: Order):
    """
    Fulfills orders via the 1-Warehouse-Per-District logistics model:
    1. Groups order items by seller.
    2. Maps each seller's district to that district's Central Agri-Warehouse
       (Tenkasi, Tirunelveli, or Thoothukudi).
    3. Sets pickup point directly to the District Warehouse.
    4. Auto-matches the nearest transporter to pick up from the District Warehouse
       and deliver to the buyer's delivery destination.
    """
    buyer = order.buyer
    dest_label = order.delivery_location
    dest_lat = order.delivery_latitude if order.delivery_latitude is not None else (buyer.default_latitude if buyer else None)
    dest_lon = order.delivery_longitude if order.delivery_longitude is not None else (buyer.default_longitude if buyer else None)

    groups = defaultdict(list)
    for item in order.items:
        listing = item.listing
        key = ("farmer", listing.farmer_id) if listing.farmer_id else ("fpo", listing.fpo_id)
        groups[key].append(item)

    created = []
    required_by = datetime.utcnow() + timedelta(days=DEFAULT_REQUIRED_WITHIN_DAYS)

    for _key, items in groups.items():
        listing = items[0].listing
        pickup_label, pickup_lat, pickup_lon, warehouse, seller_name = _seller_warehouse_pickup_info(listing)
        total_weight = sum(float(i.quantity) for i in items)
        cargo_desc = ", ".join(f"{i.listing.product.name} x{i.quantity}{i.listing.unit}" for i in items)
        notes = f"[{warehouse['code']}] {warehouse['warehouse_name']} | Seller: {seller_name} | Items: {cargo_desc}"

        # 1. Real road distance from District Warehouse to Buyer's destination (Google Maps / OSRM)
        dist_km = None
        if pickup_lat is not None and pickup_lon is not None and dest_lat is not None and dest_lon is not None:
            dist_km, _ = get_road_distance_and_duration(pickup_lat, pickup_lon, dest_lat, dest_lon)

        # 2. Warehouse Logistics Strategy & Hub
        strategy = "warehouse"
        hub_name = warehouse["warehouse_name"]

        # 3. Configurable Logistics Cost from District Warehouse to Buyer
        cost = calculate_logistics_cost(total_weight, dist_km or 0.0, strategy)

        # 4. Feasible vehicle matching closest to the District Warehouse
        vehicle = find_feasible_vehicle(db, total_weight, pickup_lat, pickup_lon)
        vehicle_capacity = vehicle.capacity_kg if vehicle else None
        assigned_id = vehicle.id if vehicle else None

        # Determine perishability urgency across items in this consignment
        is_perishable = any(bool(i.listing.is_perishable) for i in items)
        urgencies = [i.listing.calculate_perishability_status() for i in items if i.listing.is_perishable]
        if "CRITICAL" in urgencies:
            perish_urgency = "CRITICAL"
        elif "URGENT" in urgencies:
            perish_urgency = "URGENT"
        elif "SELL SOON" in urgencies:
            perish_urgency = "SELL_SOON"
        else:
            perish_urgency = "NORMAL"

        storage_reqs = [i.listing.storage_requirement for i in items if i.listing.storage_requirement]
        storage_req = ", ".join(set(storage_reqs)) if storage_reqs else None

        avail_dates = [i.listing.available_from or i.listing.harvest_date for i in items if (i.listing.available_from or i.listing.harvest_date)]
        req_available_from = max(avail_dates) if avail_dates else None

        req = TransportRequest(
            requested_by_user_id=order.buyer.user_id,
            order_id=order.id,
            pickup_location=pickup_label,
            pickup_latitude=pickup_lat,
            pickup_longitude=pickup_lon,
            destination_location=dest_label,
            destination_latitude=dest_lat,
            destination_longitude=dest_lon,
            required_by=required_by,
            available_from=req_available_from,
            weight_kg=total_weight,
            notes=notes,
            status=TransportRequestStatusEnum.PENDING,
            assigned_vehicle_id=assigned_id,
            vehicle_capacity_kg=vehicle_capacity,
            logistics_strategy=strategy,
            hub_name=hub_name,
            distance_km=Decimal(str(round(dist_km, 2))) if dist_km is not None else None,
            logistics_cost=cost,
            is_perishable=is_perishable,
            perishability_urgency=perish_urgency,
            storage_requirement=storage_req,
        )
        db.add(req)
        db.flush()
        created.append(req)

    return created
