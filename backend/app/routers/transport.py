from datetime import datetime, date, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.core.deps import get_current_user, require_role
from app.models.models import (
    User, RoleEnum, TransporterProfile, TransportRequest, TransportRequestStatusEnum,
    Order, OrderStatusEnum, Vehicle, BuyerProfile, OrderItem, ProductListing,
)
from app.schemas.schemas import TransportRequestCreate, TransportRequestOut, LocationUpdate, RouteOptimizationOut, VehicleOut
from app.services.transport_service import find_feasible_vehicle
from app.services.route_optimization_service import optimize_transport_routes
from app.services.notification_service import notify_transport_accepted, notify_transport_status_update
from app.utils.geo import estimate_transit_minutes
from app.logistics.vehicle_rules import evaluate_vehicle_for_batch, is_bike_vehicle, is_truck_vehicle

router = APIRouter(prefix="/api/transport", tags=["transport"])


def _serialize(req: TransportRequest) -> TransportRequestOut:
    status_str = req.status.value if hasattr(req.status, "value") else str(req.status)
    vehicle_out = None
    if req.assigned_vehicle:
        v = req.assigned_vehicle
        lat = v.current_latitude
        lon = v.current_longitude
        loc_label = v.location_label
        updated_at = v.location_updated_at
        if (lat is None or lon is None) and getattr(v, "transporter", None):
            lat = v.transporter.base_latitude
            lon = v.transporter.base_longitude
            loc_label = loc_label or v.transporter.base_location
            user_obj = getattr(v.transporter, "user", None)
            updated_at = updated_at or getattr(user_obj, "created_at", None) or datetime.utcnow()
        vehicle_out = VehicleOut(
            id=v.id,
            name=v.name,
            vehicle_number=v.vehicle_number,
            vehicle_type=v.vehicle_type,
            capacity_kg=v.capacity_kg,
            current_latitude=lat,
            current_longitude=lon,
            location_label=loc_label,
            location_updated_at=updated_at,
        )
    return TransportRequestOut(
        id=req.id,
        pickup_location=req.pickup_location,
        pickup_latitude=req.pickup_latitude,
        pickup_longitude=req.pickup_longitude,
        destination_location=req.destination_location,
        destination_latitude=req.destination_latitude,
        destination_longitude=req.destination_longitude,
        required_by=req.required_by,
        available_from=req.available_from,
        weight_kg=req.weight_kg,
        notes=req.notes,
        status=status_str,
        order_id=req.order_id,
        assigned_vehicle=vehicle_out,
        logistics_strategy=req.logistics_strategy or "direct",
        hub_name=req.hub_name,
        distance_km=req.distance_km,
        logistics_cost=req.logistics_cost,
        vehicle_capacity_kg=req.vehicle_capacity_kg,
        is_perishable=bool(req.is_perishable),
        perishability_urgency=req.perishability_urgency or "NORMAL",
        storage_requirement=req.storage_requirement,
        in_transit_at=req.in_transit_at,
        estimated_transit_minutes=req.estimated_transit_minutes,
        created_at=req.created_at,
    )


@router.post("", response_model=TransportRequestOut, status_code=201)
def create_transport_request(
    payload: TransportRequestCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(RoleEnum.fpo, RoleEnum.admin)),
):
    """
    Manual transport booking, reserved for FPO/admin bulk logistics (e.g.
    moving aggregated supply that isn't tied to a specific buyer order).
    Ordinary buyer purchases no longer need this -- transport is created and
    assigned automatically the moment an order is placed (see
    app/services/transport_service.py), based on the real farmer and buyer
    locations, never manually requested by the farmer or buyer.
    """
    if payload.order_id is not None:
        order = db.query(Order).filter(Order.id == payload.order_id).first()
        if not order:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")

    req = TransportRequest(
        requested_by_user_id=user.id,
        order_id=payload.order_id,
        pickup_location=payload.pickup_location,
        pickup_latitude=payload.pickup_latitude,
        pickup_longitude=payload.pickup_longitude,
        destination_location=payload.destination_location,
        destination_latitude=payload.destination_latitude,
        destination_longitude=payload.destination_longitude,
        required_by=payload.required_by,
        weight_kg=payload.weight_kg,
        notes=payload.notes,
        status=TransportRequestStatusEnum.PENDING,
    )
    db.add(req)
    db.flush()

    vehicle = find_feasible_vehicle(db, payload.weight_kg, payload.pickup_latitude, payload.pickup_longitude)
    if vehicle:
        req.assigned_vehicle_id = vehicle.id
        req.vehicle_capacity_kg = vehicle.capacity_kg

    db.commit()
    db.refresh(req)
    return _serialize(req)


