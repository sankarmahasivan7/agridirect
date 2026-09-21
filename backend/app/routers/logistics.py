from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.deps import require_role
from app.models.models import User, RoleEnum, Order, OrderStatusEnum, OrderItem, VehicleRate, LogisticsSetting
from app.schemas.schemas import (
    VehicleRateRead,
    VehicleRateUpdate,
    LogisticsSettingRead,
    LogisticsSettingUpdate,
)
from app.logistics.optimizer import optimize_routes

router = APIRouter(prefix="/api/logistics", tags=["logistics"])


@router.post("/optimize")
def optimize(
    vehicle_capacity_kg: float = 1000.0,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(RoleEnum.fpo, RoleEnum.admin)),
):
    """
    Optimizes routes using ACTUAL pending/confirmed orders and their real
    delivery locations (spec section 25). If there is nothing to optimize,
    says so plainly instead of inventing a route.
    """
    orders = (
        db.query(Order)
        .filter(Order.status.in_([OrderStatusEnum.CONFIRMED, OrderStatusEnum.PROCESSING]))
        .all()
    )
    if not orders:
        return {"available": False, "message": "No active shipments available for optimization."}

    stops = []
    for order in orders:
        total_kg = sum(float(i.quantity) for i in order.items)
        stops.append({
            "order_id": order.id,
            "label": order.delivery_location or f"Order #{order.id}",
            "demand_kg": total_kg,
        })

    result = optimize_routes(stops, vehicle_capacity_kg=vehicle_capacity_kg)
    return {"available": True, "vehicle_capacity_kg": vehicle_capacity_kg, "routes": result}


# ==========================================
# Vehicle Pricing Rates (Database-Driven)
# ==========================================

@router.get("/rates", response_model=List[VehicleRateRead])
def get_vehicle_rates(db: Session = Depends(get_db)):
    """Fetches all vehicle pricing rates from the database."""
    rates = db.query(VehicleRate).order_by(VehicleRate.id.asc()).all()
    return rates


@router.get("/rates/{rate_id}", response_model=VehicleRateRead)
def get_vehicle_rate_by_id(rate_id: int, db: Session = Depends(get_db)):
    rate = db.query(VehicleRate).filter(VehicleRate.id == rate_id).first()
    if not rate:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Vehicle rate #{rate_id} not found")
    return rate


@router.put("/rates/{rate_id}", response_model=VehicleRateRead)
def update_vehicle_rate(
    rate_id: int,
    payload: VehicleRateUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(RoleEnum.admin)),
):
    """Admin updates vehicle pricing rates without changing code."""
    rate = db.query(VehicleRate).filter(VehicleRate.id == rate_id).first()
    if not rate:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Vehicle rate #{rate_id} not found")

    if payload.base_fare is not None:
        rate.base_fare = payload.base_fare
    if payload.rate_per_km is not None:
        rate.rate_per_km = payload.rate_per_km
    if payload.minimum_fare is not None:
        rate.minimum_fare = payload.minimum_fare
    if payload.loading_unloading_charge is not None:
        rate.loading_unloading_charge = payload.loading_unloading_charge
    if payload.waiting_charge_per_hour is not None:
        rate.waiting_charge_per_hour = payload.waiting_charge_per_hour
    if payload.active is not None:
        rate.active = payload.active

    rate.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(rate)
    return rate


# ==========================================
# Logistics Settings (Database-Driven)
# ==========================================

@router.get("/settings", response_model=List[LogisticsSettingRead])
def get_logistics_settings(db: Session = Depends(get_db)):
    """Fetches global logistics settings from the database."""
    return db.query(LogisticsSetting).order_by(LogisticsSetting.id.asc()).all()


@router.put("/settings/{setting_key}", response_model=LogisticsSettingRead)
def update_logistics_setting(
    setting_key: str,
    payload: LogisticsSettingUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(RoleEnum.admin)),
):
    """Admin updates global logistics setting."""
    setting = db.query(LogisticsSetting).filter(LogisticsSetting.setting_key == setting_key).first()
    if not setting:
        # Create if not found
        setting = LogisticsSetting(
            setting_key=setting_key,
            setting_value=payload.setting_value,
            description=payload.description or f"Configuration for {setting_key}",
        )
        db.add(setting)
    else:
        setting.setting_value = payload.setting_value
        if payload.description:
            setting.description = payload.description
        setting.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(setting)
    return setting

