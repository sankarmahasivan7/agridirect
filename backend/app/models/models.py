"""
Normalized SQLAlchemy models for AgriDirect AI.

Money is always stored as Numeric/DECIMAL, never Float, to avoid rounding
errors on prices, totals, and earnings (spec section 6).
"""
import enum
from datetime import datetime, date

from sqlalchemy import (
    Column, Integer, String, Boolean, Text, DateTime, Date, Numeric,
    ForeignKey, Enum as SAEnum, UniqueConstraint, Index
)
from sqlalchemy.orm import relationship

from app.db.session import Base


class RoleEnum(str, enum.Enum):
    farmer = "farmer"
    buyer = "buyer"
    fpo = "fpo"
    admin = "admin"
    transporter = "transporter"


class BuyerTypeEnum(str, enum.Enum):
    consumer = "consumer"
    restaurant = "restaurant"
    hotel = "hotel"
    retailer = "retailer"
    supermarket = "supermarket"
    food_processor = "food_processor"


class OrderStatusEnum(str, enum.Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    PROCESSING = "PROCESSING"
    READY_FOR_PICKUP = "READY_FOR_PICKUP"
    IN_TRANSIT = "IN_TRANSIT"
    DELIVERED = "DELIVERED"
    CANCELLED = "CANCELLED"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String(190), unique=True, nullable=False, index=True)
    phone = Column(String(20), nullable=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(SAEnum(RoleEnum), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)  # admin verification, section 3 (Admin)
    created_at = Column(DateTime, default=datetime.utcnow)

    farmer_profile = relationship("FarmerProfile", back_populates="user", uselist=False, cascade="all,delete")
    buyer_profile = relationship("BuyerProfile", back_populates="user", uselist=False, cascade="all,delete")
    fpo_profile = relationship("FPOProfile", back_populates="user", uselist=False, cascade="all,delete")
    transporter_profile = relationship("TransporterProfile", back_populates="user", uselist=False, cascade="all,delete")
    notifications = relationship("Notification", back_populates="user", cascade="all,delete")


class FarmerProfile(Base):
    __tablename__ = "farmer_profiles"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    full_name = Column(String(150), nullable=False)
    village_town = Column(String(120))
    district = Column(String(120))
    state = Column(String(120))
    farm_location = Column(String(255))
    farm_size_acres = Column(Numeric(10, 2))
    fpo_id = Column(Integer, ForeignKey("fpo_profiles.id"), nullable=True)  # optional FPO membership

    # Real pickup coordinates -- this is what lets a transporter be matched by
    # actual distance to the farm, and what shows on the buyer's tracking map.
    farm_latitude = Column(Numeric(9, 6), nullable=True)
    farm_longitude = Column(Numeric(9, 6), nullable=True)

    user = relationship("User", back_populates="farmer_profile")
    listings = relationship("ProductListing", back_populates="farmer", cascade="all,delete")


class FPOProfile(Base):
    __tablename__ = "fpo_profiles"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    organization_name = Column(String(200), nullable=False)
    registration_number = Column(String(100))
    location = Column(String(255))
    member_count = Column(Integer, default=0)

    latitude = Column(Numeric(9, 6), nullable=True)
    longitude = Column(Numeric(9, 6), nullable=True)

    user = relationship("User", back_populates="fpo_profile")
    listings = relationship("ProductListing", back_populates="fpo", cascade="all,delete")
    members = relationship("FarmerProfile", backref="fpo", foreign_keys=[FarmerProfile.fpo_id])


class BuyerProfile(Base):
    __tablename__ = "buyer_profiles"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    full_name = Column(String(150), nullable=False)
    business_name = Column(String(200), nullable=True)
    buyer_type = Column(SAEnum(BuyerTypeEnum), nullable=False)
    location = Column(String(255))

    # Default delivery coordinates -- like a saved Amazon address; a buyer can
    # still override the delivery point per order at checkout.
    default_latitude = Column(Numeric(9, 6), nullable=True)
    default_longitude = Column(Numeric(9, 6), nullable=True)

    user = relationship("User", back_populates="buyer_profile")
    orders = relationship("Order", back_populates="buyer", cascade="all,delete")


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), unique=True, nullable=False)  # e.g. Vegetables, Dairy, Poultry
    parent_group = Column(String(100))  # e.g. Crops, Dairy, Livestock, Poultry, Other

    products = relationship("Product", back_populates="category")


