"""
Realistic, Map-Based Transport Fee Calculation & Allocation Engine.

Enforces:
1. Actual road distance from Google Maps / OSRM routing (strict coordinate validation, no fake distances or Haversine fallbacks for fees).
2. Database-driven vehicle rates (VehicleRate table) with admin real-time editability.
3. Strict vehicle allocation rules:
   - Cargo <= 50 kg -> Bike (immediate dispatch, no 35% minimum fill requirement).
   - Cargo > 50 kg -> Truck (must meet >= 35% vehicle capacity fill, else HOLD_FOR_CONSOLIDATION).
4. Multi-warehouse pickup sequencing before customer dropoff with cumulative road distance.
5. Multi-customer fair route cost allocation (proportional to weight and distance, exact sum matching).
"""
import logging
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session

from app.models.models import VehicleRate, LogisticsSetting, Vehicle
from app.services.maps_service import (
    get_road_distance_and_duration,
    get_route_toll_charges,
    optimize_multi_pickup_delivery_order,
)
from app.core.constants import (
    DISTRICT_WAREHOUSES,
    TENKASI_WAREHOUSE_COORDINATES,
    TIRUNELVELI_WAREHOUSE_COORDINATES,
    THOOTHUKUDI_WAREHOUSE_COORDINATES,
)

logger = logging.getLogger(__name__)

# Fallback in-memory defaults if DB table is unseeded
DEFAULT_RATES = {
    "BIKE": {
        "base_fare": Decimal("30.00"),
        "rate_per_km": Decimal("8.00"),
        "minimum_fare": Decimal("40.00"),
        "loading_unloading_charge": Decimal("0.00"),
        "waiting_charge_per_hour": Decimal("0.00"),
    },
    "MINI_TRUCK": {
        "base_fare": Decimal("150.00"),
        "rate_per_km": Decimal("18.00"),
        "minimum_fare": Decimal("200.00"),
        "loading_unloading_charge": Decimal("50.00"),
        "waiting_charge_per_hour": Decimal("100.00"),
    },
    "TRUCK": {
        "base_fare": Decimal("300.00"),
        "rate_per_km": Decimal("25.00"),
        "minimum_fare": Decimal("350.00"),
        "loading_unloading_charge": Decimal("100.00"),
        "waiting_charge_per_hour": Decimal("150.00"),
    },
}

BIKE_MAX_CAPACITY_KG = 50.0
DEFAULT_TRUCK_MIN_FILL_PCT = 35.0


