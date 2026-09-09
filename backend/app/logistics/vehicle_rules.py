"""
Vehicle Selection and Dispatch Rules for AgriDirect Logistics.

Rules:
1. BIKE RULE:
   - Bike maximum capacity = 50 kg.
   - If delivery batch weight is 50 kg or less, assign an available suitable bike.
   - Bikes DO NOT have a 35% minimum-fill requirement.
   - A bike can be dispatched immediately even for small loads (5 kg, 15 kg, 30 kg, 50 kg).
   - If batch weight is greater than 50 kg, do not assign a bike.

2. TRUCK RULE:
   - Truck capacity comes from the actual vehicle/transporter database.
   - A truck can be dispatched only when its load reaches at least 35% of its actual capacity:
     minimum_dispatch_weight = truck_capacity * 0.35
     (e.g., 500 kg truck -> min dispatch = 175 kg; 300 kg truck -> min dispatch = 105 kg).
   - If the current batch is below 35% of the truck's capacity, DO NOT dispatch the truck.
     Keep the batch waiting and combine it with other compatible orders.
   - Once the batch reaches or exceeds 35%, allow truck allocation.

3. VEHICLE SELECTION:
   - Batch <= 50 kg -> Bike.
   - Batch > 50 kg -> Truck.
   - Never assign a vehicle whose capacity is lower than the batch weight.
   - Do not create a separate vehicle trip for every small customer order.
   - Combine compatible orders in the same delivery area before deciding the vehicle.
   - Real database values only.
"""
from decimal import Decimal
from typing import Optional, Tuple, Any

BIKE_MAX_CAPACITY_KG = 50.0
TRUCK_MIN_FILL_RATIO = 0.35

BIKE_KEYWORDS = ("bike", "two-wheeler", "2-wheeler", "motorcycle", "scooter", "two wheeler")
TRUCK_KEYWORDS = ("truck", "tempo", "van", "lorry", "trolley", "tractor", "pickup")


def is_bike_vehicle(vehicle: Any) -> bool:
    """Returns True if the vehicle is classified as a bike / two-wheeler."""
    if not vehicle:
        return False
    vtype = (getattr(vehicle, "vehicle_type", None) or "").lower()
    vname = (getattr(vehicle, "name", None) or "").lower()

    if any(k in vtype or k in vname for k in BIKE_KEYWORDS):
        return True

    # If capacity is <= 50 kg and not explicitly designated as a truck/tempo/van/lorry
    try:
        cap = float(vehicle.capacity_kg)
        if cap <= BIKE_MAX_CAPACITY_KG and not any(k in vtype or k in vname for k in TRUCK_KEYWORDS):
            return True
    except (TypeError, ValueError):
        pass

    return False


def is_truck_vehicle(vehicle: Any) -> bool:
    """Returns True if the vehicle is classified as a truck / commercial freight carrier."""
    if not vehicle:
        return False
    return not is_bike_vehicle(vehicle)


def get_vehicle_classification(vehicle: Any) -> str:
    """Returns 'Bike' or 'Truck' classification."""
    return "Bike" if is_bike_vehicle(vehicle) else "Truck"


def get_minimum_dispatch_weight(vehicle: Any) -> float:
    """
    Computes minimum dispatch weight:
    - Bike: 0.0 (no minimum fill requirement)
    - Truck: 35% of actual vehicle capacity
    """
    if not vehicle:
        return 0.0
    if is_bike_vehicle(vehicle):
        return 0.0
    cap = float(getattr(vehicle, "capacity_kg", 0) or 0)
    return round(cap * TRUCK_MIN_FILL_RATIO, 2)


def evaluate_vehicle_for_batch(vehicle: Any, cargo_weight_kg: float | Decimal) -> Tuple[bool, str]:
    """
    Evaluates whether the vehicle is eligible to carry a batch of weight cargo_weight_kg.
    Returns (is_eligible, reason_message).
    """
    if not vehicle:
        return False, "No vehicle specified"

    w = round(float(cargo_weight_kg), 2)
    cap = round(float(getattr(vehicle, "capacity_kg", 0) or 0), 2)

    if is_bike_vehicle(vehicle):
        # 1. BIKE RULE
        if w > BIKE_MAX_CAPACITY_KG:
            return False, (
                f"Batch weight ({w} kg) exceeds Bike maximum capacity (50 kg). "
                f"A truck is required for batches greater than 50 kg."
            )
        if w > cap:
            return False, f"Batch weight ({w} kg) exceeds bike registered capacity ({cap} kg)."
        # Bikes DO NOT have a 35% minimum-fill requirement; immediate dispatch even for small loads.
        return True, "Eligible bike (immediate dispatch, no minimum fill requirement)"

    # 2. TRUCK RULE
    if w <= BIKE_MAX_CAPACITY_KG:
        return False, (
            f"Batch weight ({w} kg) is 50 kg or less. "
            f"Bikes must be used for batches <= 50 kg. Do not force a truck when a bike can handle the batch."
        )

    if w > cap:
        return False, (
            f"Batch weight ({w} kg) exceeds truck capacity ({cap} kg). "
            f"Never assign a vehicle whose capacity is lower than the batch weight."
        )

    min_dispatch = round(cap * TRUCK_MIN_FILL_RATIO, 2)
    if w < min_dispatch:
        fill_pct = round((w / cap) * 100, 1) if cap > 0 else 0
        return False, (
            f"Batch weight ({w} kg) is below 35% minimum dispatch threshold ({min_dispatch} kg, current fill: {fill_pct}%) "
            f"for truck capacity ({cap} kg). Keep the batch waiting and combine it with other compatible orders."
        )

    return True, "Eligible truck (reaches >= 35% actual capacity requirement)"

