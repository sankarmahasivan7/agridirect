import os
import re
import uuid
import base64
from typing import Optional, List
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.core.deps import require_role, get_current_user
from app.models.models import (
    User, RoleEnum, Order, OrderItem, ProductListing, Product,
    FarmerProfile, BuyerProfile, Review, Notification, OrderStatusEnum
)
from app.schemas.schemas import ReviewOut, RatingSummaryOut

router = APIRouter(prefix="/api/reviews", tags=["reviews"])

# Root static uploads directory for review images
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
UPLOAD_DIR = os.path.join(BASE_DIR, "static", "uploads", "reviews")
os.makedirs(UPLOAD_DIR, exist_ok=True)


def _serialize_review(r: Review) -> ReviewOut:
    return ReviewOut(
        id=r.id,
        order_id=r.order_id,
        buyer_id=r.buyer_id,
        buyer_name=r.buyer.full_name if r.buyer else "Verified Buyer",
        farmer_id=r.farmer_id,
        farmer_name=r.farmer.full_name if r.farmer else "Direct Producer",
        listing_id=r.listing_id,
        product_id=r.product_id,
        product_name=r.product_name or (r.product.name if r.product else "Produce Item"),
        rating=r.rating,
        comment=r.comment,
        image_url=r.image_url,
        is_waste_reported=bool(r.is_waste_reported),
        created_at=r.created_at,
    )


def _build_summary(reviews: List[Review]) -> RatingSummaryOut:
    if not reviews:
        return RatingSummaryOut(
            average_rating=0.0,
            total_reviews=0,
            rating_breakdown={1: 0, 2: 0, 3: 0, 4: 0, 5: 0},
            waste_reports_count=0,
            reviews=[],
        )

    breakdown = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    waste_count = 0
    total_stars = 0

    for r in reviews:
        stars = max(1, min(5, int(r.rating)))
        breakdown[stars] = breakdown.get(stars, 0) + 1
        total_stars += stars
        if r.is_waste_reported:
            waste_count += 1

    avg_rating = round(total_stars / len(reviews), 1)
    serialized = [_serialize_review(r) for r in sorted(reviews, key=lambda x: x.created_at, reverse=True)]

    return RatingSummaryOut(
        average_rating=avg_rating,
        total_reviews=len(reviews),
        rating_breakdown=breakdown,
        waste_reports_count=waste_count,
        reviews=serialized,
    )


