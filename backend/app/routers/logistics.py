from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.deps import require_role
from app.models.models import User, RoleEnum, Order, OrderStatusEnum, OrderItem
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
