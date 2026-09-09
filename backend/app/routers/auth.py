from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import hash_password, verify_password, create_access_token
from app.core.deps import get_current_user
from app.core.constants import normalize_district, get_district_warehouse, SUPPORTED_DISTRICTS
from app.models.models import (
    User, FarmerProfile, FPOProfile, BuyerProfile, TransporterProfile, Vehicle, RoleEnum
)
from app.schemas.schemas import (
    FarmerRegister, FPORegister, BuyerRegister, TransporterRegister, LoginRequest, TokenResponse
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _ensure_email_free(db: Session, email: str):
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Email already registered")


def _validate_district(raw_district: str | None) -> str:
    try:
        return normalize_district(raw_district)
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/register/farmer", response_model=TokenResponse, status_code=201)
def register_farmer(payload: FarmerRegister, db: Session = Depends(get_db)):
    _ensure_email_free(db, payload.email)
    district = _validate_district(payload.district)
    user = User(email=payload.email, phone=payload.phone,
                hashed_password=hash_password(payload.password), role=RoleEnum.farmer)
    db.add(user)
    db.flush()
    profile = FarmerProfile(
        user_id=user.id, full_name=payload.full_name, village_town=payload.village_town,
        district=district, state=payload.state, farm_location=payload.farm_location,
        farm_size_acres=payload.farm_size_acres,
        farm_latitude=payload.farm_latitude, farm_longitude=payload.farm_longitude,
    )
    db.add(profile)
    db.commit()
    wh = get_district_warehouse(district)
    token = create_access_token(subject=str(user.id), role=user.role.value)
    return TokenResponse(
        access_token=token, role=user.role, user_id=user.id,
        district=district, warehouse_name=wh["warehouse_name"]
    )


@router.post("/register/fpo", response_model=TokenResponse, status_code=201)
def register_fpo(payload: FPORegister, db: Session = Depends(get_db)):
    _ensure_email_free(db, payload.email)
    district = _validate_district(payload.district or payload.location)
    user = User(email=payload.email, phone=payload.phone,
                hashed_password=hash_password(payload.password), role=RoleEnum.fpo)
    db.add(user)
    db.flush()
    profile = FPOProfile(
        user_id=user.id, organization_name=payload.organization_name,
        registration_number=payload.registration_number, location=payload.location,
        district=district, member_count=payload.member_count or 0,
        latitude=payload.latitude, longitude=payload.longitude,
    )
    db.add(profile)
    db.commit()
    wh = get_district_warehouse(district)
    token = create_access_token(subject=str(user.id), role=user.role.value)
    return TokenResponse(
        access_token=token, role=user.role, user_id=user.id,
        district=district, warehouse_name=wh["warehouse_name"]
    )


@router.post("/register/buyer", response_model=TokenResponse, status_code=201)
def register_buyer(payload: BuyerRegister, db: Session = Depends(get_db)):
    _ensure_email_free(db, payload.email)
    district = _validate_district(payload.district or payload.location)
    user = User(email=payload.email, phone=payload.phone,
                hashed_password=hash_password(payload.password), role=RoleEnum.buyer)
    db.add(user)
    db.flush()
    profile = BuyerProfile(
        user_id=user.id, full_name=payload.full_name, business_name=payload.business_name,
        buyer_type=payload.buyer_type, location=payload.location, district=district,
        default_latitude=payload.default_latitude, default_longitude=payload.default_longitude,
    )
    db.add(profile)
    db.commit()
    wh = get_district_warehouse(district)
    token = create_access_token(subject=str(user.id), role=user.role.value)
    return TokenResponse(
        access_token=token, role=user.role, user_id=user.id,
        district=district, warehouse_name=wh["warehouse_name"]
    )


@router.post("/register/transporter", response_model=TokenResponse, status_code=201)
def register_transporter(payload: TransporterRegister, db: Session = Depends(get_db)):
    """
    Registers a transporter AND their single vehicle in one step -- a
    transporter without a vehicle can't be assigned any real transport
    requests, so there's no useful "vehicle-less" transporter account.
    """
    _ensure_email_free(db, payload.email)
    district = _validate_district(payload.district or payload.base_location)
    user = User(email=payload.email, phone=payload.phone,
                hashed_password=hash_password(payload.password), role=RoleEnum.transporter)
    db.add(user)
    db.flush()
    profile = TransporterProfile(
        user_id=user.id, full_name=payload.full_name,
        license_number=payload.license_number, base_location=payload.base_location,
        district=district,
        base_latitude=payload.base_latitude, base_longitude=payload.base_longitude,
    )
    db.add(profile)
    db.flush()
    v_type = payload.vehicle_type or "Mini Truck"
    cap_kg = float(payload.capacity_kg)
    if any(k in v_type.lower() or k in (payload.vehicle_name or "").lower() for k in ("bike", "two-wheeler", "2-wheeler", "motorcycle", "scooter", "two wheeler")):
        cap_kg = min(cap_kg, 50.0)

    vehicle = Vehicle(
        transporter_id=profile.id, name=payload.vehicle_name,
        vehicle_number=payload.vehicle_number, vehicle_type=v_type,
        capacity_kg=cap_kg,
        current_latitude=payload.base_latitude,
        current_longitude=payload.base_longitude,
        location_label=payload.base_location,
        location_updated_at=datetime.utcnow(),
    )
    db.add(vehicle)
    db.commit()
    wh = get_district_warehouse(district)
    token = create_access_token(subject=str(user.id), role=user.role.value)
    return TokenResponse(
        access_token=token, role=user.role, user_id=user.id,
        district=district, warehouse_name=wh["warehouse_name"]
    )


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """
    Shared authentication service, but the frontend enforces role-specific
    login pages/routes (spec section 4). We also verify the role claimed by
    the login page matches the user's actual role, so a buyer account can't
    be used on the farmer login page, etc.
    """
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    if user.role != payload.role:
        raise HTTPException(status.HTTP_403_FORBIDDEN, f"This account is not registered as a {payload.role.value}")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account has been deactivated")

    # Resolve user's district and district warehouse if registered
    user_district = None
    if user.farmer_profile and user.farmer_profile.district:
        user_district = user.farmer_profile.district
    elif user.buyer_profile and user.buyer_profile.district:
        user_district = user.buyer_profile.district
    elif user.fpo_profile and user.fpo_profile.district:
        user_district = user.fpo_profile.district
    elif user.transporter_profile and user.transporter_profile.district:
        user_district = user.transporter_profile.district

    wh = get_district_warehouse(user_district) if user_district else None
    wh_name = wh["warehouse_name"] if wh else None

    token = create_access_token(subject=str(user.id), role=user.role.value)
    return TokenResponse(
        access_token=token, role=user.role, user_id=user.id,
        district=user_district, warehouse_name=wh_name
    )


@router.get("/me")
def get_current_user_profile(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Returns the authenticated user's profile, registered district, warehouse, and coordinates."""
    data = {
        "id": user.id,
        "email": user.email,
        "phone": user.phone,
        "role": user.role,
        "district": None,
        "warehouse_name": None,
        "location": None,
        "default_latitude": None,
        "default_longitude": None,
        "full_name": None,
    }
    if user.buyer_profile:
        bp = user.buyer_profile
        wh = get_district_warehouse(bp.district, bp.location)
        data.update({
            "district": bp.district,
            "warehouse_name": wh["warehouse_name"] if wh else None,
            "location": bp.location,
            "default_latitude": float(bp.default_latitude) if bp.default_latitude is not None else None,
            "default_longitude": float(bp.default_longitude) if bp.default_longitude is not None else None,
            "full_name": bp.full_name,
            "buyer_type": bp.buyer_type,
        })
    elif user.farmer_profile:
        fp = user.farmer_profile
        wh = get_district_warehouse(fp.district, fp.farm_location)
        data.update({
            "district": fp.district,
            "warehouse_name": wh["warehouse_name"] if wh else None,
            "location": fp.farm_location or fp.village_town,
            "default_latitude": float(fp.farm_latitude) if fp.farm_latitude is not None else None,
            "default_longitude": float(fp.farm_longitude) if fp.farm_longitude is not None else None,
            "full_name": fp.full_name,
        })
    elif user.transporter_profile:
        tp = user.transporter_profile
        wh = get_district_warehouse(tp.district, tp.base_location)
        data.update({
            "district": tp.district,
            "warehouse_name": wh["warehouse_name"] if wh else None,
            "location": tp.base_location,
            "default_latitude": float(tp.base_latitude) if tp.base_latitude is not None else None,
            "default_longitude": float(tp.base_longitude) if tp.base_longitude is not None else None,
            "full_name": tp.full_name,
        })
    elif user.fpo_profile:
        fpo = user.fpo_profile
        wh = get_district_warehouse(fpo.district, fpo.location)
        data.update({
            "district": fpo.district,
            "warehouse_name": wh["warehouse_name"] if wh else None,
            "location": fpo.location,
            "full_name": fpo.organization_name,
        })
    return data
