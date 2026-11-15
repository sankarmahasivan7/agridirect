import io
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
from app.models.models import User, RoleEnum, ProductListing, Order, OrderItem, Review, Notification

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


def register_farmer(email="farmer_rev@test.com"):
    resp = client.post("/api/auth/register/farmer", json={
        "full_name": "Ramu Farmer", "phone": "9876543210", "email": email,
        "password": "password123", "village_town": "Tenkasi Town", "district": "Tenkasi", "state": "TN",
        "farm_latitude": 8.9594, "farm_longitude": 77.3167,
    })
    assert resp.status_code == 201
    return resp.json()["access_token"]


def register_buyer(email="buyer_rev@test.com"):
    resp = client.post("/api/auth/register/buyer", json={
        "full_name": "Senthil Buyer", "buyer_type": "consumer", "email": email,
        "phone": "8765432109", "password": "password123", "location": "Tirunelveli Town",
        "district": "Tirunelveli", "default_latitude": 8.7139, "default_longitude": 77.7567,
    })
    assert resp.status_code == 201
    return resp.json()["access_token"]


def test_customer_feedback_rating_and_photo_upload():
    farmer_token = register_farmer("farmer_rev1@test.com")
    buyer_token = register_buyer("buyer_rev1@test.com")

    # 1. Farmer creates listing
    listing_resp = client.post("/api/listings", json={
        "product_name": "Fresh Organic Carrots",
        "category_name": "Vegetables",
        "quantity_available": 100.0,
        "unit": "kg",
        "price_per_unit": 45.0,
        "quality_grade": "Grade A",
        "location": "Tenkasi",
    }, headers={"Authorization": f"Bearer {farmer_token}"})
    assert listing_resp.status_code == 201
    listing_id = listing_resp.json()["id"]

    # 2. Buyer places order
    order_resp = client.post("/api/orders", json={
        "items": [{"listing_id": listing_id, "quantity": 10.0}],
        "delivery_location": "Tirunelveli High Road",
        "payment_method": "PAY_ON_DELIVERY",
    }, headers={"Authorization": f"Bearer {buyer_token}"})
    assert order_resp.status_code == 201
    order_id = order_resp.json()["id"]

    # 3. Buyer submits 5-star review with a mock photo file
    photo_bytes = b"fake-jpeg-image-bytes-representing-fresh-carrots"
    files = {"image": ("fresh_carrots.jpg", io.BytesIO(photo_bytes), "image/jpeg")}
    data = {
        "order_id": str(order_id),
        "listing_id": str(listing_id),
        "rating": "5",
        "comment": "Super fresh carrots received directly from Tenkasi farm!",
    }

    rev_resp = client.post(
        "/api/reviews",
        data=data,
        files=files,
        headers={"Authorization": f"Bearer {buyer_token}"},
    )
    assert rev_resp.status_code == 201
    rev_data = rev_resp.json()
    assert rev_data["rating"] == 5
    assert rev_data["is_waste_reported"] is False
    assert rev_data["buyer_name"] == "Senthil Buyer"
    assert rev_data["image_url"].startswith("/static/uploads/reviews/")

    # 4. Check listing detail now returns real rating & review count
    detail_resp = client.get(f"/api/marketplace/{listing_id}")
    assert detail_resp.status_code == 200
    listing_detail = detail_resp.json()
    assert listing_detail["farmer_rating"] == 5.0
    assert listing_detail["farmer_review_count"] >= 1

    # 5. Farmer views dashboard review summary
    farmer_dash = client.get("/api/dashboard/farmer", headers={"Authorization": f"Bearer {farmer_token}"})
    assert farmer_dash.status_code == 200
    rating_summary = farmer_dash.json().get("rating_summary")
    assert rating_summary is not None
    assert rating_summary["average_rating"] == 5.0
    assert rating_summary["total_reviews"] == 1
    assert rating_summary["waste_reports_count"] == 0
    assert len(rating_summary["recent_reviews"]) == 1
    assert rating_summary["recent_reviews"][0]["image_url"] == rev_data["image_url"]


