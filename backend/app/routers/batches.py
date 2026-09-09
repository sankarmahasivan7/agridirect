"""
Router for Batched Delivery & 3PL Transporter Allocation in AgriDirect.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.core.deps import get_current_user, require_role
from app.models.models import User, RoleEnum, DeliveryBatch, DeliveryBatchStatusEnum, TransporterProfile
from app.schemas.schemas import DeliveryBatchOut, BatchAdminStatsOut
from app.services.batch_service import (
    create_delivery_batches,
    accept_delivery_batch,
    update_batch_status,
    get_batch_admin_stats,
)

router = APIRouter(prefix="/api/batches", tags=["batches"])


@router.post("/auto-batch", response_model=List[DeliveryBatchOut])
def trigger_auto_batch(
    delivery_district: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(RoleEnum.admin, RoleEnum.transporter, RoleEnum.buyer)),
):
    """
    Evaluates all unfulfilled customer orders, splits them by source warehouse,
    groups orders destined for the same delivery district, sequences multi-warehouse pickups,
    and allocates eligible 3PL transporters.
    """
    created = create_delivery_batches(db=db, delivery_district=delivery_district)
    return created


@router.get("", response_model=List[DeliveryBatchOut])
def list_batches(
    delivery_area: Optional[str] = None,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Lists consolidated delivery batches with optional filters."""
    query = (
        db.query(DeliveryBatch)
        .options(
            joinedload(DeliveryBatch.stops),
            joinedload(DeliveryBatch.fulfillment_items),
            joinedload(DeliveryBatch.transporter),
            joinedload(DeliveryBatch.vehicle),
        )
    )
    if delivery_area:
        query = query.filter(DeliveryBatch.delivery_area == delivery_area)
    if status_filter:
        query = query.filter(DeliveryBatch.status == status_filter)

    batches = query.order_by(DeliveryBatch.created_at.desc()).all()
    return batches


@router.get("/available", response_model=List[DeliveryBatchOut])
def get_available_batches(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(RoleEnum.transporter)),
):
    """
    Returns unassigned or assigned batches available for this transporter.
    Only shows batches whose weight fits within the transporter's vehicle capacity.
    """
    profile = user.transporter_profile
    if not profile or not profile.vehicle:
        return []

    batches = (
        db.query(DeliveryBatch)
        .options(
            joinedload(DeliveryBatch.stops),
            joinedload(DeliveryBatch.fulfillment_items),
            joinedload(DeliveryBatch.transporter),
            joinedload(DeliveryBatch.vehicle),
        )
        .filter(
            DeliveryBatch.status.in_([
                DeliveryBatchStatusEnum.BATCH_CREATED,
                DeliveryBatchStatusEnum.TRANSPORTER_ASSIGNED,
            ]),
            DeliveryBatch.total_quantity_kg <= profile.vehicle.capacity_kg,
        )
        .filter(
            (DeliveryBatch.assigned_transporter_id.is_(None)) |
            (DeliveryBatch.assigned_transporter_id == profile.id)
        )
        .order_by(DeliveryBatch.created_at.desc())
        .all()
    )
    from app.logistics.vehicle_rules import evaluate_vehicle_for_batch, is_bike_vehicle
    eligible_batches = []
    for b in batches:
        w = float(b.total_quantity_kg)
        if w <= 50.0 and not is_bike_vehicle(profile.vehicle):
            continue
        if w > 50.0 and is_bike_vehicle(profile.vehicle):
            continue
        if evaluate_vehicle_for_batch(profile.vehicle, b.total_quantity_kg)[0]:
            eligible_batches.append(b)
    return eligible_batches


@router.get("/mine", response_model=List[DeliveryBatchOut])
def get_my_batches(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(RoleEnum.transporter)),
):
    """Returns all delivery batches assigned to or accepted by the logged-in transporter."""
    profile = user.transporter_profile
    if not profile:
        return []

    batches = (
        db.query(DeliveryBatch)
        .options(
            joinedload(DeliveryBatch.stops),
            joinedload(DeliveryBatch.fulfillment_items),
            joinedload(DeliveryBatch.transporter),
            joinedload(DeliveryBatch.vehicle),
        )
        .filter(DeliveryBatch.assigned_transporter_id == profile.id)
        .order_by(DeliveryBatch.created_at.desc())
        .all()
    )
    return batches


@router.get("/admin/stats", response_model=BatchAdminStatsOut)
def admin_batch_stats(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(RoleEnum.admin)),
):
    """Real database metrics for logistics, batches, and transporter allocations."""
    return get_batch_admin_stats(db)


@router.get("/{batch_id}", response_model=DeliveryBatchOut)
def get_batch_detail(
    batch_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Fetches details of a specific delivery batch including stops and items."""
    batch = (
        db.query(DeliveryBatch)
        .options(
            joinedload(DeliveryBatch.stops),
            joinedload(DeliveryBatch.fulfillment_items),
            joinedload(DeliveryBatch.transporter),
            joinedload(DeliveryBatch.vehicle),
        )
        .filter(DeliveryBatch.id == batch_id)
        .first()
    )
    if not batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery batch not found")
    return batch


@router.post("/{batch_id}/accept", response_model=DeliveryBatchOut)
def accept_batch(
    batch_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(RoleEnum.transporter)),
):
    """
    Transporter claims a delivery batch.
    Uses database row locking to guarantee race-condition free acceptance.
    """
    profile = user.transporter_profile
    if not profile:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No transporter profile found")

    return accept_delivery_batch(db, batch_id, profile)


@router.put("/{batch_id}/status", response_model=DeliveryBatchOut)
def progress_batch_status(
    batch_id: int,
    new_status: DeliveryBatchStatusEnum,
    force: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(RoleEnum.transporter, RoleEnum.admin)),
):
    """Progresses batch along: ACCEPTED -> READY_FOR_PICKUP -> PICKED_UP -> IN_TRANSIT -> OUT_FOR_DELIVERY -> DELIVERED."""
    is_admin = user.role == RoleEnum.admin
    profile = user.transporter_profile
    return update_batch_status(db, batch_id, new_status, transporter=profile, is_admin=is_admin, force=force)

