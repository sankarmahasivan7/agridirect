import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.db.session import SessionLocal, engine
from app.core.config import settings
from app.core.security import hash_password
from app.models.models import User, RoleEnum
from sqlalchemy import text, inspect

def clean_database():
    db = SessionLocal()
    try:
        print("Disabling foreign key checks...")
        db.execute(text("SET FOREIGN_KEY_CHECKS = 0;"))
        
        tables_to_truncate = [
            "batch_stops",
            "delivery_batches",
            "transport_requests",
            "order_fulfillment_items",
            "order_items",
            "orders",
            "transactions",
            "payments",
            "supplier_matches",
            "bulk_requirements",
            "product_listings",
            "reviews",
            "notifications",
            "deliveries",
            "delivery_stops",
            "demand_data",
            "demand_predictions",
            "price_predictions",
            "vehicles",
            "transporter_profiles",
            "buyer_profiles",
            "farmer_profiles",
            "fpo_profiles",
        ]
        
        for tbl in tables_to_truncate:
            print(f"Truncating {tbl}...")
            db.execute(text(f"TRUNCATE TABLE `{tbl}`;"))
            
        print("Cleaning non-admin users...")
        db.execute(text("DELETE FROM users WHERE role != 'admin';"))
        
        # Ensure admin account exists with proper credentials
        admin = db.query(User).filter(User.email == settings.ADMIN_EMAIL).first()
        if admin:
            admin.hashed_password = hash_password(settings.ADMIN_PASSWORD)
            admin.role = RoleEnum.admin
            admin.is_active = True
            admin.is_verified = True
            print(f"Verified existing admin account: {settings.ADMIN_EMAIL}")
        else:
            admin = User(
                email=settings.ADMIN_EMAIL,
                hashed_password=hash_password(settings.ADMIN_PASSWORD),
                role=RoleEnum.admin,
                is_active=True,
                is_verified=True,
            )
            db.add(admin)
            print(f"Created clean admin account: {settings.ADMIN_EMAIL}")
            
        db.execute(text("SET FOREIGN_KEY_CHECKS = 1;"))
        db.commit()
        print("Database successfully wiped and reset!")
        
        # Report table counts
        inspector = inspect(engine)
        all_tables = inspector.get_table_names()
        print("\n--- Current Table Row Counts ---")
        for t in sorted(all_tables):
            count = db.execute(text(f"SELECT COUNT(*) FROM `{t}`")).scalar()
            print(f"  {t}: {count}")
            
    except Exception as e:
        db.rollback()
        db.execute(text("SET FOREIGN_KEY_CHECKS = 1;"))
        print(f"Error during clean: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    clean_database()

