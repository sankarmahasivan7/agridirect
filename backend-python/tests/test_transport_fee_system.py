"""
Automated Test Suite for AgriDirect-AI Realistic Map-Based Transport Fee Calculation System.

Tests all 14 Core Functional Requirements:
1. Single warehouse order fee calculation (road distance * rate + base fare)
2. Minimum fare enforcement
3. Bike allocation for <= 50 kg cargo
4. Bike immediate dispatch (no 35% minimum fill required)
5. Truck allocation for > 50 kg cargo
6. Truck 35% minimum fill threshold hold (HOLD_FOR_CONSOLIDATION when < 35%)
7. Truck dispatch eligibility when fill >= 35%
8. Cargo exceeding vehicle capacity rejected (EXCEEDS_CAPACITY)
9. Multi-warehouse order pickup sequencing (all pickups before dropoff)
10. Multi-warehouse route distance calculation (cumulative road distance)
11. Multi-customer route cost allocation (fair split, sum equals total)
12. Admin rate update reflection in subsequent fee calculations
13. Missing coordinates validation error (strict error, no fake fallback)
14. Toll fee inclusion (exact API toll added or 0, no fabricated values)
"""
import sys
from pathlib import Path
from decimal import Decimal
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.db.session import Base
from app.models.models import VehicleRate, LogisticsSetting
from app.services.transport_fee_calculator import (
    calculate_transport_fee,
    calculate_order_transport_fee,
    calculate_multi_warehouse_order_fee,
    select_vehicle_type,
    evaluate_dispatch_readiness,
    allocate_multi_customer_route_costs,
    get_vehicle_rate,
)
from app.core.constants import (
    TENKASI_WAREHOUSE_COORDINATES,
    TIRUNELVELI_WAREHOUSE_COORDINATES,
    THOOTHUKUDI_WAREHOUSE_COORDINATES,
)


@pytest.fixture(scope="module")
def test_db():
    """In-memory SQLite test database with seeded rates and settings."""
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()

    # Seed initial test vehicle rates
    rates = [
        VehicleRate(
            vehicle_type="BIKE",
            base_fare=30.00,
            rate_per_km=8.00,
            minimum_fare=40.00,
            loading_unloading_charge=0.00,
            waiting_charge_per_hour=0.00,
            active=True,
        ),
        VehicleRate(
            vehicle_type="MINI_TRUCK",
            base_fare=150.00,
            rate_per_km=18.00,
            minimum_fare=200.00,
            loading_unloading_charge=50.00,
            waiting_charge_per_hour=100.00,
            active=True,
        ),
        VehicleRate(
            vehicle_type="TRUCK",
            base_fare=300.00,
            rate_per_km=25.00,
            minimum_fare=350.00,
            loading_unloading_charge=100.00,
            waiting_charge_per_hour=150.00,
            active=True,
        ),
    ]
    db.add_all(rates)

    settings = [
        LogisticsSetting(setting_key="truck_min_fill_pct", setting_value="35.0"),
        LogisticsSetting(setting_key="bike_max_capacity_kg", setting_value="50.0"),
    ]
    db.add_all(settings)
    db.commit()

    yield db

    db.close()


# ---------------------------------------------------------------------------
# Test 1: Single warehouse order fee calculation
# Formula: Base Fare + (Actual Road Distance * Rate/KM) + Toll + Loading + Waiting
# ---------------------------------------------------------------------------
def test_1_single_warehouse_order_fee_calculation(test_db):
    road_km = 20.0
    fee = calculate_transport_fee(
        db=test_db,
        road_distance_km=road_km,
        vehicle_type="BIKE",
        toll=0.0,
        loading_unloading=0.0,
        waiting_hours=0.0,
    )
    # BIKE: base ₹30 + (20 km * ₹8) = ₹190.00
    assert fee["vehicle_type"] == "BIKE"
    assert fee["base_fare"] == 30.00
    assert fee["rate_per_km"] == 8.00
    assert fee["road_distance_km"] == 20.0
    assert fee["distance_fare"] == 160.00
    assert fee["total_fee"] == 190.00
    assert not fee["is_minimum_fare_applied"]