def _to_decimal(val: Any) -> Decimal:
    if val is None:
        return Decimal("0.00")
    return Decimal(str(val)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def get_vehicle_rate(db: Optional[Session], vehicle_type: str) -> Dict[str, Decimal]:
    """
    Fetches the current active pricing rate for a vehicle type from the database.
    Normalizes vehicle_type (e.g. 'BIKE', 'bike', 'two-wheeler' -> 'BIKE').
    """
    v_norm = (vehicle_type or "TRUCK").upper()
    if any(k in v_norm for k in ("BIKE", "TWO", "SCOOTER", "MOTORCYCLE")):
        lookup_key = "BIKE"
    elif any(k in v_norm for k in ("MINI", "TEMPO", "PICKUP")):
        lookup_key = "MINI_TRUCK"
    else:
        lookup_key = "TRUCK"

    if db is not None:
        try:
            rate = db.query(VehicleRate).filter(
                VehicleRate.vehicle_type == lookup_key,
                VehicleRate.active == True,
            ).first()
            if rate:
                return {
                    "vehicle_type": lookup_key,
                    "base_fare": _to_decimal(rate.base_fare),
                    "rate_per_km": _to_decimal(rate.rate_per_km),
                    "minimum_fare": _to_decimal(rate.minimum_fare),
                    "loading_unloading_charge": _to_decimal(rate.loading_unloading_charge),
                    "waiting_charge_per_hour": _to_decimal(rate.waiting_charge_per_hour),
                }
        except Exception as e:
            logger.warning(f"Could not read vehicle rate from DB: {e}")

    # Fallback to defaults
    fb = DEFAULT_RATES.get(lookup_key, DEFAULT_RATES["TRUCK"])
    return {
        "vehicle_type": lookup_key,
        "base_fare": fb["base_fare"],
        "rate_per_km": fb["rate_per_km"],
        "minimum_fare": fb["minimum_fare"],
        "loading_unloading_charge": fb["loading_unloading_charge"],
        "waiting_charge_per_hour": fb["waiting_charge_per_hour"],
    }


def select_vehicle_type(cargo_weight_kg: float | Decimal) -> str:
    """
    Selects vehicle category based on cargo weight:
    - Weight <= 50 kg -> BIKE
    - Weight > 50 kg and <= 1500 kg -> MINI_TRUCK
    - Weight > 1500 kg -> TRUCK
    """
    w = float(cargo_weight_kg or 0.0)
    if w <= BIKE_MAX_CAPACITY_KG:
        return "BIKE"
    if w <= 1500.0:
        return "MINI_TRUCK"
    return "TRUCK"


def evaluate_dispatch_readiness(
    cargo_weight_kg: float | Decimal,
    vehicle_capacity_kg: float | Decimal,
    vehicle_type: Optional[str] = None,
    min_fill_pct: float = DEFAULT_TRUCK_MIN_FILL_PCT,
) -> Dict[str, Any]:
    """
    Evaluates vehicle dispatch readiness according to strict business rules:
    - BIKE (cargo <= 50 kg): immediate dispatch allowed, no 35% minimum fill requirement.
    - TRUCK (cargo > 50 kg): requires cargo >= 35% vehicle capacity.
      If < 35%, status is HOLD_FOR_CONSOLIDATION.
    - Capacity limit: cargo must never exceed vehicle capacity.
    """
    w = round(float(cargo_weight_kg or 0.0), 2)
    cap = round(float(vehicle_capacity_kg or 0.0), 2)
    vtype = (vehicle_type or select_vehicle_type(w)).upper()

    is_bike = any(k in vtype for k in ("BIKE", "TWO", "SCOOTER")) or (w <= BIKE_MAX_CAPACITY_KG and cap <= BIKE_MAX_CAPACITY_KG)

    # 1. BIKE RULE
    if is_bike:
        if w > BIKE_MAX_CAPACITY_KG:
            return {
                "dispatch_status": "EXCEEDS_CAPACITY",
                "is_eligible": False,
                "reason": f"Cargo weight ({w} kg) exceeds Bike max capacity ({BIKE_MAX_CAPACITY_KG} kg). Truck required.",
                "fill_percentage": round((w / cap) * 100, 1) if cap > 0 else 100.0,
                "vehicle_type": "BIKE",
            }
        if cap > 0 and w > cap:
            return {
                "dispatch_status": "EXCEEDS_CAPACITY",
                "is_eligible": False,
                "reason": f"Cargo weight ({w} kg) exceeds bike registered capacity ({cap} kg).",
                "fill_percentage": round((w / cap) * 100, 1),
                "vehicle_type": "BIKE",
            }
        fill_pct = round((w / cap) * 100, 1) if cap > 0 else 100.0
        return {
            "dispatch_status": "DISPATCH_READY",
            "is_eligible": True,
            "reason": "Eligible bike for immediate dispatch (no minimum fill requirement).",
            "fill_percentage": fill_pct,
            "vehicle_type": "BIKE",
        }

    # 2. TRUCK RULE (cargo > 50 kg)
    if w <= BIKE_MAX_CAPACITY_KG:
        return {
            "dispatch_status": "INEFFICIENT_VEHICLE",
            "is_eligible": False,
            "reason": f"Cargo weight ({w} kg) is <= 50 kg. A bike must be used instead of a truck.",
            "fill_percentage": round((w / cap) * 100, 1) if cap > 0 else 0.0,
            "vehicle_type": vtype,
        }

    if cap > 0 and w > cap:
        return {
            "dispatch_status": "EXCEEDS_CAPACITY",
            "is_eligible": False,
            "reason": f"Cargo weight ({w} kg) exceeds vehicle capacity ({cap} kg). Never assign overloaded vehicles.",
            "fill_percentage": round((w / cap) * 100, 1),
            "vehicle_type": vtype,
        }

    fill_pct = round((w / cap) * 100, 1) if cap > 0 else 100.0
    min_required_weight = round(cap * (min_fill_pct / 100.0), 2)

    if w < min_required_weight:
        return {
            "dispatch_status": "HOLD_FOR_CONSOLIDATION",
            "is_eligible": False,
            "reason": (
                f"Cargo weight ({w} kg) is below {min_fill_pct}% minimum dispatch threshold "
                f"({min_required_weight} kg for {cap} kg vehicle; current fill: {fill_pct}%). "
                f"Hold batch to combine with compatible orders."
            ),
            "fill_percentage": fill_pct,
            "vehicle_type": vtype,
            "min_required_weight_kg": min_required_weight,
        }

    return {
        "dispatch_status": "DISPATCH_READY",
        "is_eligible": True,
        "reason": f"Eligible truck (reaches {fill_pct}% capacity, exceeding {min_fill_pct}% threshold).",
        "fill_percentage": fill_pct,
        "vehicle_type": vtype,
        "min_required_weight_kg": min_required_weight,
    }


def calculate_transport_fee(
    db: Optional[Session],
    road_distance_km: float | Decimal,
    vehicle_type: str,
    toll: float | Decimal = 0.0,
    loading_unloading: Optional[float | Decimal] = None,
    waiting_hours: float | Decimal = 0.0,
) -> Dict[str, Any]:
    """
    Deterministic Transport Fee Formula:
    Transport Fee = max(Minimum Fare, Base Fare + (Actual Road Distance * Rate/KM) + Toll + Loading/Unloading + Waiting)

    Returns a detailed breakdown dictionary with all amounts rounded to 2 decimal places.
    """
    rates = get_vehicle_rate(db, vehicle_type)
    d_km = _to_decimal(road_distance_km)
    toll_fee = _to_decimal(toll)
    waiting_h = _to_decimal(waiting_hours)

    base_fare = rates["base_fare"]
    rate_km = rates["rate_per_km"]
    min_fare = rates["minimum_fare"]

    # Loading/unloading defaults to vehicle rate setting if not overridden
    if loading_unloading is not None:
        load_charge = _to_decimal(loading_unloading)
    else:
        load_charge = rates["loading_unloading_charge"]

    waiting_charge = _to_decimal(waiting_h * rates["waiting_charge_per_hour"])
    distance_fare = _to_decimal(d_km * rate_km)

    subtotal = base_fare + distance_fare + toll_fee + load_charge + waiting_charge
    total_fee = max(min_fare, subtotal)
    is_min_fare_applied = (subtotal < min_fare)

    return {
        "vehicle_type": rates["vehicle_type"],
        "road_distance_km": float(d_km),
        "base_fare": float(base_fare),
        "rate_per_km": float(rate_km),
        "distance_fare": float(distance_fare),
        "toll_charges": float(toll_fee),
        "loading_unloading_charge": float(load_charge),
        "waiting_charge": float(waiting_charge),
        "subtotal": float(subtotal),
        "minimum_fare": float(min_fare),
        "is_minimum_fare_applied": is_min_fare_applied,
        "total_fee": float(total_fee),
    }


def calculate_order_transport_fee(
    db: Optional[Session],
    pickup_lat: float | None,
    pickup_lon: float | None,
    delivery_lat: float | None,
    delivery_lon: float | None,
    cargo_weight_kg: float | Decimal,
    loading_unloading: Optional[float | Decimal] = None,
    waiting_hours: float | Decimal = 0.0,
) -> Dict[str, Any]:
    """
    Calculates transport fee for a single-pickup, single-dropoff route using actual road distance.
    Strictly validates coordinates.
    """
    if pickup_lat is None or pickup_lon is None or delivery_lat is None or delivery_lon is None:
        raise ValueError("Pickup and delivery coordinates (latitude and longitude) are strictly required for road transport fee calculation.")

    # Fetch actual road distance and duration (strict mode raises on missing values)
    road_km, duration_mins = get_road_distance_and_duration(
        pickup_lat, pickup_lon, delivery_lat, delivery_lon, strict=True
    )

    # Fetch actual toll charge from map API (or 0.0)
    toll = get_route_toll_charges(pickup_lat, pickup_lon, delivery_lat, delivery_lon)

    # Select vehicle type by weight
    vtype = select_vehicle_type(cargo_weight_kg)

    fee_breakdown = calculate_transport_fee(
        db=db,
        road_distance_km=road_km,
        vehicle_type=vtype,
        toll=toll,
        loading_unloading=loading_unloading,
        waiting_hours=waiting_hours,
    )
    fee_breakdown["estimated_duration_minutes"] = duration_mins
    fee_breakdown["cargo_weight_kg"] = float(cargo_weight_kg)
    return fee_breakdown


def calculate_multi_warehouse_order_fee(
    db: Optional[Session],
    warehouse_coords: List[Tuple[float, float, str]],  # [(lat, lon, name), ...]
    delivery_lat: float,
    delivery_lon: float,
    cargo_weight_kg: float | Decimal,
    delivery_label: str = "Customer Delivery",
) -> Dict[str, Any]:
    """
    Calculates transport fee for an order fulfilled across multiple regional warehouses
    (Tenkasi, Tirunelveli, Thoothukudi).

    Pickups must all be sequenced before customer dropoff.
    Evaluates optimal driving sequence using actual road distances.
    """
    if delivery_lat is None or delivery_lon is None:
        raise ValueError("Delivery coordinates (latitude and longitude) are strictly required.")
    if not warehouse_coords:
        raise ValueError("At least one pickup warehouse location is required.")

    pickup_stops = [
        {"latitude": float(w[0]), "longitude": float(w[1]), "name": w[2], "type": "PICKUP"}
        for w in warehouse_coords
    ]
    delivery_stops = [
        {"latitude": float(delivery_lat), "longitude": float(delivery_lon), "name": delivery_label, "type": "DELIVERY"}
    ]

    # Optimize sequence so all pickups are completed before delivery
    best_route, _ = optimize_multi_pickup_delivery_order(pickup_stops, delivery_stops)

    # Compute exact cumulative road distance along sequential stops
    total_road_km = 0.0
    total_duration_mins = 0
    total_tolls = 0.0

    for i in range(len(best_route) - 1):
        p1 = best_route[i]
        p2 = best_route[i + 1]
        leg_km, leg_mins = get_road_distance_and_duration(
            p1["latitude"], p1["longitude"], p2["latitude"], p2["longitude"], strict=True
        )
        total_road_km += leg_km
        total_duration_mins += leg_mins
        leg_toll = get_route_toll_charges(p1["latitude"], p1["longitude"], p2["latitude"], p2["longitude"])
        total_tolls += leg_toll

    total_road_km = round(total_road_km, 2)
    vtype = select_vehicle_type(cargo_weight_kg)

    # Multi-warehouse order loading charge: 1 per warehouse stop
    rates = get_vehicle_rate(db, vtype)
    num_warehouses = len(warehouse_coords)
    loading_charge = float(rates["loading_unloading_charge"]) * num_warehouses

    fee_breakdown = calculate_transport_fee(
        db=db,
        road_distance_km=total_road_km,
        vehicle_type=vtype,
        toll=total_tolls,
        loading_unloading=loading_charge,
        waiting_hours=0.0,
    )

    fee_breakdown["estimated_duration_minutes"] = total_duration_mins
    fee_breakdown["cargo_weight_kg"] = float(cargo_weight_kg)
    fee_breakdown["route_stops"] = best_route
    return fee_breakdown


def allocate_multi_customer_route_costs(
    total_route_cost: float | Decimal,
    shipments: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    Fair Multi-Customer Route Cost Allocation Formula:
    When a consolidated batch delivers to multiple customers, total route cost is calculated once
    and allocated fairly among shipments based on weight and distance contribution.

    For shipment i:
        K_i = weight_kg_i * max(1.0, direct_road_distance_km_i)
        share_i = K_i / sum(K_j)
        allocated_fee_i = round(total_route_cost * share_i, 2)

    Discrepancy Balancing:
    Any minor rounding difference (1-2 paise) is added to or subtracted from the largest
    shipment's share so that:
        sum(allocated_fee_i) == total_route_cost

    Constraints:
    - If len(shipments) > 1, no customer is charged the full vehicle trip cost.
    - Sum of customer fees exactly equals total route cost.
    """
    if not shipments:
        return []

    c_total = _to_decimal(total_route_cost)
    if len(shipments) == 1:
        s = dict(shipments[0])
        s["allocated_fee"] = float(c_total)
        s["allocation_share_pct"] = 100.0
        return [s]

    factors: List[Decimal] = []
    for s in shipments:
        w = max(Decimal("0.1"), _to_decimal(s.get("weight_kg", 1.0)))
        d = max(Decimal("1.0"), _to_decimal(s.get("direct_road_distance_km", 1.0)))
        factors.append(w * d)

    sum_factors = sum(factors)
    if sum_factors <= 0:
        sum_factors = Decimal(str(len(shipments)))
        factors = [Decimal("1.0") for _ in shipments]

    allocated_shipments = []
    running_sum = Decimal("0.00")
    largest_idx = 0
    max_share = Decimal("-1.0")

    for idx, s in enumerate(shipments):
        item = dict(s)
        share = factors[idx] / sum_factors
        if share > max_share:
            max_share = share
            largest_idx = idx

        item_fee = (c_total * share).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        item["allocated_fee"] = item_fee
        item["allocation_share_pct"] = round(float(share * Decimal("100")), 2)
        running_sum += item_fee
        allocated_shipments.append(item)

    # Balance any rounding difference onto the largest contributor
    rounding_diff = c_total - running_sum
    if rounding_diff != Decimal("0.00"):
        allocated_shipments[largest_idx]["allocated_fee"] += rounding_diff
        allocated_shipments[largest_idx]["allocated_fee"] = allocated_shipments[largest_idx]["allocated_fee"].quantize(
            Decimal("0.01")
        )

    # Convert Decimal values to float for JSON compatibility
    for s in allocated_shipments:
        s["allocated_fee"] = float(s["allocated_fee"])

    return allocated_shipments

