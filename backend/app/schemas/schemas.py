from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List, Dict, Any

from pydantic import BaseModel, EmailStr, Field

from app.models.models import RoleEnum, BuyerTypeEnum, OrderStatusEnum, PaymentMethodEnum, PaymentStatusEnum


# ---------- Auth ----------
class FarmerRegister(BaseModel):
    full_name: str
    phone: str
    email: EmailStr
    password: str = Field(min_length=8)
    village_town: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    farm_location: Optional[str] = None
    farm_size_acres: Optional[Decimal] = None
    farm_latitude: Optional[Decimal] = None
    farm_longitude: Optional[Decimal] = None


class FPORegister(BaseModel):
    organization_name: str
    registration_number: Optional[str] = None
    email: EmailStr
    phone: str
    password: str = Field(min_length=8)
    location: Optional[str] = None
    district: Optional[str] = None
    member_count: Optional[int] = 0
    latitude: Optional[Decimal] = None
    longitude: Optional[Decimal] = None


class BuyerRegister(BaseModel):
    full_name: str
    business_name: Optional[str] = None
    buyer_type: BuyerTypeEnum
    email: EmailStr
    phone: str
    password: str = Field(min_length=8)
    location: Optional[str] = None
    district: Optional[str] = None
    default_latitude: Optional[Decimal] = None
    default_longitude: Optional[Decimal] = None


class TransporterRegister(BaseModel):
    email: EmailStr
    phone: str
    password: str = Field(min_length=8)
    full_name: str
    license_number: Optional[str] = None
    base_location: Optional[str] = None
    district: Optional[str] = None
    base_latitude: Optional[Decimal] = None
    base_longitude: Optional[Decimal] = None
    vehicle_name: Optional[str] = None
    vehicle_number: Optional[str] = None
    vehicle_type: Optional[str] = None
    capacity_kg: Decimal = Field(default=Decimal("1000.0"))


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    role: RoleEnum


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: RoleEnum
    user_id: int
    district: Optional[str] = None
    warehouse_name: Optional[str] = None


# ---------- Products / Listings ----------
class CategoryOut(BaseModel):
    id: int
    name: str
    parent_group: Optional[str]

    class Config:
        from_attributes = True


class ProductOut(BaseModel):
    id: int
    name: str
    category_id: int
    default_unit: str

    class Config:
        from_attributes = True


class ListingCreate(BaseModel):
    product_name: str            # if it doesn't exist yet, created under category
    category_name: str
    quantity_available: Decimal = Field(gt=0)
    unit: str = "kg"
    price_per_unit: Decimal = Field(gt=0)
    quality_grade: Optional[str] = None
    harvest_date: Optional[date] = None
    available_from: Optional[date] = None
    available_until: Optional[date] = None
    location: Optional[str] = None
    min_order_quantity: Optional[Decimal] = 0
    is_perishable: bool = True
    shelf_life_days: Optional[int] = None
    expected_sell_by_date: Optional[date] = None
    perishability_level: Optional[str] = "HIGH"
    storage_requirement: Optional[str] = None
    certification_info: Optional[str] = None
    image_url: Optional[str] = None


class ListingUpdate(BaseModel):
    quantity_available: Optional[Decimal] = None
    price_per_unit: Optional[Decimal] = None
    quality_grade: Optional[str] = None
    available_until: Optional[date] = None
    is_active: Optional[bool] = None
    storage_requirement: Optional[str] = None
    shelf_life_days: Optional[int] = None
    expected_sell_by_date: Optional[date] = None


class ListingOut(BaseModel):
    id: int
    product_name: str
    category_name: str
    farmer_name: Optional[str] = None
    fpo_name: Optional[str] = None
    quantity_available: Decimal
    unit: str
    price_per_unit: Decimal
    quality_grade: Optional[str]
    harvest_date: Optional[date]
    available_from: Optional[date]
    available_until: Optional[date]
    location: Optional[str]
    min_order_quantity: Decimal
    is_perishable: bool
    shelf_life_days: Optional[int] = None
    expected_sell_by_date: Optional[date] = None
    perishability_level: Optional[str] = None
    storage_requirement: Optional[str] = None
    perishability_status: str = "FRESH"
    days_remaining: Optional[int] = None
    eligible_channels: List[str] = []
    is_active: bool
    distance_km: Optional[Decimal] = None
    recommended_strategy: Optional[str] = None
    created_at: datetime
    farmer_rating: Optional[float] = None
    farmer_review_count: int = 0
    product_rating: Optional[float] = None
    product_review_count: int = 0

    class Config:
        from_attributes = True


