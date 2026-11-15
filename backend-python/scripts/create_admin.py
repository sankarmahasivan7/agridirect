"""
Creates (or resets the password of) the single admin account from .env
values. There is intentionally no public /api/auth/register/admin endpoint
(spec section 5).

Run:
    python -m scripts.create_admin
"""
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.db.session import SessionLocal, Base, engine
from app.core.config import settings
from app.core.security import hash_password
from app.models.models import User, RoleEnum


def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == settings.ADMIN_EMAIL).first()
        if existing:
            existing.hashed_password = hash_password(settings.ADMIN_PASSWORD)
            existing.role = RoleEnum.admin
            existing.is_active = True
            db.commit()
            print(f"Updated existing admin: {settings.ADMIN_EMAIL}")
        else:
            admin = User(
                email=settings.ADMIN_EMAIL,
                hashed_password=hash_password(settings.ADMIN_PASSWORD),
                role=RoleEnum.admin,
                is_active=True,
                is_verified=True,
            )
            db.add(admin)
            db.commit()
            print(f"Created admin: {settings.ADMIN_EMAIL}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
