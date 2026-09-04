from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List

from pydantic import BaseModel, EmailStr, Field

from app.models.models import RoleEnum, BuyerTypeEnum, OrderStatusEnum


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
    default_latitude: Optional[Decimal] = None
    default_longitude: Optional[Decimal] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    role: RoleEnum


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: RoleEnum
    user_id: int


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
    storage_requirement: Optional[str] = None
    certification_info: Optional[str] = None
    image_url: Optional[str] = None


class ListingUpdate(BaseModel):
    quantity_available: Optional[Decimal] = None
    price_per_unit: Optional[Decimal] = None
    quality_grade: Optional[str] = None
    available_until: Optional[date] = None
    is_active: Optional[bool] = None


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
    is_active: bool
    created_at: datetime

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
    created_at: datetime
    items: List[OrderItemOut]

    class Config:
        from_attributes = True


# ---------- Bulk requirement ----------
class BulkRequirementCreate(BaseModel):
    product_name: str
    required_quantity: Decimal = Field(gt=0)
    unit: str = "kg"
    needed_by: Optional[date] = None
    delivery_location: Optional[str] = None


class MatchOut(BaseModel):
    listing_id: int
    farmer_or_fpo: str
    matched_quantity: Decimal
    price_per_unit: Decimal


class BulkMatchResult(BaseModel):
    requirement_id: int
    product_name: str
    required_quantity: Decimal
    matched_quantity: Decimal
    supply_gap: Decimal
    matches: List[MatchOut]


# ---------- AI ----------
class DemandForecastOut(BaseModel):
    product_name: str
    location: Optional[str]
    forecast_quantity: Decimal
    trend: str
    forecast_change_percent: Optional[float]
    mae: Optional[float]
    rmse: Optional[float]
    r2: Optional[float]
    note: Optional[str] = None


class PriceRecommendationOut(BaseModel):
    product_name: str
    actual_farmer_price: Optional[Decimal]
    recommended_min: Decimal
    recommended_max: Decimal
    reasoning: str


# ---------- Transport ----------
class TransporterRegister(BaseModel):
    full_name: str
    phone: str
    email: EmailStr
    password: str = Field(min_length=8)
    license_number: Optional[str] = None
    base_location: Optional[str] = None
    base_latitude: Optional[Decimal] = None
    base_longitude: Optional[Decimal] = None
    vehicle_name: str
    vehicle_number: str
    vehicle_type: str = "Mini Truck"
    capacity_kg: Decimal = Field(gt=0)


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
    in_transit_at: Optional[datetime] = None
    estimated_transit_minutes: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class LocationUpdate(BaseModel):
    latitude: Decimal
    longitude: Decimal
    location_label: Optional[str] = None
