import sys
from pathlib import Path
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.db.session import Base, get_db
from app.main import app
from app.models.models import (
    User, RoleEnum, ProductListing, Order, OrderItem, Payment, PaymentStatusEnum,
    OrderStatusEnum, TransportRequest, Vehicle, TransporterProfile, Category, Product
)

TEST_DB_URL = "sqlite:///:memory:"
engine = create_engine(
    TEST_DB_URL, connect_args={"check_same_thread": False}, poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def setup_db():
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.pop(get_db, None)


app.router.on_startup.clear()


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


client = TestClient(app)


def test_order_and_shipment_tracking():
    # 1. Register a Farmer in Tenkasi
    resp = client.post("/api/auth/register/farmer", json={
        "email": "farmer_track@test.com",
        "password": "Password123!",
        "full_name": "Murugan Tenkasi",
        "phone": "9876543210",
        "district": "Tenkasi",
        "farm_location": "Courtallam Road, Tenkasi",
        "farm_latitude": 8.9594,
        "farm_longitude": 77.3167,
    })
    assert resp.status_code == 201
    farmer_token = resp.json()["access_token"]
    farmer_headers = {"Authorization": f"Bearer {farmer_token}"}

    resp = client.post("/api/listings", headers=farmer_headers, json={
        "product_name": "Fresh Tomatoes",
        "category_name": "Vegetables",
        "quantity_available": 100.0,
        "min_order_quantity": 10.0,
        "price_per_unit": 25.0,
        "unit": "kg",
        "location": "Tenkasi",
    })
    assert resp.status_code == 201
    listing_id = resp.json()["id"]

    # 2. Register Transporter with Bike in Tenkasi
    resp = client.post("/api/auth/register/transporter", json={
        "email": "transporter_track@test.com",
        "password": "Password123!",
        "full_name": "Ramu Bike Transporter",
        "phone": "9876543211",
        "license_number": "TN76-2023-0001",
        "vehicle_name": "Hero Splendor Pro Delivery",
        "vehicle_number": "TN-76-AB-1234",
        "vehicle_type": "Bike",
        "capacity_kg": 50.0,
        "district": "Tenkasi",
        "base_location": "Tenkasi Hub",
        "base_latitude": 8.9594,
        "base_longitude": 77.3167,
    })
    assert resp.status_code == 201
    transporter_token = resp.json()["access_token"]

    # 3. Register Buyer in Tirunelveli
    resp = client.post("/api/auth/register/buyer", json={
        "email": "buyer_track@test.com",
        "password": "Password123!",
        "full_name": "Kannan Buyer",
        "phone": "9876543212",
        "buyer_type": "retailer",
        "district": "Tirunelveli",
        "location": "Palayamkottai, Tirunelveli",
        "default_latitude": 8.7139,
        "default_longitude": 77.7567,
    })
    assert resp.status_code == 201
    buyer_token = resp.json()["access_token"]
    buyer_headers = {"Authorization": f"Bearer {buyer_token}"}

    # 4. Check /api/auth/me returns buyer district and warehouse
    me_resp = client.get("/api/auth/me", headers=buyer_headers)
    assert me_resp.status_code == 200
    me_data = me_resp.json()
    assert me_data["district"] == "Tirunelveli"
    assert "Tirunelveli" in me_data["warehouse_name"]

    # 5. Place order as Buyer
    order_resp = client.post("/api/orders", headers=buyer_headers, json={
        "items": [{"listing_id": listing_id, "quantity": 30.0}],
        "delivery_location": "Palayamkottai, Tirunelveli",
        "delivery_latitude": 8.7139,
        "delivery_longitude": 77.7567,
        "payment_method": "PAY_ON_DELIVERY",
    })
    assert order_resp.status_code == 201
    order_data = order_resp.json()
    order_id = order_data["id"]
    t_req_id = order_data.get("transport_request_id")
    assert t_req_id is not None

    # 6. Check Buyer's order list contains transport_request_id
    mine_orders = client.get("/api/orders/mine", headers=buyer_headers)
    assert mine_orders.status_code == 200
    assert mine_orders.json()[0]["transport_request_id"] == t_req_id

    # 7. Track shipment using transport_request_id
    track_resp = client.get(f"/api/transport/requests/{t_req_id}/track", headers=buyer_headers)
    assert track_resp.status_code == 200
    track_data = track_resp.json()
    assert track_data["id"] == t_req_id
    assert track_data["order_id"] == order_id
    assert track_data["assigned_vehicle"] is not None
    assert track_data["assigned_vehicle"]["current_latitude"] is not None

    # 8. Track shipment using order_id directly (fallback route)
    track_by_order = client.get(f"/api/transport/requests/{order_id}/track", headers=buyer_headers)
    assert track_by_order.status_code == 200
    assert track_by_order.json()["id"] == t_req_id

    # 9. Verify /api/transport/requests/mine for buyer (does not error out with AttributeError)
    mine_reqs = client.get("/api/transport/requests/mine", headers=buyer_headers)
    assert mine_reqs.status_code == 200
    assert len(mine_reqs.json()) >= 1
    assert mine_reqs.json()[0]["id"] == t_req_id

    # 10. Simulate a vehicle with NULL lat/lng (e.g. legacy transporter before live GPS)
    # to verify _serialize does not crash on TransporterProfile.created_at
    db = TestingSessionLocal()
    try:
        v = db.query(Vehicle).first()
        if v:
            v.current_latitude = None
            v.current_longitude = None
            v.location_updated_at = None
            db.commit()
    finally:
        db.close()

    mine_reqs_fallback = client.get("/api/transport/requests/mine", headers=buyer_headers)
    assert mine_reqs_fallback.status_code == 200
    veh = mine_reqs_fallback.json()[0]["assigned_vehicle"]
    assert veh is not None
    # Verify fallback to transporter's base location
    assert veh["current_latitude"] is not None
    assert veh["location_updated_at"] is not None

    # 11. Verify Transporter can access tracking without 403 Forbidden
    trans_headers = {"Authorization": f"Bearer {transporter_token}"}
    transporter_track = client.get(f"/api/transport/requests/{t_req_id}/track", headers=trans_headers)
    assert transporter_track.status_code == 200
    assert transporter_track.json()["id"] == t_req_id

    # 12. Verify Farmer whose produce is in the shipment can access tracking
    farmer_track = client.get(f"/api/transport/requests/{t_req_id}/track", headers=farmer_headers)
    assert farmer_track.status_code == 200
    assert farmer_track.json()["id"] == t_req_id

    # 13. Register an unrelated second buyer and verify 403 Forbidden on other buyer's shipment
    resp = client.post("/api/auth/register/buyer", json={
        "email": "unrelated_buyer@test.com",
        "password": "Password123!",
        "full_name": "Stranger Buyer",
        "phone": "9876543999",
        "buyer_type": "retailer",
        "district": "Thoothukudi",
        "location": "Thoothukudi Port",
    })
    assert resp.status_code == 201
    stranger_headers = {"Authorization": f"Bearer {resp.json()['access_token']}"}
    stranger_track = client.get(f"/api/transport/requests/{t_req_id}/track", headers=stranger_headers)
    assert stranger_track.status_code == 403
    assert stranger_track.json()["detail"] == "You do not have access to this shipment"

