from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.security import hash_password
from app.db.session import Base, engine, SessionLocal
from app.routers import auth, listings, marketplace, orders, bulk, ai, dashboard, logistics, transport

# Import models so they're registered on Base before create_all runs.
from app.models import models  # noqa: F401
from app.models.models import User, RoleEnum

app = FastAPI(
    title="AgriDirect AI API",
    description="Database-driven farmer-to-buyer marketplace with AI demand/price intelligence.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_ORIGIN],
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


@app.on_event("startup")
def on_startup():
    # For a hackathon/demo setup. For production, use Alembic migrations instead.
    Base.metadata.create_all(bind=engine)
    ensure_admin_account()


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