# ---------- Cart / Orders ----------
class CartItemIn(BaseModel):
    listing_id: int
    quantity: Decimal = Field(gt=0)


class OrderCreate(BaseModel):
    items: List[CartItemIn]
    delivery_location: str
    delivery_latitude: Optional[Decimal] = None
    delivery_longitude: Optional[Decimal] = None
    payment_method: Optional[PaymentMethodEnum] = None


class OrderItemOut(BaseModel):
    listing_id: int
    product_name: str
    quantity: Decimal
    price_at_purchase: Decimal
    line_subtotal: Decimal

    class Config:
        from_attributes = True


class OrderOut(BaseModel):
    id: int
    subtotal: Decimal
    logistics_cost: Decimal
    platform_fee: Decimal
    total_amount: Decimal
    delivery_location: Optional[str]
    status: OrderStatusEnum
    payment_method: Optional[PaymentMethodEnum] = None
    payment_status: Optional[PaymentStatusEnum] = None
    paid_at: Optional[datetime] = None
    farmer_settlement_amount: Optional[Decimal] = None
    transporter_settlement_amount: Optional[Decimal] = None
    platform_commission_amount: Optional[Decimal] = None
    razorpay_order_id: Optional[str] = None
    razorpay_key_id: Optional[str] = None
    amount_paise: Optional[int] = None
    currency: Optional[str] = "INR"
    upi_uri: Optional[str] = None
    upi_id: Optional[str] = None
    upi_name: Optional[str] = None
    transport_request_id: Optional[int] = None
    created_at: datetime
    items: List[OrderItemOut]

    class Config:
        from_attributes = True


class PaymentVerifyIn(BaseModel):
    order_id: int
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class PaymentQrConfirmIn(BaseModel):
    order_id: int
    utr_number: Optional[str] = None


class PaymentFailIn(BaseModel):
    order_id: int
    reason: Optional[str] = "Payment cancelled or failed"


class SettlementOut(BaseModel):
    order_id: int
    total_amount: Decimal
    payment_method: Optional[PaymentMethodEnum] = None
    payment_status: Optional[PaymentStatusEnum] = None
    paid_at: Optional[datetime] = None
    farmer_amount: Decimal
    transporter_amount: Decimal
    commission_amount: Decimal


# ---------- Bulk requirement ----------
class BulkRequirementCreate(BaseModel):
    product_name: str
    required_quantity: Decimal = Field(gt=0)
    unit: str = "kg"
    needed_by: Optional[date] = None
    delivery_location: Optional[str] = None
    quality_grade: Optional[str] = None
    delivery_latitude: Optional[float] = None
    delivery_longitude: Optional[float] = None


class MatchOut(BaseModel):
    listing_id: int
    product_name: Optional[str] = None
    seller_name: Optional[str] = None
    farmer_or_fpo: Optional[str] = None
    seller_type: Optional[str] = None  # "farmer" or "fpo"
    matched_quantity: Decimal
    unit: Optional[str] = "kg"
    price_per_unit: Decimal
    farmer_subtotal: Optional[Decimal] = None
    distance_km: Optional[Decimal] = None
    logistics_cost: Optional[Decimal] = None
    platform_fee: Optional[Decimal] = None
    delivered_subtotal: Optional[Decimal] = None
    quality_grade: Optional[str] = None
    is_perishable: Optional[bool] = None
    shelf_life_days: Optional[int] = None
    location: Optional[str] = None
    line_subtotal: Optional[Decimal] = None  # backwards compat


class BulkMatchResult(BaseModel):
    requirement_id: int
    product_name: str
    required_quantity: Decimal
    unit: str = "kg"
    quality_grade: Optional[str] = None
    matched_quantity: Decimal
    supply_gap: Decimal
    total_farmer_price: Decimal = Decimal("0")
    total_logistics_cost: Decimal = Decimal("0")
    total_platform_fee: Decimal = Decimal("0")
    total_delivered_cost: Decimal = Decimal("0")
    matches: List[MatchOut]
    summary_message: Optional[str] = None