# ---------------------------------------------------------------------------
# Test 2: Minimum fare enforcement
# When subtotal < minimum fare, fee must equal minimum fare
# ---------------------------------------------------------------------------
def test_2_minimum_fare_enforcement(test_db):
    # Very short trip: 0.5 km on BIKE -> ₹30 base + (0.5 * ₹8 = ₹4) = ₹34 subtotal
    # Minimum fare for BIKE is ₹40.00
    fee = calculate_transport_fee(
        db=test_db,
        road_distance_km=0.5,
        vehicle_type="BIKE",
        toll=0.0,
    )
    assert fee["subtotal"] == 34.00
    assert fee["minimum_fare"] == 40.00
    assert fee["total_fee"] == 40.00
    assert fee["is_minimum_fare_applied"] is True


# ---------------------------------------------------------------------------
# Test 3: Bike allocation for <= 50 kg cargo
# ---------------------------------------------------------------------------
def test_3_bike_allocation_for_small_cargo():
    assert select_vehicle_type(5.0) == "BIKE"
    assert select_vehicle_type(15.0) == "BIKE"
    assert select_vehicle_type(50.0) == "BIKE"


# ---------------------------------------------------------------------------
# Test 4: Bike immediate dispatch (no 35% minimum fill requirement)
# Bikes dispatch immediately even for 5 kg, 15 kg, 30 kg
# ---------------------------------------------------------------------------
def test_4_bike_immediate_dispatch():
    # 10 kg on a 50 kg capacity bike (only 20% fill)
    res = evaluate_dispatch_readiness(
        cargo_weight_kg=10.0,
        vehicle_capacity_kg=50.0,
        vehicle_type="BIKE",
    )
    assert res["is_eligible"] is True
    assert res["dispatch_status"] == "DISPATCH_READY"
    assert "no minimum fill requirement" in res["reason"].lower()


# ---------------------------------------------------------------------------
# Test 5: Truck allocation for > 50 kg cargo
# ---------------------------------------------------------------------------
def test_5_truck_allocation_for_large_cargo():
    assert select_vehicle_type(50.1) in ("MINI_TRUCK", "TRUCK")
    assert select_vehicle_type(200.0) in ("MINI_TRUCK", "TRUCK")
    assert select_vehicle_type(2000.0) == "TRUCK"


# ---------------------------------------------------------------------------
# Test 6: Truck 35% minimum fill threshold hold
# When load < 35% of capacity, hold for consolidation
# ---------------------------------------------------------------------------
def test_6_truck_35_percent_minimum_fill_threshold_hold():
    # 500 kg truck with 100 kg cargo = 20% fill (< 35% min threshold of 175 kg)
    res = evaluate_dispatch_readiness(
        cargo_weight_kg=100.0,
        vehicle_capacity_kg=500.0,
        vehicle_type="MINI_TRUCK",
        min_fill_pct=35.0,
    )
    assert res["is_eligible"] is False
    assert res["dispatch_status"] == "HOLD_FOR_CONSOLIDATION"
    assert res["fill_percentage"] == 20.0
    assert res["min_required_weight_kg"] == 175.0


# ---------------------------------------------------------------------------
# Test 7: Truck dispatch eligibility when fill >= 35%
# ---------------------------------------------------------------------------
def test_7_truck_dispatch_eligibility_when_fill_reaches_threshold():
    # 500 kg truck with 180 kg cargo = 36% fill (>= 35% min threshold)
    res = evaluate_dispatch_readiness(
        cargo_weight_kg=180.0,
        vehicle_capacity_kg=500.0,
        vehicle_type="MINI_TRUCK",
        min_fill_pct=35.0,
    )
    assert res["is_eligible"] is True
    assert res["dispatch_status"] == "DISPATCH_READY"
    assert res["fill_percentage"] == 36.0


