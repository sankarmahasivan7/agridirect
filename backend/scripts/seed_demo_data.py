"""
Deterministic DEMO DATA seed script (spec section 31).

This is for hackathon/judge demonstration only. It creates a small, fixed
set of accounts and listings -- no random values, no Math.random-style
noise. Re-running this script first WIPES all app tables (reset_demo_db),
so never point it at a real production database.

Run:
    python -m scripts.seed_demo_data
"""
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.db.session import SessionLocal, Base, engine
from app.core.security import hash_password
from app.models.models import (
    User, RoleEnum, FarmerProfile, FPOProfile, BuyerProfile,
    Category, Product, ProductListing, BuyerTypeEnum,
)


def reset_demo_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def seed():
    db = SessionLocal()
    try:
        # --- Categories & products ---
        veg = Category(name="Vegetables", parent_group="Crops")
        dairy = Category(name="Dairy", parent_group="Dairy")
        db.add_all([veg, dairy])
        db.flush()

        tomato = Product(name="Tomato", category_id=veg.id, default_unit="kg")
        onion = Product(name="Onion", category_id=veg.id, default_unit="kg")
        milk = Product(name="Milk", category_id=dairy.id, default_unit="litre")
        db.add_all([tomato, onion, milk])
        db.flush()

        # --- Farmer ---
        farmer_user = User(
            email="ravi.farmer@example.com", phone="9000000001",
            hashed_password=hash_password("Farmer@123"), role=RoleEnum.farmer, is_verified=True,
        )
        db.add(farmer_user)
        db.flush()
        ravi = FarmerProfile(
            user_id=farmer_user.id, full_name="Ravi Kumar", village_town="Perungudi",
            district="Chennai", state="Tamil Nadu", farm_location="Chennai outskirts",
            farm_size_acres=3,
        )
        db.add(ravi)
        db.flush()

        # --- FPO ---
        fpo_user = User(
            email="southtn.fpo@example.com", phone="9000000002",
            hashed_password=hash_password("Fpo@12345"), role=RoleEnum.fpo, is_verified=True,
        )
        db.add(fpo_user)
        db.flush()
        fpo = FPOProfile(
            user_id=fpo_user.id, organization_name="South TN Farmers Producer Org",
            registration_number="FPO-TN-0042", location="Tirunelveli", member_count=48,
        )
        db.add(fpo)
        db.flush()

        # --- Buyer ---
        buyer_user = User(
            email="spice.restaurant@example.com", phone="9000000003",
            hashed_password=hash_password("Buyer@123"), role=RoleEnum.buyer, is_verified=True,
        )
        db.add(buyer_user)
        db.flush()
        buyer = BuyerProfile(
            user_id=buyer_user.id, full_name="Priya Shah", business_name="Spice Route Restaurant",
            buyer_type=BuyerTypeEnum.restaurant, location="Chennai",
        )
        db.add(buyer)
        db.flush()

        # --- Real, fixed-value listings (matches the exact demo flow in the spec) ---
        listing_tomato = ProductListing(
            product_id=tomato.id, farmer_id=ravi.id,
            quantity_available=500, unit="kg", price_per_unit=30,
            quality_grade="Grade A", harvest_date=date.today() - timedelta(days=1),
            available_from=date.today(), available_until=date.today() + timedelta(days=7),
            location="Chennai", min_order_quantity=10, is_perishable=True, shelf_life_days=5,
        )
        listing_onion = ProductListing(
            product_id=onion.id, fpo_id=fpo.id,
            quantity_available=800, unit="kg", price_per_unit=22,
            quality_grade="Grade A", harvest_date=date.today() - timedelta(days=2),
            available_from=date.today(), available_until=date.today() + timedelta(days=14),
            location="Tirunelveli", min_order_quantity=25, is_perishable=True, shelf_life_days=20,
        )
        listing_milk = ProductListing(
            product_id=milk.id, farmer_id=ravi.id,
            quantity_available=100, unit="litre", price_per_unit=45,
            quality_grade="Standard", harvest_date=date.today(),
            available_from=date.today(), available_until=date.today() + timedelta(days=1),
            location="Chennai", min_order_quantity=5, is_perishable=True, shelf_life_days=2,
        )
        db.add_all([listing_tomato, listing_onion, listing_milk])
        db.commit()

        print("DEMO DATA seeded:")
        print("  Farmer login:  ravi.farmer@example.com / Farmer@123")
        print("  FPO login:     southtn.fpo@example.com / Fpo@12345")
        print("  Buyer login:   spice.restaurant@example.com / Buyer@123")
        print("  (create the admin account separately with scripts/create_admin.py)")
    finally:
        db.close()


if __name__ == "__main__":
    reset_demo_db()
    seed()
