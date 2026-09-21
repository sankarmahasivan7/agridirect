import os
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.security import hash_password
from sqlalchemy import text
from app.db.session import Base, engine, SessionLocal
from app.routers import (
    auth, listings, marketplace, orders, bulk, ai, dashboard,
    logistics, transport, notifications, batches, payments, reviews, advance_demands
)

# Import models so they're registered on Base before create_all runs.
from app.models.models import User, RoleEnum, VehicleRate, LogisticsSetting

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        Base.metadata.create_all(bind=engine)
        ensure_schema_compatibility()
        seed_logistics_defaults()
        ensure_admin_account()
    except Exception as e:
        print(f"Startup warning: {e}")
    try:
        yield
    except (asyncio.CancelledError, KeyboardInterrupt):
        pass

app = FastAPI(
    title="AgriDirect AI API",
    description="Database-driven farmer-to-buyer marketplace with AI demand/price intelligence.",
    version="1.0.0",
    lifespan=lifespan,
)

# Build list of allowed origins
_raw_origins = [
    settings.FRONTEND_ORIGIN,
    "https://agridirect-1-epvz.onrender.com",
    "http://localhost",
    "https://localhost",
    "capacitor://localhost",
    "ionic://localhost",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:5175",
]
if getattr(settings, "FRONTEND_ORIGINS", None):
    _raw_origins.extend([o.strip() for o in settings.FRONTEND_ORIGINS.split(",") if o.strip()])

_cors_origins = []
for _o in _raw_origins:
    if _o and _o not in _cors_origins:
        _cors_origins.append(_o)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_origin_regex=r"^(https?://(localhost|127\.0\.0\.1)(:\d+)?|https://.*\.onrender\.com|capacitor://.*|ionic://.*)$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def ensure_admin_account():
    """
    Idempotently creates (or fixes the role of) the single admin account from
    ADMIN_EMAIL/ADMIN_PASSWORD env vars. Runs on every startup so platforms
    without shell access (e.g. Render's free tier) never need a one-off
    script -- just set the env vars and (re)deploy. Never touches any other
    user account, and never overwrites an existing admin's password.
    """
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == settings.ADMIN_EMAIL).first()
        if existing:
            if existing.role != RoleEnum.admin:
                existing.role = RoleEnum.admin
                db.commit()
        else:
            db.add(User(
                email=settings.ADMIN_EMAIL,
                hashed_password=hash_password(settings.ADMIN_PASSWORD),
                role=RoleEnum.admin,
                is_active=True,
                is_verified=True,
            ))
            db.commit()
    finally:
        db.close()


