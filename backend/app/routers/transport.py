from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.core.deps import get_current_user, require_role
from app.models.models import (
    User, RoleEnum, TransporterProfile, TransportRequest, TransportRequestStatusEnum, Order,
)
from app.schemas.schemas import TransportRequestCreate, TransportRequestOut, LocationUpdate
from app.services.transport_service import find_feasible_vehicle
from app.utils.geo import estimate_transit_minutes

router = APIRouter(prefix="/api/transport", tags=["transport"])


def _serialize(req: TransportRequest) -> TransportRequestOut:
    return TransportRequestOut(
        id=req.id,
        pickup_location=req.pickup_location,
        pickup_latitude=req.pickup_latitude,
        pickup_longitude=req.pickup_longitude,
        destination_location=req.destination_location,
        destination_latitude=req.destination_latitude,
        destination_longitude=req.destination_longitude,
        required_by=req.required_by,
        weight_kg=req.weight_kg,
        notes=req.notes,
        status=req.status.value,
        order_id=req.order_id,
        assigned_vehicle=req.assigned_vehicle,
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
        status=TransportRequestStatusEnum.REQUESTED,
    )
    db.add(req)
    db.flush()

    vehicle = find_feasible_vehicle(db, payload.weight_kg, payload.pickup_latitude, payload.pickup_longitude)
    if vehicle:
        req.assigned_vehicle_id = vehicle.id
        req.status = TransportRequestStatusEnum.ASSIGNED

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
        .options(joinedload(TransportRequest.assigned_vehicle))
        .filter(TransportRequest.requested_by_user_id == user.id)
        .order_by(TransportRequest.created_at.desc())
        .all()
    )
    return [_serialize(r) for r in reqs]


@router.get("/requests/assigned", response_model=list[TransportRequestOut])
def assigned_transport_requests(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(RoleEnum.transporter)),
):
    """Requests currently assigned to the logged-in transporter's vehicle."""
    profile = user.transporter_profile
    if not profile or not profile.vehicle:
        return []
    reqs = (
        db.query(TransportRequest)
        .options(joinedload(TransportRequest.assigned_vehicle))
        .filter(
            TransportRequest.assigned_vehicle_id == profile.vehicle.id,
            TransportRequest.status.in_([TransportRequestStatusEnum.ASSIGNED, TransportRequestStatusEnum.IN_TRANSIT]),
        )
        .order_by(TransportRequest.required_by.asc())
        .all()
    )
    return [_serialize(r) for r in reqs]


ALLOWED_TRANSITIONS = {
    TransportRequestStatusEnum.ASSIGNED: {TransportRequestStatusEnum.IN_TRANSIT, TransportRequestStatusEnum.CANCELLED},
    TransportRequestStatusEnum.IN_TRANSIT: {TransportRequestStatusEnum.DELIVERED},
}


@router.put("/requests/{request_id}/status", response_model=TransportRequestOut)
def update_transport_status(
    request_id: int, new_status: TransportRequestStatusEnum,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(RoleEnum.transporter)),
):
    """
    Progresses a shipment. Enforces a real status flow (can't skip straight
    to Delivered), and -- the important part -- blocks marking a shipment
    Delivered until the physically-estimated transit time has actually
    elapsed since the trip started. The estimate itself is computed from
    real Haversine distance between the real pickup and destination
    coordinates when both are known (see app/utils/geo.py); it's an honest
    approximation, not a fabricated countdown.
    """
    req = db.query(TransportRequest).options(joinedload(TransportRequest.assigned_vehicle)).filter(TransportRequest.id == request_id).first()
    if not req:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Transport request not found")

    profile = user.transporter_profile
    if not profile or not profile.vehicle or req.assigned_vehicle_id != profile.vehicle.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This request is not assigned to your vehicle")

    allowed = ALLOWED_TRANSITIONS.get(req.status, set())
    if new_status not in allowed:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Cannot move a shipment from {req.status.value} to {new_status.value} directly.",
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
    db.commit()
    db.refresh(req)
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
    Farmer/buyer/FPO who created the request (or the assigned transporter, or
    an admin) can see its live status and the assigned vehicle's last known
    location. No location is shown for anyone else's request.
    """
    req = db.query(TransportRequest).options(joinedload(TransportRequest.assigned_vehicle)).filter(TransportRequest.id == request_id).first()
    if not req:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Transport request not found")

    is_owner = req.requested_by_user_id == user.id
    is_assigned_transporter = (
        user.role == RoleEnum.transporter and user.transporter_profile and req.assigned_vehicle
        and req.assigned_vehicle.transporter_id == user.transporter_profile.id
    )
    if not (is_owner or is_assigned_transporter or user.role == RoleEnum.admin):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have access to this shipment")

    return _serialize(req)