@router.get("/requests/mine", response_model=list[TransportRequestOut])
def my_transport_requests(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(RoleEnum.farmer, RoleEnum.buyer, RoleEnum.fpo)),
):
    reqs = (
        db.query(TransportRequest)
        .options(
            joinedload(TransportRequest.assigned_vehicle).joinedload(Vehicle.transporter),
            joinedload(TransportRequest.order).joinedload(Order.buyer),
        )
        .filter(
            or_(
                TransportRequest.requested_by_user_id == user.id,
                TransportRequest.order.has(Order.buyer.has(BuyerProfile.user_id == user.id))
            )
        )
        .order_by(TransportRequest.created_at.desc())
        .all()
    )
    return [_serialize(r) for r in reqs]


@router.get("/requests/assigned", response_model=list[TransportRequestOut])
def assigned_transport_requests(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(RoleEnum.transporter)),
):
    """Requests currently assigned or accepted by the logged-in transporter's vehicle."""
    profile = user.transporter_profile
    if not profile or not profile.vehicle:
        return []
    reqs = (
        db.query(TransportRequest)
        .options(joinedload(TransportRequest.assigned_vehicle))
        .filter(
            TransportRequest.assigned_vehicle_id == profile.vehicle.id,
            TransportRequest.status.in_([
                TransportRequestStatusEnum.PENDING,
                TransportRequestStatusEnum.ACCEPTED,
                TransportRequestStatusEnum.PICKUP,
                TransportRequestStatusEnum.ASSIGNED,
                TransportRequestStatusEnum.IN_TRANSIT,
            ]),
        )
        .order_by(TransportRequest.required_by.asc())
        .all()
    )
    return [_serialize(r) for r in reqs]


# ---------- 5-Stage Job Endpoints (Transporter Dashboard) ----------

@router.get("/jobs/available", response_model=list[TransportRequestOut])
def available_transport_jobs(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(RoleEnum.transporter)),
):
    """
    Returns pending transport jobs available for acceptance by the transporter.
    Strict Rules:
    - Jobs <= 50 kg must ONLY be shown to transporters registered as a Bike (capacity <= 50 kg).
      They must NEVER be shown to a Mini Truck driver or any other truck driver.
    - Jobs > 50 kg must NEVER be shown to a Bike.
    - Trucks can only be shown jobs > 50 kg that meet their >= 35% minimum fill requirement (weight >= capacity * 0.35).
    - Excludes jobs already assigned to another carrier's vehicle.
    """
    profile = user.transporter_profile
    if not profile or not profile.vehicle:
        return []

    vehicle = profile.vehicle
    query = (
        db.query(TransportRequest)
        .options(joinedload(TransportRequest.assigned_vehicle))
        .filter(TransportRequest.status == TransportRequestStatusEnum.PENDING)
    )

    reqs = query.all()
    filtered_reqs = []
    for r in reqs:
        w = float(r.weight_kg)
        # 1. BIKE RULE: <= 50 kg must ONLY be shown to bike vehicles
        if w <= 50.0 and not is_bike_vehicle(vehicle):
            continue
        # > 50 kg must NEVER be shown to bike vehicles
        if w > 50.0 and is_bike_vehicle(vehicle):
            continue
        # 2. Check general vehicle eligibility (capacity, 35% fill for trucks)
        is_ok, _ = evaluate_vehicle_for_batch(vehicle, r.weight_kg)
        if is_ok:
            filtered_reqs.append(r)

    # Prioritize CRITICAL -> URGENT -> SELL_SOON -> NORMAL to avoid transport spoilage
    urgency_order = {"CRITICAL": 0, "URGENT": 1, "SELL_SOON": 2, "NORMAL": 3}
    filtered_reqs.sort(key=lambda r: (urgency_order.get(r.perishability_urgency or "NORMAL", 3), -r.id))
    return [_serialize(r) for r in filtered_reqs]


@router.get("/jobs/mine", response_model=list[TransportRequestOut])
def my_transport_jobs(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(RoleEnum.transporter)),
):
    """Returns all transport jobs assigned to or accepted by the logged-in transporter."""
    profile = user.transporter_profile
    if not profile or not profile.vehicle:
        return []

    reqs = (
        db.query(TransportRequest)
        .options(joinedload(TransportRequest.assigned_vehicle))
        .filter(TransportRequest.assigned_vehicle_id == profile.vehicle.id)
        .order_by(TransportRequest.created_at.desc())
        .all()
    )
    return [_serialize(r) for r in reqs]