def ensure_schema_compatibility():
    if not settings.DATABASE_URL.startswith("mysql"):
        return
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE transport_requests MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'PENDING'"))
            conn.commit()
        except Exception:
            pass
        for table in ["buyer_profiles", "fpo_profiles", "transporter_profiles"]:
            try:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN district VARCHAR(120)"))
                conn.commit()
            except Exception:
                pass
        for col, col_type in [("notification_type", "VARCHAR(50) DEFAULT 'INFO'"), ("link", "VARCHAR(255)")]:
            try:
                conn.execute(text(f"ALTER TABLE notifications ADD COLUMN {col} {col_type}"))
                conn.commit()
            except Exception:
                pass
        try:
            conn.execute(text("ALTER TABLE transport_requests ADD COLUMN batch_id INT NULL"))
            conn.commit()
        except Exception:
            pass
        for tbl, col, col_type in [
            ("transport_requests", "available_from", "DATE NULL"),
            ("order_fulfillment_items", "available_from", "DATE NULL"),
            ("delivery_batches", "earliest_available_date", "DATE NULL"),
            ("delivery_batches", "in_transit_at", "DATETIME NULL"),
            ("delivery_batches", "estimated_transit_minutes", "INT NULL DEFAULT 0"),
        ]:
            try:
                conn.execute(text(f"ALTER TABLE {tbl} ADD COLUMN {col} {col_type}"))
                conn.commit()
            except Exception:
                pass
        for col, col_type in [
            ("payment_method", "VARCHAR(50) NULL"),
            ("payment_status", "VARCHAR(50) NOT NULL DEFAULT 'PENDING'"),
            ("paid_at", "DATETIME NULL"),
            ("farmer_settlement_amount", "DECIMAL(12, 2) NOT NULL DEFAULT 0"),
            ("transporter_settlement_amount", "DECIMAL(12, 2) NOT NULL DEFAULT 0"),
            ("platform_commission_amount", "DECIMAL(12, 2) NOT NULL DEFAULT 0"),
            ("base_fare", "DECIMAL(10, 2) NULL"),
            ("distance_fare", "DECIMAL(10, 2) NULL"),
            ("toll_charges", "DECIMAL(10, 2) NULL DEFAULT 0"),
            ("loading_unloading_charge", "DECIMAL(10, 2) NULL DEFAULT 0"),
            ("waiting_charge", "DECIMAL(10, 2) NULL DEFAULT 0"),
            ("road_distance_km", "DECIMAL(10, 2) NULL"),
            ("allocated_vehicle_type", "VARCHAR(50) NULL"),
        ]:
            try:
                conn.execute(text(f"ALTER TABLE orders ADD COLUMN {col} {col_type}"))
                conn.commit()
            except Exception:
                pass

        for tbl, col, col_type in [
            ("delivery_batches", "base_fare", "DECIMAL(10, 2) NULL"),
            ("delivery_batches", "distance_fare", "DECIMAL(10, 2) NULL"),
            ("delivery_batches", "toll_charges", "DECIMAL(10, 2) NULL DEFAULT 0"),
            ("delivery_batches", "loading_unloading_charge", "DECIMAL(10, 2) NULL DEFAULT 0"),
            ("delivery_batches", "waiting_charge", "DECIMAL(10, 2) NULL DEFAULT 0"),
            ("delivery_batches", "allocated_vehicle_type", "VARCHAR(50) NULL"),
            ("transport_requests", "base_fare", "DECIMAL(10, 2) NULL"),
            ("transport_requests", "distance_fare", "DECIMAL(10, 2) NULL"),
            ("transport_requests", "toll_charges", "DECIMAL(10, 2) NULL DEFAULT 0"),
            ("transport_requests", "loading_unloading_charge", "DECIMAL(10, 2) NULL DEFAULT 0"),
            ("transport_requests", "waiting_charge", "DECIMAL(10, 2) NULL DEFAULT 0"),
            ("transport_requests", "road_distance_km", "DECIMAL(10, 2) NULL"),
            ("transport_requests", "allocated_vehicle_type", "VARCHAR(50) NULL"),
        ]:
            try:
                conn.execute(text(f"ALTER TABLE {tbl} ADD COLUMN {col} {col_type}"))
                conn.commit()
            except Exception:
                pass


def seed_logistics_defaults():
    """Seeds default vehicle rates and logistics thresholds if not already present."""
    db = SessionLocal()
    try:
        if db.query(VehicleRate).count() == 0:
            default_rates = [
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
            db.add_all(default_rates)
            db.commit()

        if db.query(LogisticsSetting).count() == 0:
            default_settings = [
                LogisticsSetting(
                    setting_key="truck_min_fill_pct",
                    setting_value="35.0",
                    description="Minimum payload fill percentage required for truck dispatch",
                ),
                LogisticsSetting(
                    setting_key="bike_max_capacity_kg",
                    setting_value="50.0",
                    description="Maximum payload weight in kg for two-wheeler / bike dispatch",
                ),
                LogisticsSetting(
                    setting_key="loading_unloading_fee",
                    setting_value="50.0",
                    description="Standard loading/unloading fee per warehouse stop",
                ),
            ]
            db.add_all(default_settings)
            db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/")
def root():
    """
    Friendly landing response so the bare backend URL doesn't look broken.
    The actual app lives in the frontend Static Site -- this backend is API-only.
    """
    return {
        "service": "AgriDirect AI API",
        "status": "running",
        "docs": "/docs",
        "health": "/api/health",
    }


app.include_router(auth.router)
app.include_router(listings.router)
app.include_router(marketplace.router)
app.include_router(orders.router)
app.include_router(bulk.router)
app.include_router(ai.router)
app.include_router(dashboard.router)
app.include_router(logistics.router)
app.include_router(transport.router)
app.include_router(notifications.router)
app.include_router(batches.router)
app.include_router(payments.router)
app.include_router(reviews.router)
app.include_router(advance_demands.router)

# Mount static uploads directory for review images and produce photos
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC_DIR = os.path.join(BASE_DIR, "static")
os.makedirs(os.path.join(STATIC_DIR, "uploads", "reviews"), exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