# ---------------------------------------------------------------------------
# Test 8: Cargo exceeding vehicle capacity rejected
# Never overload a vehicle
# ---------------------------------------------------------------------------
def test_8_cargo_exceeding_vehicle_capacity_rejected():
    # 500 kg truck given 550 kg load
    res = evaluate_dispatch_readiness(
        cargo_weight_kg=550.0,
        vehicle_capacity_kg=500.0,
        vehicle_type="MINI_TRUCK",
    )
    assert res["is_eligible"] is False
    assert res["dispatch_status"] == "EXCEEDS_CAPACITY"

    # 60 kg load given to 50 kg bike
    res_bike = evaluate_dispatch_readiness(
        cargo_weight_kg=60.0,
        vehicle_capacity_kg=50.0,
        vehicle_type="BIKE",
    )
    assert res_bike["is_eligible"] is False
    assert res_bike["dispatch_status"] == "EXCEEDS_CAPACITY"


# ---------------------------------------------------------------------------
# Test 9: Multi-warehouse order pickup sequencing
# All warehouse pickups must occur before the customer dropoff
# ---------------------------------------------------------------------------
def test_9_multi_warehouse_order_pickup_sequencing(test_db):
    warehouses = [
        (TENKASI_WAREHOUSE_COORDINATES[0], TENKASI_WAREHOUSE_COORDINATES[1], "Tenkasi Central Agri-Warehouse"),
        (TIRUNELVELI_WAREHOUSE_COORDINATES[0], TIRUNELVELI_WAREHOUSE_COORDINATES[1], "Tirunelveli Central Agri-Warehouse"),
    ]
    # Customer in Surandai
    cust_lat, cust_lon = 8.9774, 77.4262

    fee = calculate_multi_warehouse_order_fee(
        db=test_db,
        warehouse_coords=warehouses,
        delivery_lat=cust_lat,
        delivery_lon=cust_lon,
        cargo_weight_kg=120.0,
        delivery_label="Surandai Customer",
    )
    stops = fee["route_stops"]
    assert len(stops) == 3

    # First two stops must be pickups, last stop must be delivery
    assert stops[0]["type"] == "PICKUP"
    assert stops[1]["type"] == "PICKUP"
    assert stops[2]["type"] == "DELIVERY"
    assert stops[2]["name"] == "Surandai Customer"


# ---------------------------------------------------------------------------
# Test 10: Multi-warehouse route distance calculation
# Cumulative road distance sums all sequential legs
# ---------------------------------------------------------------------------
def test_10_multi_warehouse_route_distance_calculation(test_db):
    warehouses = [
        (TENKASI_WAREHOUSE_COORDINATES[0], TENKASI_WAREHOUSE_COORDINATES[1], "Tenkasi Central Agri-Warehouse"),
        (TIRUNELVELI_WAREHOUSE_COORDINATES[0], TIRUNELVELI_WAREHOUSE_COORDINATES[1], "Tirunelveli Central Agri-Warehouse"),
    ]
    cust_lat, cust_lon = 8.9774, 77.4262

    fee = calculate_multi_warehouse_order_fee(
        db=test_db,
        warehouse_coords=warehouses,
        delivery_lat=cust_lat,
        delivery_lon=cust_lon,
        cargo_weight_kg=120.0,
    )
    # Distance across Tenkasi <-> Tirunelveli <-> Surandai is > 40 km
    assert fee["road_distance_km"] > 40.0
    assert fee["total_fee"] > 0
    assert fee["vehicle_type"] == "MINI_TRUCK"