@router.get("/optimize-routes", response_model=RouteOptimizationOut)
def optimize_routes(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(RoleEnum.transporter, RoleEnum.admin)),
):
    """
    AI OPTIMIZED ROUTE:
    Runs Google OR-Tools PDP solver to optimize pending & accepted transport jobs.
    Optimizes distance, vehicle capacity, trip count, delivery constraints, and perishability priority.
    """
    return optimize_transport_routes(db, user)


@router.post("/jobs/{request_id}/accept", response_model=TransportRequestOut)
def accept_transport_job(
    request_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(RoleEnum.transporter)),
):
    """
    Transporter accepts a pending transport job: PENDING -> ACCEPTED.
    Locks the job to the transporter's vehicle and stores vehicle capacity.
    """
    profile = user.transporter_profile
    if not profile or not profile.vehicle:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No active vehicle registered for this transporter")

    req = db.query(TransportRequest).options(joinedload(TransportRequest.assigned_vehicle)).filter(TransportRequest.id == request_id).first()
    if not req:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Transport job not found")

    if req.status not in (TransportRequestStatusEnum.PENDING, TransportRequestStatusEnum.ASSIGNED):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Cannot accept job with status '{req.status.value}'")

    # Strictly evaluate vehicle eligibility (enforces Bike <= 50kg, Truck > 50kg with >= 35% capacity fill)
    is_eligible, reason = evaluate_vehicle_for_batch(profile.vehicle, req.weight_kg)
    if not is_eligible:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail=reason,
        )

    req.assigned_vehicle_id = profile.vehicle.id
    req.vehicle_capacity_kg = profile.vehicle.capacity_kg
    req.status = TransportRequestStatusEnum.ACCEPTED
    db.commit()
    db.refresh(req)
    try:
        notify_transport_accepted(db, req)
        db.commit()
    except Exception:
        pass
    return _serialize(req)


ALLOWED_TRANSITIONS = {
    TransportRequestStatusEnum.PENDING: {
        TransportRequestStatusEnum.ACCEPTED,
        TransportRequestStatusEnum.ASSIGNED,
        TransportRequestStatusEnum.PICKUP,
        TransportRequestStatusEnum.IN_TRANSIT,
        TransportRequestStatusEnum.CANCELLED,
    },
    TransportRequestStatusEnum.ACCEPTED: {
        TransportRequestStatusEnum.PICKUP,
        TransportRequestStatusEnum.IN_TRANSIT,
        TransportRequestStatusEnum.CANCELLED,
    },
    TransportRequestStatusEnum.ASSIGNED: {
        TransportRequestStatusEnum.ACCEPTED,
        TransportRequestStatusEnum.PICKUP,
        TransportRequestStatusEnum.IN_TRANSIT,
        TransportRequestStatusEnum.CANCELLED,
    },
    TransportRequestStatusEnum.PICKUP: {
        TransportRequestStatusEnum.IN_TRANSIT,
        TransportRequestStatusEnum.CANCELLED,
    },
    TransportRequestStatusEnum.IN_TRANSIT: {
        TransportRequestStatusEnum.DELIVERED,
    },
}


def _execute_status_transition(
    req: TransportRequest,
    new_status: TransportRequestStatusEnum,
    profile: TransporterProfile,
    db: Session,
) -> TransportRequest:
    # If unassigned or pending acceptance, verify vehicle eligibility before assigning
    if req.assigned_vehicle_id is None and profile and profile.vehicle:
        is_eligible, reason = evaluate_vehicle_for_batch(profile.vehicle, req.weight_kg)
        if not is_eligible:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=reason)
        req.assigned_vehicle_id = profile.vehicle.id
        req.vehicle_capacity_kg = profile.vehicle.capacity_kg

    if not profile or not profile.vehicle or req.assigned_vehicle_id != profile.vehicle.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This request is not assigned to your vehicle")

    allowed = ALLOWED_TRANSITIONS.get(req.status, set())
    if new_status not in allowed:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Cannot move a shipment from {req.status.value} to {new_status.value} directly.",
        )

    today = date.today()
    if new_status in (TransportRequestStatusEnum.PICKUP, TransportRequestStatusEnum.IN_TRANSIT):
        if req.available_from and req.available_from > today:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Cannot pick up produce from warehouse yet. Produce is scheduled for harvest and warehouse deposit on {req.available_from.strftime('%d %b %Y')}.",
            )

    now = datetime.now(timezone.utc)

    if new_status == TransportRequestStatusEnum.IN_TRANSIT:
        req.in_transit_at = now.replace(tzinfo=None)
        req.estimated_transit_minutes = estimate_transit_minutes(
            req.pickup_latitude, req.pickup_longitude, req.destination_latitude, req.destination_longitude
        )

    if new_status == TransportRequestStatusEnum.DELIVERED:
        in_transit_at = req.in_transit_at
        if in_transit_at is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "This shipment was never marked In Transit.")
        in_transit_at_aware = in_transit_at.replace(tzinfo=timezone.utc)
        earliest_delivery = in_transit_at_aware + timedelta(minutes=req.estimated_transit_minutes or 0)
        if now < earliest_delivery:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Cannot mark delivered yet -- based on the distance, the earliest realistic delivery time is "
                f"{earliest_delivery.strftime('%Y-%m-%d %H:%M UTC')}.",
            )

    req.status = new_status

    # When delivery is completed, update the linked Order so farmer earnings are unlocked
    if new_status == TransportRequestStatusEnum.DELIVERED and req.order_id:
        order = db.query(Order).filter(Order.id == req.order_id).first()
        if order and order.status != OrderStatusEnum.DELIVERED:
            order.status = OrderStatusEnum.DELIVERED

    db.commit()
    db.refresh(req)
    try:
        notify_transport_status_update(db, req, new_status.value if hasattr(new_status, "value") else str(new_status))
        db.commit()
    except Exception:
        pass
    return req


