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
from app.models.models import User, RoleEnum, ProductListing, Order, OrderItem, Payment, PaymentStatusEnum, OrderStatusEnum

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


def register_farmer(email="farmer_qr@test.com"):
    resp = client.post("/api/auth/register/farmer", json={
        "full_name": "Ramu Farmer", "phone": "9876543210", "email": email,
        "password": "password123", "village_town": "Tenkasi Town", "district": "Tenkasi", "state": "TN",
        "farm_latitude": 8.9594, "farm_longitude": 77.3167,
    })
    assert resp.status_code == 201
    return resp.json()["access_token"]


def register_buyer(email="buyer_qr@test.com"):
    resp = client.post("/api/auth/register/buyer", json={
        "full_name": "Senthil Buyer", "buyer_type": "consumer", "email": email,
        "phone": "8765432109", "password": "password123", "location": "Tirunelveli Town",
        "district": "Tirunelveli", "default_latitude": 8.7139, "default_longitude": 77.7567,
    })
    assert resp.status_code == 201
    return resp.json()["access_token"]


def create_sample_listing(farmer_token, qty=50.0, price=30.0):
    resp = client.post("/api/listings", json={
        "product_name": "Fresh Country Tomatoes",
        "category_name": "Vegetables",
        "quantity_available": qty,
        "unit": "kg",
        "price_per_unit": price,
        "quality_grade": "Grade A",
        "location": "Tenkasi",
    }, headers={"Authorization": f"Bearer {farmer_token}"})
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_upi_qr_payment_flow():
    """
    Complete UPI QR Code Checkout Flow:
    1. Buyer places order with payment_method='UPI'
    2. Backend returns order with dynamic upi_uri, upi_id, upi_name
    3. Status is initially PENDING
    4. Buyer confirms payment via /api/payments/confirm-qr with UTR
    5. Status updates to CONFIRMED, payment_status to PAID
    6. Fulfillment batches and jobs are dispatched
    7. Idempotent re-confirmation returns paid order
    """
    farmer_token = register_farmer()
    buyer_token = register_buyer()
    listing = create_sample_listing(farmer_token, qty=50.0, price=40.0)

    # 1. Place order via UPI
    order_resp = client.post("/api/orders", json={
        "items": [{"listing_id": listing["id"], "quantity": 10.0}],
        "delivery_location": "Tenkasi Hub, Tenkasi",
        "delivery_latitude": 8.9594,
        "delivery_longitude": 77.3167,
        "payment_method": "UPI",
    }, headers={"Authorization": f"Bearer {buyer_token}"})
    assert order_resp.status_code == 201, order_resp.text
    order_data = order_resp.json()

    assert order_data["status"] == "PENDING"
    assert order_data["payment_status"] == "PENDING"
    assert order_data["payment_method"] == "UPI"
    assert order_data["upi_id"] == "8870862195@axl"
    assert order_data["upi_name"] == "SEYED MOHAMMED SAFIN"
    assert "upi://pay?pa=8870862195@axl" in order_data["upi_uri"]
    assert f"tn=AgriDirect_Order_{order_data['id']}" in order_data["upi_uri"]
    assert float(order_data["total_amount"]) > 0

    order_id = order_data["id"]

    # 2. Confirm QR payment with UTR number
    confirm_resp = client.post("/api/payments/confirm-qr", json={
        "order_id": order_id,
        "utr_number": "423456789012"
    }, headers={"Authorization": f"Bearer {buyer_token}"})
    assert confirm_resp.status_code == 200, confirm_resp.text
    confirmed_data = confirm_resp.json()

    assert confirmed_data["status"] == "CONFIRMED"
    assert confirmed_data["payment_status"] == "PAID"
    assert confirmed_data["paid_at"] is not None

    # 3. Check DB Payment record
    db = TestingSessionLocal()
    pmt = db.query(Payment).filter(Payment.order_id == order_id).first()
    assert pmt is not None
    assert pmt.gateway == "UPI_QR"
    assert pmt.gateway_payment_id == "423456789012"
    assert pmt.payment_status == PaymentStatusEnum.PAID
    db.close()

    # 4. Idempotency test - repeated call returns paid order safely
    idempotent_resp = client.post("/api/payments/confirm-qr", json={
        "order_id": order_id,
        "utr_number": "423456789012"
    }, headers={"Authorization": f"Bearer {buyer_token}"})
    assert idempotent_resp.status_code == 200
    assert idempotent_resp.json()["payment_status"] == "PAID"


def test_upi_qr_payment_cancellation_restores_stock():
    """
    If buyer cancels the UPI QR modal before confirming,
    failPayment restores reserved inventory to marketplace.
    """
    farmer_token = register_farmer(email="farmer_cancel@test.com")
    buyer_token = register_buyer(email="buyer_cancel@test.com")
    listing = create_sample_listing(farmer_token, qty=50.0, price=40.0)

    # Place order for 20 kg -> stock decrements to 30 kg
    order_resp = client.post("/api/orders", json={
        "items": [{"listing_id": listing["id"], "quantity": 20.0}],
        "delivery_location": "Tenkasi Hub, Tenkasi",
        "delivery_latitude": 8.9594,
        "delivery_longitude": 77.3167,
        "payment_method": "UPI",
    }, headers={"Authorization": f"Bearer {buyer_token}"})
    assert order_resp.status_code == 201
    order_data = order_resp.json()

    db = TestingSessionLocal()
    l_mid = db.query(ProductListing).filter(ProductListing.id == listing["id"]).first()
    assert float(l_mid.quantity_available) == 30.0
    db.close()

    # Buyer cancels modal
    fail_resp = client.post("/api/payments/fail", json={
        "order_id": order_data["id"],
        "reason": "Buyer closed QR code modal"
    }, headers={"Authorization": f"Bearer {buyer_token}"})
    assert fail_resp.status_code == 200
    assert fail_resp.json()["payment_status"] == "FAILED"
    assert fail_resp.json()["order_status"] == "CANCELLED"

    # Stock is restored to 50 kg
    db = TestingSessionLocal()
    l_restored = db.query(ProductListing).filter(ProductListing.id == listing["id"]).first()
    assert float(l_restored.quantity_available) == 50.0
    db.close()