class BulkRequirementOut(BaseModel):
    id: int
    product_name: str
    required_quantity: Decimal
    unit: str
    needed_by: Optional[date]
    delivery_location: Optional[str]
    quality_grade: Optional[str] = None
    status: str
    matches: List[MatchOut]
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- AI ----------
class DemandForecastOut(BaseModel):
    product_name: str
    location: Optional[str] = None
    actual_supply: Decimal = Decimal("0")
    ai_forecast: Optional[Decimal] = None
    forecast_quantity: Decimal = Decimal("0")  # backwards-compatible alias
    potential_supply_gap: Optional[Decimal] = None
    has_sufficient_data: bool = False
    historical_points_count: int = 0
    status_message: str = "Not enough historical data for reliable forecasting."
    trend: str = "UNKNOWN"
    forecast_change_percent: Optional[float] = None
    target_date: Optional[str] = None
    mae: Optional[float] = None
    rmse: Optional[float] = None
    r2: Optional[float] = None
    note: Optional[str] = None
    label: str = "AI FORECAST"


class PriceRecommendationOut(BaseModel):
    product_name: str
    actual_farmer_price: Optional[Decimal] = None
    recommended_min: Decimal
    recommended_max: Decimal
    recommended_range_str: Optional[str] = None
    label: str = "AI RECOMMENDATION"
    reasoning: str
    price_autonomy_guarantee: str = "The AI recommendation never automatically changes the farmer's price. You maintain 100% price autonomy."
    perishability_status: Optional[str] = None
    expected_sell_by_date: Optional[date] = None
    recommended_action: Optional[str] = None
    eligible_channels: List[str] = []


class RouteStopOut(BaseModel):
    stop_sequence: int
    stop_type: str  # DEPOT | PICKUP | DELIVERY
    location_label: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    transport_request_id: Optional[int] = None
    job_notes: Optional[str] = None
    weight_kg: float = 0.0
    cumulative_load_kg: float = 0.0
    perishability_urgency: str = "NORMAL"
    distance_from_prev_km: float = 0.0


class OptimizedTripOut(BaseModel):
    trip_index: int
    trip_distance_km: float
    trip_duration_minutes: int
    max_load_kg: float
    capacity_utilization_pct: float
    jobs_serviced: List[int] = []
    stops: List[RouteStopOut] = []


class RouteOptimizationOut(BaseModel):
    label: str = "AI OPTIMIZED ROUTE"
    has_jobs: bool = False
    vehicle_id: Optional[int] = None
    vehicle_number: Optional[str] = None
    vehicle_capacity_kg: float = 0.0
    total_jobs_considered: int = 0
    total_trips: int = 0
    total_distance_km: float = 0.0
    estimated_total_time_minutes: int = 0
    status_message: str = "No real logistics jobs available for route optimization."
    solver_status: str = "EMPTY"  # OPTIMAL | FEASIBLE | EMPTY
    perishability_prioritized: bool = True
    trips: List[OptimizedTripOut] = []
    unassigned_job_ids: List[int] = []


# ---------- Transporter & Transport requests ----------
class TransporterProfileOut(BaseModel):
    id: int
    full_name: str
    license_number: Optional[str]
    base_location: Optional[str]
    district: Optional[str] = None
    is_available: bool
    base_latitude: Optional[Decimal] = None
    base_longitude: Optional[Decimal] = None

    class Config:
        from_attributes = True


class VehicleOut(BaseModel):
    id: int
    name: Optional[str]
    vehicle_number: Optional[str]
    vehicle_type: Optional[str]
    capacity_kg: Decimal
    current_latitude: Optional[Decimal]
    current_longitude: Optional[Decimal]
    location_label: Optional[str]
    location_updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class TransportRequestCreate(BaseModel):
    """Only used for the manual creation path now reserved for FPO/admin bulk logistics."""
    pickup_location: str
    pickup_latitude: Optional[Decimal] = None
    pickup_longitude: Optional[Decimal] = None
    destination_location: str
    destination_latitude: Optional[Decimal] = None
    destination_longitude: Optional[Decimal] = None
    required_by: datetime
    weight_kg: Decimal = Field(gt=0)
    notes: Optional[str] = None
    order_id: Optional[int] = None


class TransportRequestOut(BaseModel):
    id: int
    pickup_location: str
    pickup_latitude: Optional[Decimal] = None
    pickup_longitude: Optional[Decimal] = None
    destination_location: str
    destination_latitude: Optional[Decimal] = None
    destination_longitude: Optional[Decimal] = None
    required_by: datetime
    weight_kg: Decimal
    notes: Optional[str]
    status: str
    order_id: Optional[int]
    assigned_vehicle: Optional[VehicleOut] = None
    logistics_strategy: Optional[str] = "direct"
    hub_name: Optional[str] = None
    distance_km: Optional[Decimal] = None
    logistics_cost: Optional[Decimal] = None
    vehicle_capacity_kg: Optional[Decimal] = None
    is_perishable: Optional[bool] = False
    perishability_urgency: Optional[str] = "NORMAL"
    storage_requirement: Optional[str] = None
    available_from: Optional[date] = None
    in_transit_at: Optional[datetime] = None
    estimated_transit_minutes: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class LocationUpdate(BaseModel):
    latitude: Decimal
    longitude: Decimal
    location_label: Optional[str] = None


