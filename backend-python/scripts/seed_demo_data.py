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
    TransporterProfile, Vehicle,
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
            user_id=farmer_user.id, full_name="Ravi Kumar", village_town="Surandai",
            district="Tenkasi", state="Tamil Nadu", farm_location="Surandai, Tenkasi",
            farm_size_acres=3, farm_latitude=8.9594, farm_longitude=77.3167,
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
            registration_number="FPO-TN-0042", location="Palayamkottai, Tirunelveli",
            district="Tirunelveli", member_count=48, latitude=8.7139, longitude=77.7567,
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
            buyer_type=BuyerTypeEnum.restaurant, location="Harbour Road, Thoothukudi",
            district="Thoothukudi", default_latitude=8.7642, default_longitude=78.1348,
        )
        db.add(buyer)
        db.flush()

        # --- Real, fixed-value listings (matches the exact demo flow in the spec) ---
        listing_tomato = ProductListing(
            product_id=tomato.id, farmer_id=ravi.id,
            quantity_available=500, unit="kg", price_per_unit=30,
            quality_grade="Grade A", harvest_date=date.today() - timedelta(days=1),
            available_from=date.today(), available_until=date.today() + timedelta(days=7),
            location="Tenkasi", min_order_quantity=10, is_perishable=True, shelf_life_days=5,
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
            location="Tenkasi", min_order_quantity=5, is_perishable=True, shelf_life_days=2,
        )
        db.add_all([listing_tomato, listing_onion, listing_milk])

        # --- Real Fleet Transporters (Bike & Trucks for 3 districts) ---
        # 1. Bike Transporter in Tenkasi (Max 50 kg, immediate dispatch, no 35% rule)
        t_bike_user = User(
            email="kannan.bike@example.com", phone="9000000004",
            hashed_password=hash_password("Transporter@123"), role=RoleEnum.transporter, is_verified=True,
        )
        db.add(t_bike_user)
        db.flush()
        t_bike_profile = TransporterProfile(
            user_id=t_bike_user.id, full_name="Kannan Express Logistics",
            license_number="DL-TN-76-2023", base_location="Courtallam Road, Tenkasi",
            district="Tenkasi", base_latitude=8.9594, base_longitude=77.3167, is_available=True,
        )
        db.add(t_bike_profile)
        db.flush()
        v_bike = Vehicle(
            transporter_id=t_bike_profile.id, name="Hero Splendor Cargo",
            vehicle_number="TN-76-BK-1001", vehicle_type="Two-Wheeler (Express Micro-Delivery)",
            capacity_kg=50.0, is_active=True,
        )
        db.add(v_bike)

        # 2. Truck Transporter in Thoothukudi (500 kg truck, 35% minimum dispatch = 175 kg)
        t_truck_user = User(
            email="velu.truck@example.com", phone="9000000005",
            hashed_password=hash_password("Transporter@123"), role=RoleEnum.transporter, is_verified=True,
        )
        db.add(t_truck_user)
        db.flush()
        t_truck_profile = TransporterProfile(
            user_id=t_truck_user.id, full_name="Velu Freight Carriers",
            license_number="DL-TN-69-2021", base_location="Harbour Logistics Hub, Thoothukudi",
            district="Thoothukudi", base_latitude=8.7642, base_longitude=78.1348, is_available=True,
        )
        db.add(t_truck_profile)
        db.flush()
        v_truck = Vehicle(
            transporter_id=t_truck_profile.id, name="Bolero Maxi Truck",
            vehicle_number="TN-69-TR-5002", vehicle_type="Pickup Truck (1-2 Ton)",
            capacity_kg=500.0, is_active=True,
        )
        db.add(v_truck)

        # 3. Medium Freight Transporter in Tirunelveli (300 kg tempo, 35% minimum dispatch = 105 kg)
        t_tempo_user = User(
            email="muthu.tempo@example.com", phone="9000000006",
            hashed_password=hash_password("Transporter@123"), role=RoleEnum.transporter, is_verified=True,
        )
        db.add(t_tempo_user)
        db.flush()
        t_tempo_profile = TransporterProfile(
            user_id=t_tempo_user.id, full_name="Muthu Fast Freight",
            license_number="DL-TN-72-2022", base_location="Palayamkottai Hub, Tirunelveli",
            district="Tirunelveli", base_latitude=8.7139, base_longitude=77.7567, is_available=True,
        )
        db.add(t_tempo_profile)
        db.flush()
        v_tempo = Vehicle(
            transporter_id=t_tempo_profile.id, name="Tata 407 Freight",
            vehicle_number="TN-72-TM-3003", vehicle_type="Tempo / 407 (Medium Freight)",
            capacity_kg=300.0, is_active=True,
        )
        db.add(v_tempo)

        db.commit()

        print("Demo data seeded successfully:")
        print("  Farmer login:      ravi.farmer@example.com / Farmer@123 (Tenkasi)")
        print("  Buyer login:       spice.restaurant@example.com / Buyer@123 (Thoothukudi)")
        print("  Bike Transporter:  kannan.bike@example.com / Transporter@123 (Tenkasi - 50kg Bike, Immediate Dispatch)")
        print("  Truck Transporter: velu.truck@example.com / Transporter@123 (Thoothukudi - 500kg Truck, 35% Min Fill = 175kg)")
        print("  Tempo Transporter: muthu.tempo@example.com / Transporter@123 (Tirunelveli - 300kg Tempo, 35% Min Fill = 105kg)")
        print("  (create the admin account separately with scripts/create_admin.py)")
    finally:
        db.close()


if __name__ == "__main__":
    reset_demo_db()
    seed()