def test_waste_produce_reporting_triggers_alert():
    farmer_token = register_farmer("farmer_waste@test.com")
    buyer_token = register_buyer("buyer_waste@test.com")

    # 1. Farmer creates listing
    listing_resp = client.post("/api/listings", json={
        "product_name": "Tomatoes",
        "category_name": "Vegetables",
        "quantity_available": 50.0,
        "unit": "kg",
        "price_per_unit": 30.0,
        "location": "Tenkasi",
    }, headers={"Authorization": f"Bearer {farmer_token}"})
    listing_id = listing_resp.json()["id"]

    # 2. Buyer places order
    order_resp = client.post("/api/orders", json={
        "items": [{"listing_id": listing_id, "quantity": 5.0}],
        "delivery_location": "Tirunelveli Town",
        "payment_method": "PAY_ON_DELIVERY",
    }, headers={"Authorization": f"Bearer {buyer_token}"})
    order_id = order_resp.json()["id"]

    # 3. Buyer submits 1-star review reporting rotten waste vegetables with photo
    photo_bytes = b"fake-photo-evidence-of-damaged-tomatoes"
    files = {"image": ("rotten_tomatoes.png", io.BytesIO(photo_bytes), "image/png")}
    data = {
        "order_id": str(order_id),
        "listing_id": str(listing_id),
        "rating": "1",
        "comment": "Some tomatoes were rotten and waste vegetables upon delivery. See photo proof.",
    }

    rev_resp = client.post(
        "/api/reviews",
        data=data,
        files=files,
        headers={"Authorization": f"Bearer {buyer_token}"},
    )
    assert rev_resp.status_code == 201
    rev_data = rev_resp.json()
    assert rev_data["rating"] == 1
    assert rev_data["is_waste_reported"] is True
    assert rev_data["image_url"] is not None

    # 4. Verify that a Quality Alert notification was dispatched to the farmer
    notif_resp = client.get("/api/notifications", headers={"Authorization": f"Bearer {farmer_token}"})
    assert notif_resp.status_code == 200
    notifications = notif_resp.json()
    quality_alerts = [n for n in notifications if n["notification_type"] == "QUALITY_ALERT"]
    assert len(quality_alerts) >= 1
    assert "Quality Alert" in quality_alerts[0]["title"]
    assert "Tomatoes" in quality_alerts[0]["message"]

    # 5. Farmer views dashboard and sees the waste reports count = 1
    farmer_dash = client.get("/api/dashboard/farmer", headers={"Authorization": f"Bearer {farmer_token}"})
    assert farmer_dash.status_code == 200
    summary = farmer_dash.json().get("rating_summary")
    assert summary["waste_reports_count"] == 1
    assert summary["recent_reviews"][0]["is_waste_reported"] is True


def test_review_validation_and_unauthorized_access():
    farmer_token = register_farmer("farmer_auth@test.com")
    buyer_token = register_buyer("buyer_auth@test.com")

    # Farmer attempts to submit review -> should be 403 Forbidden
    resp = client.post(
        "/api/reviews",
        data={"order_id": "1", "rating": "5", "comment": "Nice"},
        headers={"Authorization": f"Bearer {farmer_token}"},
    )
    assert resp.status_code == 403

    # Invalid star ratings
    resp_invalid_low = client.post(
        "/api/reviews",
        data={"order_id": "1", "rating": "0"},
        headers={"Authorization": f"Bearer {buyer_token}"},
    )
    assert resp_invalid_low.status_code == 400

    resp_invalid_high = client.post(
        "/api/reviews",
        data={"order_id": "1", "rating": "6"},
        headers={"Authorization": f"Bearer {buyer_token}"},
    )
    assert resp_invalid_high.status_code == 400

