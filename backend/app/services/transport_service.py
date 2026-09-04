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

from sqlalchemy.orm import Session

from app.models.models import (
    Order, OrderItem, ProductListing, TransportRequest, TransportRequestStatusEnum,
    Vehicle, TransporterProfile,
)
from app.utils.geo import haversine_km

DEFAULT_REQUIRED_WITHIN_DAYS = 2


def _busy_vehicle_ids(db: Session) -> set:
    rows = (
        db.query(TransportRequest.assigned_vehicle_id)
        .filter(TransportRequest.status.in_([TransportRequestStatusEnum.ASSIGNED, TransportRequestStatusEnum.IN_TRANSIT]))
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


def _seller_pickup_info(listing: ProductListing):
    """Returns (label, latitude, longitude) for whoever is fulfilling this listing."""
    if listing.farmer_id and listing.farmer:
        f = listing.farmer
        label = f"{f.full_name} - {f.farm_location or listing.location or 'location not set'}"
        return label, f.farm_latitude, f.farm_longitude
    if listing.fpo_id and listing.fpo:
        fpo = listing.fpo
        label = f"{fpo.organization_name} - {fpo.location or listing.location or 'location not set'}"
        return label, fpo.latitude, fpo.longitude
    return listing.location or "Unknown pickup point", None, None


def create_transport_requests_for_order(db: Session, order: Order):
    """
    Groups the order's items by seller (farmer or FPO), creates one
    TransportRequest per seller with that seller's real pickup coordinates,
    and immediately tries to auto-assign the nearest feasible vehicle to
    each. Does not commit -- caller controls the transaction.
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
        pickup_label, pickup_lat, pickup_lon = _seller_pickup_info(listing)
        total_weight = sum(float(i.quantity) for i in items)
        notes = ", ".join(f"{i.listing.product.name} x{i.quantity}{i.listing.unit}" for i in items)

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
            weight_kg=total_weight,
            notes=notes,
            status=TransportRequestStatusEnum.REQUESTED,
        )
        db.add(req)
        db.flush()

        vehicle = find_feasible_vehicle(db, total_weight, pickup_lat, pickup_lon)
        if vehicle:
            req.assigned_vehicle_id = vehicle.id
            req.status = TransportRequestStatusEnum.ASSIGNED

        created.append(req)

    return created
