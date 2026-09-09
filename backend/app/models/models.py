"""
Normalized SQLAlchemy models for AgriDirect AI.

Money is always stored as Numeric/DECIMAL, never Float, to avoid rounding
errors on prices, totals, and earnings (spec section 6).
"""
import enum
from datetime import datetime, date, timedelta
from typing import Optional

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


class PaymentMethodEnum(str, enum.Enum):
    UPI = "UPI"
    PAY_ON_DELIVERY = "PAY_ON_DELIVERY"


class PaymentStatusEnum(str, enum.Enum):
    PENDING = "PENDING"
    PAID = "PAID"
    FAILED = "FAILED"
    REFUNDED = "REFUNDED"


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
    reviews = relationship("Review", back_populates="farmer")


class FPOProfile(Base):
    __tablename__ = "fpo_profiles"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    organization_name = Column(String(200), nullable=False)
    registration_number = Column(String(100))
    location = Column(String(255))
    district = Column(String(120), nullable=True)
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
    district = Column(String(120), nullable=True)

    # Default delivery coordinates -- like a saved Amazon address; a buyer can
    # still override the delivery point per order at checkout.
    default_latitude = Column(Numeric(9, 6), nullable=True)
    default_longitude = Column(Numeric(9, 6), nullable=True)

    user = relationship("User", back_populates="buyer_profile")
    orders = relationship("Order", back_populates="buyer", cascade="all,delete")
    reviews = relationship("Review", back_populates="buyer", cascade="all,delete")


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
    reviews = relationship("Review", back_populates="product")


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
    expected_sell_by_date = Column(Date, nullable=True)
    perishability_level = Column(String(30), default="HIGH")  # HIGH, MEDIUM, LOW, NON_PERISHABLE
    storage_requirement = Column(String(255), nullable=True)
    certification_info = Column(String(255), nullable=True)
    image_url = Column(String(500), nullable=True)

    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def get_expected_sell_by_date(self) -> date | None:
        if not self.is_perishable or (self.perishability_level and self.perishability_level.upper() == "NON_PERISHABLE"):
            return None
        if self.expected_sell_by_date:
            return self.expected_sell_by_date
        base = self.harvest_date or (self.created_at.date() if self.created_at else date.today())
        life = self.shelf_life_days or 7
        return base + timedelta(days=life)

    def calculate_perishability_status(self, today=None) -> str:
        """
        Calculates status from real harvest/sell-by date:
        - Non-perishable -> FRESH
        - Past sell-by date -> EXPIRED (never offered to consumers)
        - <= 1 day left (or <= 20% shelf-life) -> CRITICAL
        - <= 3 days left (or <= 40% shelf-life) -> URGENT
        - <= 7 days left (or <= 60% shelf-life) -> SELL SOON
        - Otherwise -> FRESH
        """
        if not self.is_perishable or (self.perishability_level and self.perishability_level.upper() == "NON_PERISHABLE"):
            return "FRESH"

        if today is None:
            today = date.today()

        sell_by = self.get_expected_sell_by_date()
        if not sell_by:
            return "FRESH"

        days_left = (sell_by - today).days
        if days_left < 0:
            return "EXPIRED"

        total_life = self.shelf_life_days or 7
        ratio = days_left / total_life if total_life > 0 else 0.0

        if days_left <= 1 or ratio <= 0.20:
            return "CRITICAL"
        elif days_left <= 3 or ratio <= 0.40:
            return "URGENT"
        elif days_left <= 7 or ratio <= 0.60:
            return "SELL SOON"
        return "FRESH"

    def get_eligible_channels(self, today=None) -> list[str]:
        st = self.calculate_perishability_status(today)
        if st == "EXPIRED":
            return []
        if st == "CRITICAL":
            # Highly perishable batches near cutoff are suited for rapid processing & food services
            return ["RESTAURANT", "PROCESSOR", "RETAILER"]
        return ["CONSUMER", "RESTAURANT", "RETAILER", "PROCESSOR"]

    product = relationship("Product", back_populates="listings")
    farmer = relationship("FarmerProfile", back_populates="listings")
    fpo = relationship("FPOProfile", back_populates="listings")
    order_items = relationship("OrderItem", back_populates="listing")
    reviews = relationship("Review", back_populates="listing")

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

    # Payment & Settlement
    payment_method = Column(SAEnum(PaymentMethodEnum), nullable=True)
    payment_status = Column(SAEnum(PaymentStatusEnum), default=PaymentStatusEnum.PENDING, nullable=False)
    paid_at = Column(DateTime, nullable=True)

    farmer_settlement_amount = Column(Numeric(12, 2), nullable=False, default=0)
    transporter_settlement_amount = Column(Numeric(12, 2), nullable=False, default=0)
    platform_commission_amount = Column(Numeric(12, 2), nullable=False, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    buyer = relationship("BuyerProfile", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all,delete")
    fulfillment_items = relationship("OrderFulfillmentItem", back_populates="order", cascade="all,delete")
    payment = relationship("Payment", back_populates="order", uselist=False, cascade="all,delete")
    reviews = relationship("Review", back_populates="order", cascade="all,delete")
    transport_requests = relationship("TransportRequest", back_populates="order", cascade="all,delete")


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
    fulfillment_items = relationship("OrderFulfillmentItem", back_populates="order_item", cascade="all,delete")


class Payment(Base):
    """
    Payment record storing gateway metadata, verification details, and settlement splits.
    """
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True)
    order_id = Column(Integer, ForeignKey("orders.id"), unique=True, nullable=False)

    amount = Column(Numeric(12, 2), nullable=False)
    currency = Column(String(10), default="INR", nullable=False)
    payment_method = Column(SAEnum(PaymentMethodEnum), nullable=False)
    payment_status = Column(SAEnum(PaymentStatusEnum), default=PaymentStatusEnum.PENDING, nullable=False)

    gateway = Column(String(50), default="RAZORPAY", nullable=True)
    gateway_order_id = Column(String(100), nullable=True, index=True)
    gateway_payment_id = Column(String(100), nullable=True, index=True)
    gateway_signature = Column(String(255), nullable=True)

    farmer_amount = Column(Numeric(12, 2), nullable=False, default=0)
    transporter_amount = Column(Numeric(12, 2), nullable=False, default=0)
    commission_amount = Column(Numeric(12, 2), nullable=False, default=0)

    paid_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    order = relationship("Order", back_populates="payment")


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
    quality_grade = Column(String(50), nullable=True)
    delivery_latitude = Column(Numeric(9, 6), nullable=True)
    delivery_longitude = Column(Numeric(9, 6), nullable=True)
    status = Column(String(30), default="OPEN")  # OPEN, PARTIALLY_MATCHED, MATCHED, CLOSED
    created_at = Column(DateTime, default=datetime.utcnow)

    matches = relationship("SupplierMatch", back_populates="requirement", cascade="all,delete")
    buyer = relationship("BuyerProfile", backref="bulk_requirements")
    product = relationship("Product")


class SupplierMatch(Base):
    """Which real listings were matched against a bulk requirement, and how much of each (spec 16)."""
    __tablename__ = "supplier_matches"

    id = Column(Integer, primary_key=True)
    requirement_id = Column(Integer, ForeignKey("bulk_requirements.id"), nullable=False)
    listing_id = Column(Integer, ForeignKey("product_listings.id"), nullable=False)
    matched_quantity = Column(Numeric(12, 2), nullable=False)
    farmer_price = Column(Numeric(10, 2), nullable=True)
    logistics_cost = Column(Numeric(10, 2), nullable=True)
    platform_fee = Column(Numeric(10, 2), nullable=True)

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
    PENDING = "PENDING"              # Delivery job created, awaiting transporter acceptance
    ACCEPTED = "ACCEPTED"            # Transporter accepted the consignment job
    PICKUP = "PICKUP"                # Consignment picked up from farm gate / supplier
    IN_TRANSIT = "IN_TRANSIT"        # In transit towards buyer or aggregation hub
    DELIVERED = "DELIVERED"          # Consignment delivered to destination
    CANCELLED = "CANCELLED"          # Cancelled
    REQUESTED = "REQUESTED"          # Legacy alias
    ASSIGNED = "ASSIGNED"            # Legacy alias


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
    district = Column(String(120), nullable=True)
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


class DeliveryBatchStatusEnum(str, enum.Enum):
    BATCH_CREATED = "BATCH_CREATED"
    TRANSPORTER_ASSIGNED = "TRANSPORTER_ASSIGNED"
    ACCEPTED = "ACCEPTED"
    READY_FOR_PICKUP = "READY_FOR_PICKUP"
    PICKED_UP = "PICKED_UP"
    IN_TRANSIT = "IN_TRANSIT"
    OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY"
    DELIVERED = "DELIVERED"
    CANCELLED = "CANCELLED"


class DeliveryBatch(Base):
    """
    Consolidated delivery batch combining multiple customer orders destined for the same delivery district.
    Sequences multi-warehouse pickups and customer delivery drops, carried by an allocated 3PL transporter.
    """
    __tablename__ = "delivery_batches"

    id = Column(Integer, primary_key=True)
    batch_code = Column(String(50), unique=True, nullable=False)  # e.g. BATCH-TNV-2026-001
    delivery_area = Column(String(120), nullable=False)           # Destination district (Tenkasi, Tirunelveli, Thoothukudi)
    total_quantity_kg = Column(Numeric(12, 2), nullable=False, default=0)
    total_orders_count = Column(Integer, default=0, nullable=False)
    total_customers_count = Column(Integer, default=0, nullable=False)
    required_vehicle_capacity_kg = Column(Numeric(12, 2), nullable=False, default=0)
    estimated_distance_km = Column(Numeric(10, 2), default=0)
    estimated_logistics_cost = Column(Numeric(12, 2), default=0)

    status = Column(SAEnum(DeliveryBatchStatusEnum), default=DeliveryBatchStatusEnum.BATCH_CREATED, nullable=False)
    assigned_transporter_id = Column(Integer, ForeignKey("transporter_profiles.id"), nullable=True)
    assigned_vehicle_id = Column(Integer, ForeignKey("vehicles.id"), nullable=True)

    pickup_deadline = Column(DateTime, nullable=True)
    delivery_deadline = Column(DateTime, nullable=True)
    earliest_available_date = Column(Date, nullable=True)
    in_transit_at = Column(DateTime, nullable=True)
    estimated_transit_minutes = Column(Integer, nullable=True, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def get_earliest_available_date(self) -> date | None:
        if self.earliest_available_date:
            return self.earliest_available_date
        dates = []
        for item in self.fulfillment_items or []:
            if getattr(item, 'available_from', None):
                dates.append(item.available_from)
            elif item.order_item and item.order_item.listing:
                d = item.order_item.listing.available_from or item.order_item.listing.harvest_date
                if d:
                    dates.append(d)
        return max(dates) if dates else None

    @property
    def vehicle_category(self) -> str:
        if self.vehicle:
            from app.logistics.vehicle_rules import get_vehicle_classification
            return get_vehicle_classification(self.vehicle)
        return "Bike" if float(self.total_quantity_kg or 0) <= 50.0 else "Truck"

    @property
    def minimum_dispatch_weight(self) -> float:
        if self.vehicle:
            from app.logistics.vehicle_rules import get_minimum_dispatch_weight
            return get_minimum_dispatch_weight(self.vehicle)
        if float(self.total_quantity_kg or 0) <= 50.0:
            return 0.0
        return round(float(self.total_quantity_kg or 0) * 0.35, 2)

    @property
    def fill_percentage(self) -> Optional[float]:
        if self.vehicle and self.vehicle.capacity_kg:
            cap = float(self.vehicle.capacity_kg)
            if cap > 0:
                return round((float(self.total_quantity_kg or 0) / cap) * 100, 1)
        return None

    @property
    def dispatch_eligible(self) -> bool:
        if self.vehicle:
            from app.logistics.vehicle_rules import evaluate_vehicle_for_batch
            return evaluate_vehicle_for_batch(self.vehicle, self.total_quantity_kg)[0]
        return float(self.total_quantity_kg or 0) <= 50.0

    @property
    def assigned_transporter(self):
        return self.transporter

    @property
    def assigned_vehicle(self):
        return self.vehicle

    fulfillment_items = relationship("OrderFulfillmentItem", back_populates="batch")
    stops = relationship("BatchStop", back_populates="batch", cascade="all,delete", order_by="BatchStop.sequence")
    transporter = relationship("TransporterProfile", backref="batches")
    vehicle = relationship("Vehicle", backref="batches")
    transport_requests = relationship("TransportRequest", back_populates="batch")


class OrderFulfillmentItem(Base):
    """
    Internal fulfillment unit mapping an individual ordered item to its source aggregation warehouse.
    Customer orders may contain products from different warehouses (Tenkasi, Tirunelveli, Thoothukudi).
    Fulfillment items allow grouping across multiple customer orders by destination area into consolidated batches.
    """
    __tablename__ = "order_fulfillment_items"

    id = Column(Integer, primary_key=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    order_item_id = Column(Integer, ForeignKey("order_items.id"), nullable=False)
    warehouse_name = Column(String(255), nullable=False)
    warehouse_code = Column(String(50), nullable=False)
    warehouse_district = Column(String(120), nullable=False)
    warehouse_latitude = Column(Numeric(9, 6), nullable=True)
    warehouse_longitude = Column(Numeric(9, 6), nullable=True)
    quantity = Column(Numeric(12, 2), nullable=False)
    status = Column(String(50), default="PENDING", nullable=False)  # PENDING, BATCHED, PICKED_UP, DELIVERED, CANCELLED
    batch_id = Column(Integer, ForeignKey("delivery_batches.id"), nullable=True)
    available_from = Column(Date, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    order = relationship("Order", back_populates="fulfillment_items")
    order_item = relationship("OrderItem", back_populates="fulfillment_items")
    batch = relationship("DeliveryBatch", back_populates="fulfillment_items")


class BatchStop(Base):
    """
    Ordered route stop within a delivery batch:
    - PICKUP stops at District Central Warehouses (Tenkasi, Tirunelveli, Thoothukudi)
    - DELIVERY stops at customer delivery destinations
    """
    __tablename__ = "batch_stops"

    id = Column(Integer, primary_key=True)
    batch_id = Column(Integer, ForeignKey("delivery_batches.id"), nullable=False)
    stop_type = Column(String(20), nullable=False)  # 'PICKUP' or 'DELIVERY'
    sequence = Column(Integer, nullable=False)      # 1, 2, 3...
    location_name = Column(String(255), nullable=False)
    latitude = Column(Numeric(9, 6), nullable=True)
    longitude = Column(Numeric(9, 6), nullable=True)
    cargo_kg = Column(Numeric(10, 2), default=0)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    customer_name = Column(String(150), nullable=True)
    notes = Column(String(500), nullable=True)
    status = Column(String(30), default="PENDING", nullable=False)  # PENDING, COMPLETED, SKIPPED

    batch = relationship("DeliveryBatch", back_populates="stops")
    order = relationship("Order")


class TransportRequest(Base):
    """
    A real transport booking created from actual order data:
    - pickup_location, destination_location
    - quantity (weight_kg)
    - vehicle_capacity_kg
    - delivery status: PENDING -> ACCEPTED -> PICKUP -> IN_TRANSIT -> DELIVERED
    - strategy: direct, consolidated, aggregation_hub
    - hub_name: intermediate cross-dock point for long distance (logistics only, no buy/resell)
    """
    __tablename__ = "transport_requests"

    id = Column(Integer, primary_key=True)
    requested_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    batch_id = Column(Integer, ForeignKey("delivery_batches.id"), nullable=True)

    pickup_location = Column(String(255), nullable=False)
    pickup_latitude = Column(Numeric(9, 6), nullable=True)
    pickup_longitude = Column(Numeric(9, 6), nullable=True)

    destination_location = Column(String(255), nullable=False)
    destination_latitude = Column(Numeric(9, 6), nullable=True)
    destination_longitude = Column(Numeric(9, 6), nullable=True)

    required_by = Column(DateTime, nullable=False)
    available_from = Column(Date, nullable=True)
    weight_kg = Column(Numeric(10, 2), nullable=False)
    notes = Column(String(500), nullable=True)

    status = Column(SAEnum(TransportRequestStatusEnum), default=TransportRequestStatusEnum.PENDING, nullable=False)
    assigned_vehicle_id = Column(Integer, ForeignKey("vehicles.id"), nullable=True)

    # Strategy & Logistics Infrastructure Fields
    logistics_strategy = Column(String(50), default="direct", nullable=False)  # direct, consolidated, aggregation_hub
    hub_name = Column(String(255), nullable=True)  # Logistics transit hub name for long-distance (no commercial resale)
    distance_km = Column(Numeric(10, 2), nullable=True)
    logistics_cost = Column(Numeric(10, 2), nullable=True)
    vehicle_capacity_kg = Column(Numeric(10, 2), nullable=True)

    # Perishability & Priority Fields
    is_perishable = Column(Boolean, default=False)
    perishability_urgency = Column(String(30), default="NORMAL")  # CRITICAL, URGENT, SELL_SOON, NORMAL
    storage_requirement = Column(String(255), nullable=True)

    # Real, physics-based ETA enforcement
    in_transit_at = Column(DateTime, nullable=True)
    estimated_transit_minutes = Column(Integer, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    requested_by = relationship("User")
    order = relationship("Order", back_populates="transport_requests")
    assigned_vehicle = relationship("Vehicle")
    batch = relationship("DeliveryBatch", back_populates="transport_requests")


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
    notification_type = Column(String(50), default="INFO")  # ORDER, TRANSPORT, DELIVERY, SYSTEM
    link = Column(String(255), nullable=True)
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


class Review(Base):
    """
    Customer feedback and quality rating submitted by a verified buyer for an order item / produce.
    Supports produce photo upload (e.g. proof of waste or fresh vegetables).
    """
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False, index=True)
    buyer_id = Column(Integer, ForeignKey("buyer_profiles.id"), nullable=False, index=True)
    farmer_id = Column(Integer, ForeignKey("farmer_profiles.id"), nullable=True, index=True)
    listing_id = Column(Integer, ForeignKey("product_listings.id"), nullable=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True, index=True)

    product_name = Column(String(150), nullable=True)
    rating = Column(Integer, nullable=False)  # 1 to 5 stars
    comment = Column(Text, nullable=True)
    image_url = Column(String(500), nullable=True)  # path to uploaded produce photo
    is_waste_reported = Column(Boolean, default=False, nullable=False)  # True if buyer reports waste or rating <= 2
    created_at = Column(DateTime, default=datetime.utcnow)

    order = relationship("Order", back_populates="reviews")
    buyer = relationship("BuyerProfile", back_populates="reviews")
    farmer = relationship("FarmerProfile", back_populates="reviews")
    listing = relationship("ProductListing", back_populates="reviews")
    product = relationship("Product", back_populates="reviews")