class Product(Base):
    """A product TYPE (e.g. Tomato, Milk) under a category. Listings reference this."""
    __tablename__ = "products"

    id = Column(Integer, primary_key=True)
    name = Column(String(150), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    default_unit = Column(String(20), default="kg")  # kg, litre, dozen, unit, etc.

    __table_args__ = (UniqueConstraint("name", "category_id", name="uq_product_name_category"),)

    category = relationship("Category", back_populates="products")
    listings = relationship("ProductListing", back_populates="product")


class ProductListing(Base):
    """
    An actual, real listing entered by a farmer or FPO. This is the single
    source of truth for the marketplace. Values here are NEVER auto-generated
    or overwritten by AI predictions (spec sections 8-10, 20-21).
    """
    __tablename__ = "product_listings"

    id = Column(Integer, primary_key=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)

    farmer_id = Column(Integer, ForeignKey("farmer_profiles.id"), nullable=True)
    fpo_id = Column(Integer, ForeignKey("fpo_profiles.id"), nullable=True)

    quantity_available = Column(Numeric(12, 2), nullable=False)  # exact value entered by farmer
    unit = Column(String(20), nullable=False, default="kg")
    price_per_unit = Column(Numeric(10, 2), nullable=False)      # exact value entered by farmer, DECIMAL not float

    quality_grade = Column(String(50))
    harvest_date = Column(Date, nullable=True)
    available_from = Column(Date, nullable=True)
    available_until = Column(Date, nullable=True)

    location = Column(String(255))
    min_order_quantity = Column(Numeric(12, 2), default=0)
    is_perishable = Column(Boolean, default=True)
    shelf_life_days = Column(Integer, nullable=True)
    storage_requirement = Column(String(255), nullable=True)
    certification_info = Column(String(255), nullable=True)
    image_url = Column(String(500), nullable=True)

    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    product = relationship("Product", back_populates="listings")
    farmer = relationship("FarmerProfile", back_populates="listings")
    fpo = relationship("FPOProfile", back_populates="listings")
    order_items = relationship("OrderItem", back_populates="listing")

    __table_args__ = (
        Index("ix_listing_active_product", "product_id", "is_active"),
    )


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True)
    buyer_id = Column(Integer, ForeignKey("buyer_profiles.id"), nullable=False)

    subtotal = Column(Numeric(12, 2), nullable=False)
    logistics_cost = Column(Numeric(12, 2), nullable=False, default=0)
    platform_fee = Column(Numeric(12, 2), nullable=False, default=0)
    total_amount = Column(Numeric(12, 2), nullable=False)

    delivery_location = Column(String(255))
    delivery_latitude = Column(Numeric(9, 6), nullable=True)
    delivery_longitude = Column(Numeric(9, 6), nullable=True)
    status = Column(SAEnum(OrderStatusEnum), default=OrderStatusEnum.PENDING, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    buyer = relationship("BuyerProfile", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all,delete")


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    listing_id = Column(Integer, ForeignKey("product_listings.id"), nullable=False)

    quantity = Column(Numeric(12, 2), nullable=False)
    price_at_purchase = Column(Numeric(10, 2), nullable=False)  # snapshot of actual farmer price at order time
    line_subtotal = Column(Numeric(12, 2), nullable=False)

    order = relationship("Order", back_populates="items")
    listing = relationship("ProductListing", back_populates="order_items")


class BulkRequirement(Base):
    """A bulk procurement request from a buyer (spec section 16)."""
    __tablename__ = "bulk_requirements"

    id = Column(Integer, primary_key=True)
    buyer_id = Column(Integer, ForeignKey("buyer_profiles.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    required_quantity = Column(Numeric(12, 2), nullable=False)
    unit = Column(String(20), default="kg")
    needed_by = Column(Date, nullable=True)
    delivery_location = Column(String(255))
    status = Column(String(30), default="OPEN")  # OPEN, PARTIALLY_MATCHED, MATCHED, CLOSED
    created_at = Column(DateTime, default=datetime.utcnow)

    matches = relationship("SupplierMatch", back_populates="requirement", cascade="all,delete")


class SupplierMatch(Base):
    """Which real listings were matched against a bulk requirement, and how much of each (spec 16)."""
    __tablename__ = "supplier_matches"

    id = Column(Integer, primary_key=True)
    requirement_id = Column(Integer, ForeignKey("bulk_requirements.id"), nullable=False)
    listing_id = Column(Integer, ForeignKey("product_listings.id"), nullable=False)
    matched_quantity = Column(Numeric(12, 2), nullable=False)

    requirement = relationship("BulkRequirement", back_populates="matches")
    listing = relationship("ProductListing")


class LocationPoint(Base):
    """Geocoded point used by the logistics module for farmers/FPOs/buyers/delivery stops."""
    __tablename__ = "locations"

    id = Column(Integer, primary_key=True)
    label = Column(String(255))
    latitude = Column(Numeric(9, 6))
    longitude = Column(Numeric(9, 6))


class TransportRequestStatusEnum(str, enum.Enum):
    REQUESTED = "REQUESTED"          # created, no vehicle available yet -- honest, not fabricated
    ASSIGNED = "ASSIGNED"            # a real vehicle/transporter has been matched
    IN_TRANSIT = "IN_TRANSIT"
    DELIVERED = "DELIVERED"
    CANCELLED = "CANCELLED"


class TransporterProfile(Base):
    """
    A transport provider account (its own login, per spec-style role separation).
    Each transporter currently operates one vehicle -- simplest real model for
    a hackathon fleet of independent local transporters/drivers.
    """
    __tablename__ = "transporter_profiles"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    full_name = Column(String(150), nullable=False)
    license_number = Column(String(100))
    base_location = Column(String(255))
    is_available = Column(Boolean, default=True, nullable=False)  # transporter can go offline

    # Home-base coordinates, used to estimate distance-to-pickup when the
    # vehicle hasn't reported a live GPS position yet.
    base_latitude = Column(Numeric(9, 6), nullable=True)
    base_longitude = Column(Numeric(9, 6), nullable=True)

    user = relationship("User", back_populates="transporter_profile")
    vehicle = relationship("Vehicle", back_populates="transporter", uselist=False, cascade="all,delete")


class Vehicle(Base):
    __tablename__ = "vehicles"

    id = Column(Integer, primary_key=True)
    transporter_id = Column(Integer, ForeignKey("transporter_profiles.id"), unique=True, nullable=True)
    name = Column(String(100))
    vehicle_number = Column(String(50))
    vehicle_type = Column(String(50))  # e.g. Mini Truck, Tempo, Van
    capacity_kg = Column(Numeric(10, 2), nullable=False)
    is_active = Column(Boolean, default=True)

    # Live location, updated by the transporter (spec: farmer/buyer tracking).
    current_latitude = Column(Numeric(9, 6), nullable=True)
    current_longitude = Column(Numeric(9, 6), nullable=True)
    location_label = Column(String(255), nullable=True)
    location_updated_at = Column(DateTime, nullable=True)

    transporter = relationship("TransporterProfile", back_populates="vehicle")


class TransportRequest(Base):
    """
    A real transport booking: who asked, from where, to where, by when, how
    much weight -- and which real vehicle (if any) was actually matched to it.
    No fabricated ETAs or fake "en route" states; status only changes when a
    real vehicle is assigned or the transporter reports progress, and moving
    to DELIVERED is blocked until the physically-estimated transit time has
    actually elapsed (see estimated_transit_minutes).
    """
    __tablename__ = "transport_requests"

    id = Column(Integer, primary_key=True)
    requested_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)  # optional link to a real order

    pickup_location = Column(String(255), nullable=False)
    pickup_latitude = Column(Numeric(9, 6), nullable=True)
    pickup_longitude = Column(Numeric(9, 6), nullable=True)

    destination_location = Column(String(255), nullable=False)
    destination_latitude = Column(Numeric(9, 6), nullable=True)
    destination_longitude = Column(Numeric(9, 6), nullable=True)

    required_by = Column(DateTime, nullable=False)
    weight_kg = Column(Numeric(10, 2), nullable=False)
    notes = Column(String(500), nullable=True)

    status = Column(SAEnum(TransportRequestStatusEnum), default=TransportRequestStatusEnum.REQUESTED, nullable=False)
    assigned_vehicle_id = Column(Integer, ForeignKey("vehicles.id"), nullable=True)

    # Real, physics-based ETA enforcement (see app/utils/geo.py):
    # set when the transporter starts the trip, used to block a premature
    # "Delivered" status update.
    in_transit_at = Column(DateTime, nullable=True)
    estimated_transit_minutes = Column(Integer, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    requested_by = relationship("User")
    order = relationship("Order")
    assigned_vehicle = relationship("Vehicle")


class Delivery(Base):
    __tablename__ = "deliveries"

    id = Column(Integer, primary_key=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"), nullable=True)
    status = Column(String(30), default="PENDING_PICKUP")
    is_simulated = Column(Boolean, default=False, nullable=False)  # spec 26: must be labeled Demo Simulation
    created_at = Column(DateTime, default=datetime.utcnow)

    stops = relationship("DeliveryStop", back_populates="delivery", cascade="all,delete")


class DeliveryStop(Base):
    __tablename__ = "delivery_stops"

    id = Column(Integer, primary_key=True)
    delivery_id = Column(Integer, ForeignKey("deliveries.id"), nullable=False)
    sequence = Column(Integer, nullable=False)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=True)
    label = Column(String(255))
    eta = Column(DateTime, nullable=True)

    delivery = relationship("Delivery", back_populates="stops")


class DemandData(Base):
    """Historical demand records used ONLY for ML training -- never shown as live marketplace data (spec 17-19)."""
    __tablename__ = "demand_data"

    id = Column(Integer, primary_key=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    location = Column(String(120))
    record_date = Column(Date, nullable=False)
    demand_quantity = Column(Numeric(12, 2), nullable=False)
    price = Column(Numeric(10, 2), nullable=False)
    is_festival = Column(Boolean, default=False)
    is_synthetic = Column(Boolean, default=True, nullable=False)  # spec 19: must be clearly labeled


class DemandPrediction(Base):
    __tablename__ = "demand_predictions"

    id = Column(Integer, primary_key=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    location = Column(String(120))
    target_date = Column(Date, nullable=False)
    predicted_quantity = Column(Numeric(12, 2), nullable=False)
    model_version = Column(String(50))
    mae = Column(Numeric(10, 3), nullable=True)
    rmse = Column(Numeric(10, 3), nullable=True)
    r2 = Column(Numeric(10, 4), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class PricePrediction(Base):
    __tablename__ = "price_predictions"

    id = Column(Integer, primary_key=True)
    listing_id = Column(Integer, ForeignKey("product_listings.id"), nullable=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    recommended_min = Column(Numeric(10, 2), nullable=False)
    recommended_max = Column(Numeric(10, 2), nullable=False)
    reasoning = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(200), nullable=False)
    message = Column(Text)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="notifications")


class Transaction(Base):
    """Actual platform revenue records, derived from real orders (spec 28/30)."""
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    platform_fee_amount = Column(Numeric(12, 2), nullable=False)
    logistics_revenue_amount = Column(Numeric(12, 2), nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class PlatformSettings(Base):
    __tablename__ = "platform_settings"

    id = Column(Integer, primary_key=True)
    key = Column(String(100), unique=True, nullable=False)
    value = Column(String(255), nullable=False)