# ---------- Notifications ----------
class NotificationOut(BaseModel):
    id: int
    user_id: int
    title: str
    message: Optional[str] = None
    notification_type: str = "INFO"
    link: Optional[str] = None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UnreadCountOut(BaseModel):
    unread_count: int


# ---------- Batched Delivery & Transporter Allocation ----------
class BatchStopOut(BaseModel):
    id: int
    batch_id: int
    stop_type: str
    sequence: int
    location_name: str
    latitude: Optional[Decimal] = None
    longitude: Optional[Decimal] = None
    cargo_kg: Decimal
    order_id: Optional[int] = None
    customer_name: Optional[str] = None
    notes: Optional[str] = None
    status: str

    class Config:
        from_attributes = True


class OrderFulfillmentItemOut(BaseModel):
    id: int
    order_id: int
    order_item_id: int
    warehouse_name: str
    warehouse_code: str
    warehouse_district: str
    warehouse_latitude: Optional[Decimal] = None
    warehouse_longitude: Optional[Decimal] = None
    quantity: Decimal
    status: str
    batch_id: Optional[int] = None
    available_from: Optional[date] = None

    class Config:
        from_attributes = True


class DeliveryBatchOut(BaseModel):
    id: int
    batch_code: str
    delivery_area: str
    total_quantity_kg: Decimal
    total_orders_count: int
    total_customers_count: int
    required_vehicle_capacity_kg: Decimal
    estimated_distance_km: Optional[Decimal] = None
    estimated_logistics_cost: Optional[Decimal] = None
    status: str
    assigned_transporter_id: Optional[int] = None
    assigned_vehicle_id: Optional[int] = None
    assigned_transporter: Optional[TransporterProfileOut] = None
    assigned_vehicle: Optional[VehicleOut] = None
    pickup_deadline: Optional[datetime] = None
    delivery_deadline: Optional[datetime] = None
    earliest_available_date: Optional[date] = None
    in_transit_at: Optional[datetime] = None
    estimated_transit_minutes: Optional[int] = None
    created_at: datetime
    stops: List[BatchStopOut] = []
    fulfillment_items: List[OrderFulfillmentItemOut] = []
    vehicle_category: Optional[str] = None
    minimum_dispatch_weight: Optional[float] = None
    fill_percentage: Optional[float] = None
    dispatch_eligible: Optional[bool] = None

    class Config:
        from_attributes = True


class BatchAdminStatsOut(BaseModel):
    total_batches: int = 0
    delivered_batches: int = 0
    total_weight_kg: float = 0.0
    total_customers_served: int = 0
    pending_batches: int = 0
    transporter_assignments: int = 0
    active_transport_jobs: int = 0
    completed_deliveries: int = 0
    unassigned_batches: int = 0
    failed_deliveries: int = 0
    warehouse_pickup_locations: List[str] = []
    delivery_areas: List[str] = []
    total_orders_in_batches: int = 0
    total_cargo_transported_kg: float = 0.0


# ---------- Reviews & Feedback ----------
class ReviewCreate(BaseModel):
    order_id: int
    listing_id: Optional[int] = None
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = None
    image_url: Optional[str] = None


class ReviewOut(BaseModel):
    id: int
    order_id: int
    buyer_id: int
    buyer_name: Optional[str] = None
    farmer_id: Optional[int] = None
    farmer_name: Optional[str] = None
    listing_id: Optional[int] = None
    product_id: Optional[int] = None
    product_name: Optional[str] = None
    rating: int
    comment: Optional[str] = None
    image_url: Optional[str] = None
    is_waste_reported: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


class RatingSummaryOut(BaseModel):
    average_rating: float = 0.0
    total_reviews: int = 0
    rating_breakdown: dict = {}
    waste_reports_count: int = 0
    reviews: List[ReviewOut] = []


# ---------- Voice Assistant & AI Logistics Schemas ----------
class VoiceInteractIn(BaseModel):
    user_prompt: str
    conversation_history: Optional[List[Dict[str, str]]] = None
    language: Optional[str] = "en"


class VoiceInteractOut(BaseModel):
    response_text: str
    language: str = "en"
    user_role: str
    actions_executed: List[Dict[str, Any]] = []
    timestamp: str


class RouteExplainIn(BaseModel):
    route_plan: Dict[str, Any]



