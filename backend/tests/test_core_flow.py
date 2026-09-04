"""
Run with: pytest -q   (from backend/)
Uses an isolated in-memory SQLite DB, independent of your real .env DATABASE_URL.
"""
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.db.session import Base, get_db
from app.main import app

TEST_DB_URL = "sqlite:///:memory:"
engine = create_engine(
    TEST_DB_URL, connect_args={"check_same_thread": False}, poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


app.router.on_startup.clear()  # avoid touching the real DATABASE_URL during tests


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


def register_farmer(email="farmer@test.com", farm_latitude=None, farm_longitude=None):
    resp = client.post("/api/auth/register/farmer", json={
        "full_name": "Test Farmer", "phone": "9999999999", "email": email,
        "password": "password123", "village_town": "X", "district": "Y", "state": "TN",
        "farm_latitude": farm_latitude, "farm_longitude": farm_longitude,
    })
    assert resp.status_code == 201
    return resp.json()["access_token"]


def register_buyer(email="buyer@test.com", default_latitude=None, default_longitude=None):
    resp = client.post("/api/auth/register/buyer", json={
        "full_name": "Test Buyer", "buyer_type": "restaurant", "email": email,
        "phone": "8888888888", "password": "password123", "location": "Chennai",
        "default_latitude": default_latitude, "default_longitude": default_longitude,
    })
    assert resp.status_code == 201
    return resp.json()["access_token"]


def test_listing_values_are_returned_unchanged():
    """The single most important rule in the whole spec: no fake data injection."""
    token = register_farmer()
    resp = client.post(
        "/api/listings",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "product_name": "Tomato", "category_name": "Vegetables",
            "quantity_available": 500, "unit": "kg", "price_per_unit": 30,
            "quality_grade": "Grade A", "location": "Chennai",
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert float(data["quantity_available"]) == 500
    assert float(data["price_per_unit"]) == 30

    market_resp = client.get("/api/marketplace")
    assert market_resp.status_code == 200
    listings = market_resp.json()
    assert len(listings) == 1
    assert float(listings[0]["quantity_available"]) == 500
    assert float(listings[0]["price_per_unit"]) == 30


def test_empty_marketplace_returns_empty_list_not_fake_data():
    resp = client.get("/api/marketplace")
    assert resp.status_code == 200
    assert resp.json() == []


def test_overselling_is_rejected():
    farmer_token = register_farmer()
    listing_resp = client.post(
        "/api/listings",
        headers={"Authorization": f"Bearer {farmer_token}"},
        json={
            "product_name": "Tomato", "category_name": "Vegetables",
            "quantity_available": 500, "unit": "kg", "price_per_unit": 30,
        },
    )
    listing_id = listing_resp.json()["id"]

    buyer_token = register_buyer()
    order_resp = client.post(
        "/api/orders",
        headers={"Authorization": f"Bearer {buyer_token}"},
        json={"items": [{"listing_id": listing_id, "quantity": 600}], "delivery_location": "Chennai"},
    )
    assert order_resp.status_code == 400
    assert "500" in order_resp.json()["detail"]


def test_successful_order_decrements_actual_inventory():
    farmer_token = register_farmer()
    listing_resp = client.post(
        "/api/listings",
        headers={"Authorization": f"Bearer {farmer_token}"},
        json={
            "product_name": "Tomato", "category_name": "Vegetables",
            "quantity_available": 500, "unit": "kg", "price_per_unit": 30,
        },
    )
    listing_id = listing_resp.json()["id"]

    buyer_token = register_buyer()
    order_resp = client.post(
        "/api/orders",
        headers={"Authorization": f"Bearer {buyer_token}"},
        json={"items": [{"listing_id": listing_id, "quantity": 100}], "delivery_location": "Chennai"},
    )
    assert order_resp.status_code == 201
    assert float(order_resp.json()["subtotal"]) == 3000  # 100 * 30

    detail_resp = client.get(f"/api/marketplace/{listing_id}")
    assert float(detail_resp.json()["quantity_available"]) == 400  # 500 - 100


def test_role_login_mismatch_rejected():
    register_farmer()
    resp = client.post("/api/auth/login", json={
        "email": "farmer@test.com", "password": "password123", "role": "buyer",
    })
    assert resp.status_code == 403


def test_farmer_sees_and_confirms_seller_order():
    """
    Reproduces the reported gap: a new order starts PENDING and won't show up
    for logistics optimization until the farmer confirms it via /api/orders/seller
    + PUT /api/orders/{id}/status.
    """
    farmer_token = register_farmer()
    listing_resp = client.post(
        "/api/listings",
        headers={"Authorization": f"Bearer {farmer_token}"},
        json={
            "product_name": "Tomato", "category_name": "Vegetables",
            "quantity_available": 500, "unit": "kg", "price_per_unit": 30,
        },
    )
    listing_id = listing_resp.json()["id"]

    buyer_token = register_buyer()
    order_resp = client.post(
        "/api/orders",
        headers={"Authorization": f"Bearer {buyer_token}"},
        json={"items": [{"listing_id": listing_id, "quantity": 100}], "delivery_location": "Chennai"},
    )
    order_id = order_resp.json()["id"]
    assert order_resp.json()["status"] == "PENDING"

    # Farmer sees the order via the new /api/orders/seller endpoint.
    seller_resp = client.get("/api/orders/seller", headers={"Authorization": f"Bearer {farmer_token}"})
    assert seller_resp.status_code == 200
    assert len(seller_resp.json()) == 1
    assert seller_resp.json()[0]["id"] == order_id
    assert seller_resp.json()[0]["status"] == "PENDING"

    # A buyer must not see this endpoint's data as their own -- role-gated.
    buyer_seller_view = client.get("/api/orders/seller", headers={"Authorization": f"Bearer {buyer_token}"})
    assert buyer_seller_view.status_code == 403

    # Farmer confirms it -> now eligible for logistics optimization.
    update_resp = client.put(
        f"/api/orders/{order_id}/status",
        headers={"Authorization": f"Bearer {farmer_token}"},
        params={"new_status": "CONFIRMED"},
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["status"] == "CONFIRMED"


def register_transporter(vehicle_capacity_kg=1000, vehicle_number="TN-01-AB-1234",
                          base_latitude=None, base_longitude=None):
    resp = client.post("/api/auth/register/transporter", json={
        "full_name": "Test Transporter", "phone": "7777777777", "email": f"transporter{vehicle_number}@test.com",
        "password": "password123", "license_number": "DL12345", "base_location": "Chennai",
        "base_latitude": base_latitude, "base_longitude": base_longitude,
        "vehicle_name": "Tempo Traveller", "vehicle_number": vehicle_number,
        "vehicle_type": "Mini Truck", "capacity_kg": vehicle_capacity_kg,
    })
    assert resp.status_code == 201
    return resp.json()["access_token"]


def create_listing_as(token, product_name="Tomato", quantity=500, price=30):
    resp = client.post(
        "/api/listings",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "product_name": product_name, "category_name": "Vegetables",
            "quantity_available": quantity, "unit": "kg", "price_per_unit": price,
        },
    )
    assert resp.status_code == 201
    return resp.json()["id"]


def test_order_auto_creates_and_assigns_transport_request():
    """
    The core of the new flow: a buyer places an order, and a transport
    request is created and auto-assigned WITHOUT anyone manually requesting
    transport -- driven entirely by the farmer's and buyer's real coordinates.
    """
    farmer_token = register_farmer(farm_latitude=13.0827, farm_longitude=80.2707)  # Chennai
    listing_id = create_listing_as(farmer_token)

    register_transporter(vehicle_capacity_kg=1000, vehicle_number="TN-01-AA-0001",
                          base_latitude=13.05, base_longitude=80.25)  # near Chennai

    buyer_token = register_buyer(default_latitude=13.09, default_longitude=80.28)
    order_resp = client.post(
        "/api/orders",
        headers={"Authorization": f"Bearer {buyer_token}"},
        json={
            "items": [{"listing_id": listing_id, "quantity": 100}],
            "delivery_location": "Chennai Central",
            "delivery_latitude": 13.09, "delivery_longitude": 80.28,
        },
    )
    assert order_resp.status_code == 201

    reqs = client.get("/api/transport/requests/mine", headers={"Authorization": f"Bearer {buyer_token}"}).json()
    assert len(reqs) == 1
    assert reqs[0]["status"] == "ASSIGNED"
    assert reqs[0]["assigned_vehicle"]["vehicle_number"] == "TN-01-AA-0001"
    assert float(reqs[0]["weight_kg"]) == 100


def test_two_far_apart_farmers_in_one_order_get_different_nearest_vehicles():
    """
    Buyer orders from two farmers far apart -- each pickup should be matched
    to whichever registered vehicle is actually closest to THAT farmer, not
    just any vehicle with enough capacity.
    """
    chennai_farmer = register_farmer(email="chennai_farmer@test.com", farm_latitude=13.0827, farm_longitude=80.2707)
    tenkasi_farmer = register_farmer(email="tenkasi_farmer@test.com", farm_latitude=8.9500, farm_longitude=77.3167)

    chennai_listing = create_listing_as(chennai_farmer, product_name="Tomato")
    tenkasi_listing = create_listing_as(tenkasi_farmer, product_name="Banana")

    register_transporter(vehicle_capacity_kg=1000, vehicle_number="TN-CHN-0001",
                          base_latitude=13.05, base_longitude=80.25)   # near Chennai
    register_transporter(vehicle_capacity_kg=1000, vehicle_number="TN-TKS-0002",
                          base_latitude=8.96, base_longitude=77.32)    # near Tenkasi

    buyer_token = register_buyer(default_latitude=13.09, default_longitude=80.28)
    order_resp = client.post(
        "/api/orders",
        headers={"Authorization": f"Bearer {buyer_token}"},
        json={
            "items": [
                {"listing_id": chennai_listing, "quantity": 50},
                {"listing_id": tenkasi_listing, "quantity": 40},
            ],
            "delivery_location": "Chennai Central",
            "delivery_latitude": 13.09, "delivery_longitude": 80.28,
        },
    )
    assert order_resp.status_code == 201

    reqs = client.get("/api/transport/requests/mine", headers={"Authorization": f"Bearer {buyer_token}"}).json()
    assert len(reqs) == 2  # split per seller, exactly as intended

    by_pickup = {r["pickup_latitude"]: r for r in reqs}
    chennai_req = next(r for r in reqs if abs(float(r["pickup_latitude"]) - 13.0827) < 0.01)
    tenkasi_req = next(r for r in reqs if abs(float(r["pickup_latitude"]) - 8.9500) < 0.01)

    assert chennai_req["assigned_vehicle"]["vehicle_number"] == "TN-CHN-0001"
    assert tenkasi_req["assigned_vehicle"]["vehicle_number"] == "TN-TKS-0002"


def test_order_transport_stays_unassigned_when_no_vehicle_fits():
    farmer_token = register_farmer(farm_latitude=13.08, farm_longitude=80.27)
    listing_id = create_listing_as(farmer_token, quantity=5000)

    register_transporter(vehicle_capacity_kg=50, vehicle_number="TN-SMALL-0001", base_latitude=13.0, base_longitude=80.2)

    buyer_token = register_buyer(default_latitude=13.09, default_longitude=80.28)
    order_resp = client.post(
        "/api/orders",
        headers={"Authorization": f"Bearer {buyer_token}"},
        json={
            "items": [{"listing_id": listing_id, "quantity": 4000}],
            "delivery_location": "Chennai Central",
        },
    )
    assert order_resp.status_code == 201

    reqs = client.get("/api/transport/requests/mine", headers={"Authorization": f"Bearer {buyer_token}"}).json()
    assert reqs[0]["status"] == "REQUESTED"
    assert reqs[0]["assigned_vehicle"] is None


def test_manual_transport_creation_restricted_to_fpo_and_admin():
    buyer_token = register_buyer()
    resp = client.post(
        "/api/transport",
        headers={"Authorization": f"Bearer {buyer_token}"},
        json={
            "pickup_location": "Farm", "destination_location": "Market",
            "required_by": "2026-12-01T10:00:00", "weight_kg": 100,
        },
    )
    assert resp.status_code == 403


def test_stranger_cannot_track_someone_elses_shipment():
    farmer_token = register_farmer(farm_latitude=13.08, farm_longitude=80.27)
    listing_id = create_listing_as(farmer_token)
    register_transporter(vehicle_capacity_kg=1000, vehicle_number="TN-01-FF-0006", base_latitude=13.0, base_longitude=80.2)

    buyer_token = register_buyer(default_latitude=13.09, default_longitude=80.28)
    order_resp = client.post(
        "/api/orders",
        headers={"Authorization": f"Bearer {buyer_token}"},
        json={"items": [{"listing_id": listing_id, "quantity": 50}], "delivery_location": "Chennai"},
    )
    request_id = client.get("/api/transport/requests/mine", headers={"Authorization": f"Bearer {buyer_token}"}).json()[0]["id"]

    other_buyer_token = register_buyer(email="other_buyer@test.com")
    track_resp = client.get(
        f"/api/transport/requests/{request_id}/track",
        headers={"Authorization": f"Bearer {other_buyer_token}"},
    )
    assert track_resp.status_code == 403


def test_cannot_mark_delivered_before_estimated_transit_time_elapses():
    """
    The exact bug report this guards against: a transporter marking a
    shipment Delivered immediately, before any realistic transit time could
    have passed.
    """
    farmer_token = register_farmer(farm_latitude=13.08, farm_longitude=80.27)
    listing_id = create_listing_as(farmer_token)
    transporter_token = register_transporter(
        vehicle_capacity_kg=1000, vehicle_number="TN-01-GG-0007", base_latitude=13.0, base_longitude=80.2
    )

    buyer_token = register_buyer(default_latitude=13.09, default_longitude=80.28)
    client.post(
        "/api/orders",
        headers={"Authorization": f"Bearer {buyer_token}"},
        json={
            "items": [{"listing_id": listing_id, "quantity": 50}],
            "delivery_location": "Chennai", "delivery_latitude": 13.09, "delivery_longitude": 80.28,
        },
    )
    request_id = client.get("/api/transport/requests/mine", headers={"Authorization": f"Bearer {buyer_token}"}).json()[0]["id"]

    # Can't skip straight from ASSIGNED to DELIVERED.
    skip_resp = client.put(
        f"/api/transport/requests/{request_id}/status",
        headers={"Authorization": f"Bearer {transporter_token}"},
        params={"new_status": "DELIVERED"},
    )
    assert skip_resp.status_code == 400

    # Start the trip -- this computes and stores a real ETA.
    start_resp = client.put(
        f"/api/transport/requests/{request_id}/status",
        headers={"Authorization": f"Bearer {transporter_token}"},
        params={"new_status": "IN_TRANSIT"},
    )
    assert start_resp.status_code == 200
    assert start_resp.json()["estimated_transit_minutes"] >= 20

    # Immediately trying to mark Delivered must be rejected -- no time has passed.
    too_early_resp = client.put(
        f"/api/transport/requests/{request_id}/status",
        headers={"Authorization": f"Bearer {transporter_token}"},
        params={"new_status": "DELIVERED"},
    )
    assert too_early_resp.status_code == 400
    assert "earliest realistic delivery time" in too_early_resp.json()["detail"]


def test_can_mark_delivered_once_estimated_transit_time_has_passed():
    """Once enough real time has elapsed, Delivered is allowed -- verified by
    backdating in_transit_at directly in the DB, the same as if the trip had
    genuinely started earlier."""
    from datetime import datetime, timedelta
    from app.models.models import TransportRequest

    farmer_token = register_farmer(farm_latitude=13.08, farm_longitude=80.27)
    listing_id = create_listing_as(farmer_token)
    transporter_token = register_transporter(
        vehicle_capacity_kg=1000, vehicle_number="TN-01-HH-0008", base_latitude=13.0, base_longitude=80.2
    )
    buyer_token = register_buyer(default_latitude=13.09, default_longitude=80.28)
    client.post(
        "/api/orders",
        headers={"Authorization": f"Bearer {buyer_token}"},
        json={
            "items": [{"listing_id": listing_id, "quantity": 50}],
            "delivery_location": "Chennai", "delivery_latitude": 13.09, "delivery_longitude": 80.28,
        },
    )
    request_id = client.get("/api/transport/requests/mine", headers={"Authorization": f"Bearer {buyer_token}"}).json()[0]["id"]

    client.put(
        f"/api/transport/requests/{request_id}/status",
        headers={"Authorization": f"Bearer {transporter_token}"},
        params={"new_status": "IN_TRANSIT"},
    )

    # Simulate that the trip actually started well over an hour ago.
    db = TestingSessionLocal()
    req = db.query(TransportRequest).filter(TransportRequest.id == request_id).first()
    req.in_transit_at = datetime.utcnow() - timedelta(hours=2)
    db.commit()
    db.close()

    delivered_resp = client.put(
        f"/api/transport/requests/{request_id}/status",
        headers={"Authorization": f"Bearer {transporter_token}"},
        params={"new_status": "DELIVERED"},
    )
    assert delivered_resp.status_code == 200
    assert delivered_resp.json()["status"] == "DELIVERED"