@router.put("/jobs/{request_id}/status", response_model=TransportRequestOut)
def update_job_status(
    request_id: int,
    new_status: TransportRequestStatusEnum,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(RoleEnum.transporter)),
):
    """Progresses a transport job along: ACCEPTED -> PICKUP -> IN_TRANSIT -> DELIVERED."""
    req = db.query(TransportRequest).options(joinedload(TransportRequest.assigned_vehicle)).filter(TransportRequest.id == request_id).first()
    if not req:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Transport job not found")
    req = _execute_status_transition(req, new_status, user.transporter_profile, db)
    return _serialize(req)


@router.put("/requests/{request_id}/status", response_model=TransportRequestOut)
def update_transport_status(
    request_id: int,
    new_status: TransportRequestStatusEnum,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(RoleEnum.transporter)),
):
    """Legacy route alias for updating transport status."""
    req = db.query(TransportRequest).options(joinedload(TransportRequest.assigned_vehicle)).filter(TransportRequest.id == request_id).first()
    if not req:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Transport request not found")
    req = _execute_status_transition(req, new_status, user.transporter_profile, db)
    return _serialize(req)


@router.put("/vehicle/location")
def update_vehicle_location(
    payload: LocationUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(RoleEnum.transporter)),
):
    """Transporter reports their vehicle's real current position (e.g. from the browser's geolocation API)."""
    profile = user.transporter_profile
    if not profile or not profile.vehicle:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No vehicle registered for this transporter")

    vehicle = profile.vehicle
    vehicle.current_latitude = payload.latitude
    vehicle.current_longitude = payload.longitude
    vehicle.location_label = payload.location_label
    vehicle.location_updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"status": "updated", "latitude": str(vehicle.current_latitude), "longitude": str(vehicle.current_longitude)}


@router.get("/requests/{request_id}/track", response_model=TransportRequestOut)
def track_transport_request(
    request_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Farmer/buyer/FPO who created the request (or the order's buyer, or the assigned
    transporter, or an admin) can see its live status and the assigned vehicle's last known
    location. Accepts either transport_request_id or order_id for maximum resilience.
    """
    req = (
        db.query(TransportRequest)
        .options(
            joinedload(TransportRequest.assigned_vehicle).joinedload(Vehicle.transporter),
            joinedload(TransportRequest.order).joinedload(Order.buyer),
            joinedload(TransportRequest.order).joinedload(Order.items).joinedload(OrderItem.listing).joinedload(ProductListing.farmer),
        )
        .filter(
            or_(
                TransportRequest.id == request_id,
                TransportRequest.order_id == request_id,
                TransportRequest.batch_id == request_id,
            )
        )
        .first()
    )
    if not req:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Transport request not found")

    is_admin = user.role == RoleEnum.admin
    is_transporter = user.role == RoleEnum.transporter
    is_owner = req.requested_by_user_id == user.id
    is_order_buyer = bool(req.order and req.order.buyer and req.order.buyer.user_id == user.id)
    is_order_farmer = False
    if req.order and getattr(req.order, "items", None):
        is_order_farmer = any(
            item.listing and item.listing.farmer and item.listing.farmer.user_id == user.id
            for item in req.order.items
        )
    is_farmer = user.role in (RoleEnum.farmer, RoleEnum.fpo) and (is_owner or is_order_farmer)

    # Permit admins, transporters (who need to preview routes and execute deliveries),
    # the request owner, the buyer of the order, and the selling farmer/FPO
    if not (is_admin or is_transporter or is_owner or is_order_buyer or is_farmer or user.role in (RoleEnum.farmer, RoleEnum.fpo)):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have access to this shipment")

    return _serialize(req)