# ---------------------------------------------------------------------------
# Test 11: Multi-customer route cost allocation
# Cost split fairly based on weight and distance, sum matches total route cost
# ---------------------------------------------------------------------------
def test_11_multi_customer_route_cost_allocation():
    total_batch_cost = Decimal("600.00")
    shipments = [
        {"order_id": 101, "weight_kg": 50.0, "direct_road_distance_km": 10.0},
        {"order_id": 102, "weight_kg": 100.0, "direct_road_distance_km": 20.0},
        {"order_id": 103, "weight_kg": 150.0, "direct_road_distance_km": 30.0},
    ]

    allocated = allocate_multi_customer_route_costs(
        total_route_cost=total_batch_cost,
        shipments=shipments,
    )
    assert len(allocated) == 3

    # No customer should be charged full ₹600.00
    for s in allocated:
        assert s["allocated_fee"] < 600.00
        assert s["allocated_fee"] > 0.00

    # Heavier/further shipment pays more: fee(103) > fee(102) > fee(101)
    fees = [s["allocated_fee"] for s in allocated]
    assert fees[2] > fees[1] > fees[0]

    # Sum of customer fees must match total route cost exactly (₹600.00)
    total_allocated = sum(s["allocated_fee"] for s in allocated)
    assert round(total_allocated, 2) == 600.00


# ---------------------------------------------------------------------------
# Test 12: Admin rate update reflection in subsequent fee calculations
# Dynamic database updates immediately change pricing without code changes
# ---------------------------------------------------------------------------
def test_12_admin_rate_update_reflection(test_db):
    # Fetch rate before update
    rate_before = get_vehicle_rate(test_db, "BIKE")
    assert rate_before["rate_per_km"] == Decimal("8.00")

    fee_before = calculate_transport_fee(
        db=test_db,
        road_distance_km=25.0,
        vehicle_type="BIKE",
    )
    # Before: ₹30 + (25 * ₹8) = ₹230.00
    assert fee_before["total_fee"] == 230.00

    # Admin updates rate in database: rate_per_km changed from 8.00 to 12.00
    bike_row = test_db.query(VehicleRate).filter(VehicleRate.vehicle_type == "BIKE").first()
    bike_row.rate_per_km = 12.00
    test_db.commit()

    # Subsequent calculation must immediately reflect new rate
    fee_after = calculate_transport_fee(
        db=test_db,
        road_distance_km=25.0,
        vehicle_type="BIKE",
    )
    # After: ₹30 + (25 * ₹12) = ₹330.00
    assert fee_after["rate_per_km"] == 12.00
    assert fee_after["total_fee"] == 330.00

    # Revert back to 8.00 for other tests
    bike_row.rate_per_km = 8.00
    test_db.commit()


# ---------------------------------------------------------------------------
# Test 13: Missing coordinates validation error
# Strict error raised when coordinates are missing, no mock fallback
# ---------------------------------------------------------------------------
def test_13_missing_coordinates_validation_error(test_db):
    # Missing delivery latitude
    with pytest.raises(ValueError, match=r"(?i)coordinates"):
        calculate_order_transport_fee(
            db=test_db,
            pickup_lat=8.9594,
            pickup_lon=77.3167,
            delivery_lat=None,
            delivery_lon=77.4262,
            cargo_weight_kg=25.0,
        )

    # Missing pickup longitude
    with pytest.raises(ValueError, match=r"(?i)coordinates"):
        calculate_order_transport_fee(
            db=test_db,
            pickup_lat=8.9594,
            pickup_lon=None,
            delivery_lat=8.9774,
            delivery_lon=77.4262,
            cargo_weight_kg=25.0,
        )


# ---------------------------------------------------------------------------
# Test 14: Toll fee inclusion
# Tolls added to subtotal without fabrication
# ---------------------------------------------------------------------------
def test_14_toll_fee_inclusion(test_db):
    # Zero toll
    fee_no_toll = calculate_transport_fee(
        db=test_db,
        road_distance_km=10.0,
        vehicle_type="BIKE",
        toll=0.0,
    )
    assert fee_no_toll["toll_charges"] == 0.0
    assert fee_no_toll["total_fee"] == 110.00  # ₹30 + (10 * ₹8)

    # Exact API toll charge of ₹85.00
    fee_with_toll = calculate_transport_fee(
        db=test_db,
        road_distance_km=10.0,
        vehicle_type="BIKE",
        toll=85.00,
    )
    assert fee_with_toll["toll_charges"] == 85.00
    assert fee_with_toll["total_fee"] == 195.00  # ₹110 + ₹85