@router.post("", response_model=ReviewOut, status_code=status.HTTP_201_CREATED)
async def submit_review(
    order_id: int = Form(...),
    rating: int = Form(...),
    listing_id: Optional[int] = Form(None),
    comment: Optional[str] = Form(None),
    image_url: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    user: User = Depends(require_role(RoleEnum.buyer)),
):
    """
    Buyer submits feedback and a 1-5 star rating for an order or specific produce item.
    Supports uploading a photo of the received vegetables (e.g. proof of waste or freshness).
    """
    if rating < 1 or rating > 5:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Rating must be between 1 and 5 stars.")

    order = (
        db.query(Order)
        .options(joinedload(Order.items).joinedload(OrderItem.listing).joinedload(ProductListing.product))
        .filter(Order.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Order #{order_id} not found.")

    if order.buyer_id != user.buyer_profile.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only review your own orders.")

    if order.status == OrderStatusEnum.CANCELLED:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot review a cancelled order.")

    # Locate the target order item
    selected_item = None
    if listing_id is not None:
        for item in order.items:
            if item.listing_id == listing_id:
                selected_item = item
                break
    if not selected_item and order.items:
        selected_item = order.items[0]

    if not selected_item:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No items found in this order to review.")

    listing = selected_item.listing
    farmer_id = listing.farmer_id if listing else None
    product_id = listing.product_id if listing else None
    product_name = listing.product.name if listing and listing.product else "Farm Produce"

    # Handle image upload if provided
    saved_image_url = image_url
    if image and image.filename:
        ext = os.path.splitext(image.filename)[1].lower()
        if ext not in [".jpg", ".jpeg", ".png", ".webp"]:
            ext = ".jpg"
        unique_name = f"review_ord{order_id}_{uuid.uuid4().hex[:8]}{ext}"
        target_path = os.path.join(UPLOAD_DIR, unique_name)
        
        contents = await image.read()
        if len(contents) > 10 * 1024 * 1024:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Image file too large (max 10MB).")
        
        with open(target_path, "wb") as f:
            f.write(contents)
        saved_image_url = f"/static/uploads/reviews/{unique_name}"
    elif image_url and image_url.startswith("data:image/"):
        try:
            header, encoded = image_url.split(",", 1)
            ext = ".jpg"
            if "png" in header:
                ext = ".png"
            elif "webp" in header:
                ext = ".webp"
            img_bytes = base64.b64decode(encoded)
            unique_name = f"review_ord{order_id}_{uuid.uuid4().hex[:8]}{ext}"
            target_path = os.path.join(UPLOAD_DIR, unique_name)
            with open(target_path, "wb") as f:
                f.write(img_bytes)
            saved_image_url = f"/static/uploads/reviews/{unique_name}"
        except Exception:
            pass  # keep image_url as is if decoding fails

    # Determine if waste / bad quality is reported
    is_waste = (rating <= 2)
    if not is_waste and comment:
        waste_pattern = r"\b(waste|rotten|rotting|rot|bad|damaged|damage|spoiled|spoil|spoiling|decay|decayed|ruined|garbage|rubbish)\b"
        if re.search(waste_pattern, comment, re.IGNORECASE):
            is_waste = True

    # Check if a review already exists for this order and listing
    existing_review = (
        db.query(Review)
        .filter(
            Review.order_id == order_id,
            Review.buyer_id == user.buyer_profile.id,
            Review.listing_id == (listing.id if listing else None),
        )
        .first()
    )

    if existing_review:
        existing_review.rating = rating
        existing_review.comment = comment
        if saved_image_url:
            existing_review.image_url = saved_image_url
        existing_review.is_waste_reported = is_waste
        review_obj = existing_review
    else:
        review_obj = Review(
            order_id=order.id,
            buyer_id=user.buyer_profile.id,
            farmer_id=farmer_id,
            listing_id=listing.id if listing else None,
            product_id=product_id,
            product_name=product_name,
            rating=rating,
            comment=comment,
            image_url=saved_image_url,
            is_waste_reported=is_waste,
        )
        db.add(review_obj)

    db.flush()

    # If waste or low rating was reported, notify the farmer immediately
    if is_waste and farmer_id:
        farmer_prof = db.query(FarmerProfile).filter(FarmerProfile.id == farmer_id).first()
        if farmer_prof and farmer_prof.user_id:
            photo_note = " Photo evidence was uploaded by the buyer." if saved_image_url else ""
            db.add(Notification(
                user_id=farmer_prof.user_id,
                title="⚠️ Produce Quality Alert Reported",
                message=f"Buyer {user.buyer_profile.full_name} reported an issue with {product_name} (Rating: {rating}/5) for Order #{order_id}.{photo_note} Please inspect your harvest quality.",
                notification_type="QUALITY_ALERT",
                link="/farmer/dashboard",
            ))

    db.commit()
    db.refresh(review_obj)
    return _serialize_review(review_obj)


@router.get("/order/{order_id}", response_model=List[ReviewOut])
def get_order_reviews(
    order_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Returns reviews associated with a specific order."""
    reviews = (
        db.query(Review)
        .options(joinedload(Review.buyer), joinedload(Review.farmer), joinedload(Review.product))
        .filter(Review.order_id == order_id)
        .all()
    )
    return [_serialize_review(r) for r in reviews]


@router.get("/farmer/{farmer_id}", response_model=RatingSummaryOut)
def get_farmer_reviews(farmer_id: int, db: Session = Depends(get_db)):
    """Returns the rating summary and list of customer reviews for a farmer."""
    reviews = (
        db.query(Review)
        .options(joinedload(Review.buyer), joinedload(Review.farmer), joinedload(Review.product))
        .filter(Review.farmer_id == farmer_id)
        .all()
    )
    return _build_summary(reviews)


@router.get("/farmer-summary", response_model=RatingSummaryOut)
def get_farmer_own_reviews(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(RoleEnum.farmer)),
):
    """Farmer dashboard endpoint to view all customer reviews and ratings."""
    farmer_id = user.farmer_profile.id
    reviews = (
        db.query(Review)
        .options(joinedload(Review.buyer), joinedload(Review.farmer), joinedload(Review.product))
        .filter(Review.farmer_id == farmer_id)
        .all()
    )
    return _build_summary(reviews)


@router.get("/listing/{listing_id}", response_model=RatingSummaryOut)
def get_listing_reviews(listing_id: int, db: Session = Depends(get_db)):
    """Returns customer reviews and rating for a specific listing or farmer product."""
    listing = db.query(ProductListing).filter(ProductListing.id == listing_id).first()
    if not listing:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Listing not found.")

    # Match reviews for this listing directly, or for the same product & farmer
    query = db.query(Review).options(
        joinedload(Review.buyer), joinedload(Review.farmer), joinedload(Review.product)
    )
    if listing.farmer_id:
        query = query.filter(
            (Review.listing_id == listing_id) |
            ((Review.farmer_id == listing.farmer_id) & (Review.product_id == listing.product_id))
        )
    else:
        query = query.filter(Review.listing_id == listing_id)

    reviews = query.all()
    return _build_summary(reviews)


@router.get("/product/{product_id}", response_model=RatingSummaryOut)
def get_product_reviews(product_id: int, db: Session = Depends(get_db)):
    """Returns all reviews for a product across all farmers."""
    reviews = (
        db.query(Review)
        .options(joinedload(Review.buyer), joinedload(Review.farmer), joinedload(Review.product))
        .filter(Review.product_id == product_id)
        .all()
    )
    return _build_summary(reviews)


@router.get("/mine", response_model=List[ReviewOut])
def get_buyer_reviews(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(RoleEnum.buyer)),
):
    """Returns all reviews submitted by the logged-in buyer."""
    reviews = (
        db.query(Review)
        .options(joinedload(Review.buyer), joinedload(Review.farmer), joinedload(Review.product))
        .filter(Review.buyer_id == user.buyer_profile.id)
        .order_by(Review.created_at.desc())
        .all()
    )
    return [_serialize_review(r) for r in reviews]
