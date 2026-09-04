from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.core.deps import get_current_user, require_role
from app.models.models import (
    User, RoleEnum, ProductListing, Product, Category, FarmerProfile, FPOProfile
)
from app.schemas.schemas import ListingCreate, ListingUpdate, ListingOut

router = APIRouter(prefix="/api/listings", tags=["listings"])


def _get_or_create_product(db: Session, product_name: str, category_name: str, unit: str) -> Product:
    category = db.query(Category).filter(Category.name == category_name).first()
    if not category:
        category = Category(name=category_name)
        db.add(category)
        db.flush()
    product = db.query(Product).filter(
        Product.name == product_name, Product.category_id == category.id
    ).first()
    if not product:
        product = Product(name=product_name, category_id=category.id, default_unit=unit)
        db.add(product)
        db.flush()
    return product


def _serialize(listing: ProductListing) -> ListingOut:
    return ListingOut(
        id=listing.id,
        product_name=listing.product.name,
        category_name=listing.product.category.name,
        farmer_name=listing.farmer.full_name if listing.farmer else None,
        fpo_name=listing.fpo.organization_name if listing.fpo else None,
        quantity_available=listing.quantity_available,
        unit=listing.unit,
        price_per_unit=listing.price_per_unit,
        quality_grade=listing.quality_grade,
        harvest_date=listing.harvest_date,
        available_from=listing.available_from,
        available_until=listing.available_until,
        location=listing.location,
        min_order_quantity=listing.min_order_quantity,
        is_perishable=listing.is_perishable,
        is_active=listing.is_active,
        created_at=listing.created_at,
    )


@router.post("", response_model=ListingOut, status_code=201)
def create_listing(
    payload: ListingCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(RoleEnum.farmer, RoleEnum.fpo)),
):
    """
    CRITICAL: whatever the farmer/FPO enters here is saved EXACTLY as entered
    (spec section 8). No transformation, no randomization of price/quantity.
    """
    product = _get_or_create_product(db, payload.product_name, payload.category_name, payload.unit)

    listing = ProductListing(
        product_id=product.id,
        quantity_available=payload.quantity_available,
        unit=payload.unit,
        price_per_unit=payload.price_per_unit,
        quality_grade=payload.quality_grade,
        harvest_date=payload.harvest_date,
        available_from=payload.available_from,
        available_until=payload.available_until,
        location=payload.location,
        min_order_quantity=payload.min_order_quantity or 0,
        is_perishable=payload.is_perishable,
        shelf_life_days=payload.shelf_life_days,
        storage_requirement=payload.storage_requirement,
        certification_info=payload.certification_info,
        image_url=payload.image_url,
    )
    if user.role == RoleEnum.farmer:
        listing.farmer_id = user.farmer_profile.id
    else:
        listing.fpo_id = user.fpo_profile.id

    db.add(listing)
    db.commit()
    db.refresh(listing)
    return _serialize(listing)


@router.get("/mine", response_model=list[ListingOut])
def my_listings(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(RoleEnum.farmer, RoleEnum.fpo)),
):
    q = db.query(ProductListing).options(
        joinedload(ProductListing.product).joinedload(Product.category),
        joinedload(ProductListing.farmer), joinedload(ProductListing.fpo),
    )
    if user.role == RoleEnum.farmer:
        q = q.filter(ProductListing.farmer_id == user.farmer_profile.id)
    else:
        q = q.filter(ProductListing.fpo_id == user.fpo_profile.id)
    return [_serialize(listing) for listing in q.order_by(ProductListing.created_at.desc()).all()]


def _get_owned_listing(db: Session, listing_id: int, user: User) -> ProductListing:
    listing = db.query(ProductListing).filter(ProductListing.id == listing_id).first()
    if not listing:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Listing not found")
    owns = (
        (user.role == RoleEnum.farmer and listing.farmer_id == user.farmer_profile.id) or
        (user.role == RoleEnum.fpo and listing.fpo_id == user.fpo_profile.id)
    )
    if not owns:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not own this listing")
    return listing


@router.put("/{listing_id}", response_model=ListingOut)
def update_listing(
    listing_id: int, payload: ListingUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(RoleEnum.farmer, RoleEnum.fpo)),
):
    listing = _get_owned_listing(db, listing_id, user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(listing, field, value)
    db.commit()
    db.refresh(listing)
    return _serialize(listing)


@router.delete("/{listing_id}", status_code=204)
def delete_listing(
    listing_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(RoleEnum.farmer, RoleEnum.fpo)),
):
    listing = _get_owned_listing(db, listing_id, user)
    db.delete(listing)
    db.commit()
