from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import hash_password, verify_password, create_access_token
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


@router.post("/register/farmer", response_model=TokenResponse, status_code=201)
def register_farmer(payload: FarmerRegister, db: Session = Depends(get_db)):
    _ensure_email_free(db, payload.email)
    user = User(email=payload.email, phone=payload.phone,
                hashed_password=hash_password(payload.password), role=RoleEnum.farmer)
    db.add(user)
    db.flush()
    profile = FarmerProfile(
        user_id=user.id, full_name=payload.full_name, village_town=payload.village_town,
        district=payload.district, state=payload.state, farm_location=payload.farm_location,
        farm_size_acres=payload.farm_size_acres,
        farm_latitude=payload.farm_latitude, farm_longitude=payload.farm_longitude,
    )
    db.add(profile)
    db.commit()
    token = create_access_token(subject=str(user.id), role=user.role.value)
    return TokenResponse(access_token=token, role=user.role, user_id=user.id)


@router.post("/register/fpo", response_model=TokenResponse, status_code=201)
def register_fpo(payload: FPORegister, db: Session = Depends(get_db)):
    _ensure_email_free(db, payload.email)
    user = User(email=payload.email, phone=payload.phone,
                hashed_password=hash_password(payload.password), role=RoleEnum.fpo)
    db.add(user)
    db.flush()
    profile = FPOProfile(
        user_id=user.id, organization_name=payload.organization_name,
        registration_number=payload.registration_number, location=payload.location,
        member_count=payload.member_count or 0,
        latitude=payload.latitude, longitude=payload.longitude,
    )
    db.add(profile)
    db.commit()
    token = create_access_token(subject=str(user.id), role=user.role.value)
    return TokenResponse(access_token=token, role=user.role, user_id=user.id)


@router.post("/register/buyer", response_model=TokenResponse, status_code=201)
def register_buyer(payload: BuyerRegister, db: Session = Depends(get_db)):
    _ensure_email_free(db, payload.email)
    user = User(email=payload.email, phone=payload.phone,
                hashed_password=hash_password(payload.password), role=RoleEnum.buyer)
    db.add(user)
    db.flush()
    profile = BuyerProfile(
        user_id=user.id, full_name=payload.full_name, business_name=payload.business_name,
        buyer_type=payload.buyer_type, location=payload.location,
        default_latitude=payload.default_latitude, default_longitude=payload.default_longitude,
    )
    db.add(profile)
    db.commit()
    token = create_access_token(subject=str(user.id), role=user.role.value)
    return TokenResponse(access_token=token, role=user.role, user_id=user.id)


@router.post("/register/transporter", response_model=TokenResponse, status_code=201)
def register_transporter(payload: TransporterRegister, db: Session = Depends(get_db)):
    """
    Registers a transporter AND their single vehicle in one step -- a
    transporter without a vehicle can't be assigned any real transport
    requests, so there's no useful "vehicle-less" transporter account.
    """
    _ensure_email_free(db, payload.email)
    user = User(email=payload.email, phone=payload.phone,
                hashed_password=hash_password(payload.password), role=RoleEnum.transporter)
    db.add(user)
    db.flush()
    profile = TransporterProfile(
        user_id=user.id, full_name=payload.full_name,
        license_number=payload.license_number, base_location=payload.base_location,
        base_latitude=payload.base_latitude, base_longitude=payload.base_longitude,
    )
    db.add(profile)
    db.flush()
    vehicle = Vehicle(
        transporter_id=profile.id, name=payload.vehicle_name,
        vehicle_number=payload.vehicle_number, vehicle_type=payload.vehicle_type,
        capacity_kg=payload.capacity_kg,
    )
    db.add(vehicle)
    db.commit()
    token = create_access_token(subject=str(user.id), role=user.role.value)
    return TokenResponse(access_token=token, role=user.role, user_id=user.id)


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

    token = create_access_token(subject=str(user.id), role=user.role.value)
    return TokenResponse(access_token=token, role=user.role, user_id=user.id)
