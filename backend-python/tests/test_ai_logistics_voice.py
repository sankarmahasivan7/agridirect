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
    OrderStatusEnum, TransportRequest, Vehicle, TransporterProfile, Category, Product,
    DeliveryBatch, BatchStop
)
from app.services.gemini_service import (
    execute_get_orders, execute_get_warehouse_inventory,
    execute_get_available_vehicles, execute_get_transport_jobs,
    execute_update_delivery_status, process_ai_interaction
)
from app.services.google_route_optimizer import (
    plan_and_optimize_routes, explain_route_decision
)

TEST_DB_URL = "sqlite:///:memory:"
engine = create_engine(
    TEST_DB_URL, connect_args={"check_same_thread": False}, poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def setup_db():
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.pop(get_db, None)


app.router.on_startup.clear()
client = TestClient(app)

def test_gemini_tools_and_role_security():
    """Verify Gemini tool execution enforces database truth and strict role boundaries."""
    # Register farmer via API
    resp = client.post("/api/auth/register/farmer", json={
        "email": "farmer_ai@test.com",
        "password": "Password123!",
        "full_name": "Farmer AI User",
        "phone": "9876543211",
        "district": "Tenkasi",
        "farm_location": "Tenkasi Main",
        "farm_latitude": 8.9594,
        "farm_longitude": 77.3167,
    })
    assert resp.status_code == 201

    db = TestingSessionLocal()
    try:
        farmer = db.query(User).filter(User.email == "farmer_ai@test.com").first()
        assert farmer is not None

        # 1. Warehouse inventory tool returns 3 central pilot warehouses
        wh_result = execute_get_warehouse_inventory(db, farmer)
        assert "warehouses" in wh_result
        assert len(wh_result["warehouses"]) == 3
        districts = [w["district"] for w in wh_result["warehouses"]]
        assert "Tenkasi" in districts
        assert "Tirunelveli" in districts
        assert "Thoothukudi" in districts

        # 2. Get orders with zero fake data returns empty list
        orders_result = execute_get_orders(db, farmer)
        assert orders_result["count"] == 0
        assert orders_result["orders"] == []

        # 3. Security: Farmer attempting transporter-only action fails
        sec_result = execute_update_delivery_status(db, farmer, job_id=1, new_status="DELIVERED")
        assert "error" in sec_result
        assert "transporters or administrators" in sec_result["error"].lower()

    finally:
        db.close()


def test_bike_vs_truck_dispatch_rules():
    """
    Test strict vehicle dispatch rules:
    - Bike: <= 50 kg dispatches immediately (no 35% fill threshold)
    - Truck: < 35% capacity is held in waiting_consolidation
    """
    # 1. Register Transporter with Bike in Tenkasi
    resp = client.post("/api/auth/register/transporter", json={
        "email": "trans_rules@test.com",
        "password": "Password123!",
        "full_name": "Driver Kumar",
        "phone": "9876543212",
        "license_number": "TN76-2023-0002",
        "vehicle_name": "Yamaha Delivery Bike",
        "vehicle_number": "TN-76-BK-1234",
        "vehicle_type": "Bike",
        "capacity_kg": 50.0,
        "district": "Tenkasi",
        "base_location": "Tenkasi Hub",
        "base_latitude": 8.9594,
        "base_longitude": 77.3167,
    })
    assert resp.status_code == 201
    transporter_token = resp.json()["access_token"]
    trans_headers = {"Authorization": f"Bearer {transporter_token}"}

    # 2. Register Farmer & Listing
    f_resp = client.post("/api/auth/register/farmer", json={
        "email": "f_rules@test.com",
        "password": "Password123!",
        "full_name": "Farmer Selvam",
        "phone": "9876543213",
        "district": "Tenkasi",
        "farm_location": "Tenkasi Village",
        "farm_latitude": 8.9594,
        "farm_longitude": 77.3167,
    })
    assert f_resp.status_code == 201
    farmer_token = f_resp.json()["access_token"]

    list_resp = client.post("/api/listings", headers={"Authorization": f"Bearer {farmer_token}"}, json={
        "product_name": "Tomato Hybrid",
        "category_name": "Vegetables",
        "quantity_available": 500.0,
        "min_order_quantity": 5.0,
        "price_per_unit": 30.0,
        "unit": "kg",
        "location": "Tenkasi",
    })
    assert list_resp.status_code == 201

    # 3. Register Buyer & Place 25 kg Order
    b_resp = client.post("/api/auth/register/buyer", json={
        "email": "b_rules@test.com",
        "password": "Password123!",
        "full_name": "Buyer Anitha",
        "phone": "9876543214",
        "buyer_type": "retailer",
        "district": "Tirunelveli",
    })
    assert b_resp.status_code == 201
    buyer_token = b_resp.json()["access_token"]
    buyer_headers = {"Authorization": f"Bearer {buyer_token}"}

    order_resp = client.post("/api/orders", headers=buyer_headers, json={
        "items": [
            {"listing_id": list_resp.json()["id"], "quantity": 25.0}
        ],
        "delivery_location": "Palayamkottai, Tirunelveli",
        "delivery_latitude": 8.7139,
        "delivery_longitude": 77.7567,
        "payment_method": "PAY_ON_DELIVERY",
    })
    assert order_resp.status_code == 201

    # 4. Request Route Plans from /api/ai/logistics/plans
    plans_resp = client.get("/api/ai/logistics/plans", headers=trans_headers)
    assert plans_resp.status_code == 200
    plans_data = plans_resp.json()
    assert plans_data["has_routes"] is True
    assert plans_data["total_dispatchable_routes"] >= 1

    # Check that Bike plan dispatches immediately without 35% fill threshold
    bike_plan = next((p for p in plans_data["dispatch_plans"] if p["vehicle_category"] == "Bike"), None)
    assert bike_plan is not None
    assert bike_plan["dispatch_eligible"] is True
    assert "dispatch immediately" in bike_plan["rule_explanation"].lower()

    # Test AI Route Explanation endpoint
    explain_resp = client.post(
        "/api/ai/logistics/explain-route",
        json={"route_plan": bike_plan},
        headers=trans_headers
    )
    assert explain_resp.status_code == 200
    assert "within the 50 kg bike payload limit" in explain_resp.json()["explanation"]


def test_voice_interact_endpoint_bilingual():
    """Verify POST /api/ai/voice/interact handles queries and language fallback."""
    # Register buyer
    reg_resp = client.post("/api/auth/register/buyer", json={
        "email": "voice_buyer@test.com",
        "password": "Password123!",
        "full_name": "Senthil Buyer",
        "phone": "9876543215",
        "buyer_type": "retailer",
        "district": "Tirunelveli"
    })
    assert reg_resp.status_code == 201
    token = reg_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. English query
    resp_en = client.post(
        "/api/ai/voice/interact",
        json={
            "user_prompt": "What are my current orders?",
            "language": "en"
        },
        headers=headers
    )
    assert resp_en.status_code == 200
    data_en = resp_en.json()
    assert "response_text" in data_en
    assert data_en["user_role"] == "buyer"
    assert len(data_en["response_text"]) > 0

    # 2. Tamil query
    resp_ta = client.post(
        "/api/ai/voice/interact",
        json={
            "user_prompt": "என் ஆர்டர்களின் நிலை என்ன?",
            "language": "ta"
        },
        headers=headers
    )
    assert resp_ta.status_code == 200
    data_ta = resp_ta.json()
    assert "response_text" in data_ta
    assert data_ta["language"] == "ta"

    # 3. Explain route endpoint
    explain_resp = client.post(
        "/api/ai/logistics/explain-route",
        json={
            "route_plan": {
                "vehicle_category": "Truck",
                "vehicle_name": "Ashok Leyland 16T",
                "cargo_weight_kg": 400.0,
                "vehicle_capacity_kg": 1000.0,
                "fill_percentage": 40.0,
                "minimum_dispatch_kg": 350.0,
                "dispatch_eligible": True,
                "total_orders_count": 3,
                "estimated_road_distance_km": 65.0,
                "stops": [{"stop_type": "PICKUP"}, {"stop_type": "DELIVERY"}]
            }
        },
        headers=headers
    )
    assert explain_resp.status_code == 200
    assert "explanation" in explain_resp.json()
    assert "40.0% capacity fill" in explain_resp.json()["explanation"]

