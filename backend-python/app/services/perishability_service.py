from datetime import date, timedelta
from typing import Dict, Any, Optional

from sqlalchemy.orm import Session
from app.models.models import ProductListing, Notification


def check_and_notify_perishability(db: Session, listing: ProductListing) -> Optional[str]:
    """
    Checks if a product listing is approaching its sell-by date.
    If status is SELL SOON, URGENT, or CRITICAL, generates a database notification
    for the farmer or FPO so they can take action (e.g. price discount, channel routing).
    """
    status = listing.calculate_perishability_status()
    if status not in ["SELL SOON", "URGENT", "CRITICAL"]:
        return status

    user_id = None
    if listing.farmer:
        user_id = listing.farmer.user_id
    elif listing.fpo:
        user_id = listing.fpo.user_id
    elif listing.farmer_id:
        from app.models.models import FarmerProfile
        farmer = db.query(FarmerProfile).filter(FarmerProfile.id == listing.farmer_id).first()
        if farmer:
            user_id = farmer.user_id
    elif listing.fpo_id:
        from app.models.models import FPOProfile
        fpo = db.query(FPOProfile).filter(FPOProfile.id == listing.fpo_id).first()
        if fpo:
            user_id = fpo.user_id

    if not user_id:
        return status

    # Avoid duplicate unread alerts for the same listing and status
    alert_title = f"Perishability Alert: {listing.product.name if listing.product else 'Produce'} ({status})"
    existing = db.query(Notification).filter(
        Notification.user_id == user_id,
        Notification.title == alert_title,
        Notification.is_read == False,
    ).first()

    if not existing:
        sell_by = listing.get_expected_sell_by_date()
        sell_by_str = sell_by.strftime("%d %b %Y") if sell_by else "soon"
        storage = listing.storage_requirement or "Standard Storage"
        prod_name = listing.product.name if listing.product else "Produce"
        db.add(Notification(
            user_id=user_id,
            title=alert_title,
            message=(
                f"Your batch of {listing.quantity_available:g} {listing.unit} {prod_name} is {status}. "
                f"Expected sell-by date: {sell_by_str} under {storage}. "
                f"Action recommended: Offer discount to local restaurants or food processors to reduce avoidable waste."
            ),
        ))
        db.commit()

    return status


def get_perishability_ai_recommendation(listing: ProductListing) -> Dict[str, Any]:
    """
    Generates actionable recommendations for faster selling and food waste reduction.
    Never claims zero food waste; explicitly focuses on reducing avoidable waste.
    """
    status = listing.calculate_perishability_status()
    sell_by = listing.get_expected_sell_by_date()
    days_left = (sell_by - date.today()).days if sell_by else None

    if status == "CRITICAL":
        discount = 30
        channels = ["Food Processors", "Commercial Kitchens", "Local Restaurants"]
        rec = "Critical window: Offer 30% clearance discount immediately. Route to industrial food processors or restaurants with daily batch consumption."
    elif status == "URGENT":
        discount = 20
        channels = ["Local Restaurants", "Retailers", "Bulk Caterers"]
        rec = "Urgent: 20% discount recommended. Prioritize nearby buyers within 25 km to minimize transit spoilage."
    elif status == "SELL SOON":
        discount = 10
        channels = ["Supermarkets", "Restaurants", "Direct Consumers"]
        rec = "Approaching sell-by date: 10% promotional discount recommended to accelerate turnover."
    elif status == "EXPIRED":
        discount = 0
        channels = []
        rec = "Safety Cutoff Reached: Batch is past sell-by date. In accordance with safety regulations, this batch is delisted from human food channels."
    else:
        discount = 0
        channels = ["Direct Consumers", "Retailers", "Restaurants", "Processors"]
        rec = "Produce is fresh and within optimal shelf-life window. Standard market pricing recommended."

    return {
        "status": status,
        "sell_by_date": sell_by.isoformat() if sell_by else None,
        "days_remaining": days_left,
        "recommended_discount_percent": discount,
        "recommended_action": rec,
        "eligible_channels": channels,
        "goal": "Reduce avoidable post-harvest food waste through timely market intervention.",
    }
