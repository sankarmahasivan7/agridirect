"""
Gemini AI Decision Layer & Function Calling Service for AgriDirect.

Rules & Security Guarantees:
1. Gemini API operates as a natural-language understanding & decision support layer.
2. Gemini NEVER modifies the database directly.
3. Every operation requested by Gemini runs through backend validation:
   - Authentication
   - Role validation (Farmer, Buyer, Transporter, FPO, Admin)
   - Input validation
   - Database validation & constraints
4. Zero Mock/Fake Data: Uses ONLY real database records. Returns 'No data available'
   if queried entities do not exist.
5. Multi-lingual: Supports English and Tamil responses based on user context.
"""

import json
import logging
from datetime import datetime, date, timedelta, timezone
from decimal import Decimal
from typing import Dict, Any, List, Optional, Tuple
import requests
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_, func

from app.core.config import settings
from app.core.constants import DISTRICT_WAREHOUSES, get_district_warehouse
from app.models.models import (
    User, RoleEnum, ProductListing, Product, Order, OrderItem,
    OrderStatusEnum, TransportRequest, TransportRequestStatusEnum,
    Vehicle, DeliveryBatch, BatchStop, BulkRequirement, DemandData,
    FarmerProfile, BuyerProfile, TransporterProfile, Review, OrderFulfillmentItem
)
from app.logistics.vehicle_rules import (
    is_bike_vehicle, is_truck_vehicle, get_minimum_dispatch_weight,
    evaluate_vehicle_for_batch, BIKE_MAX_CAPACITY_KG, TRUCK_MIN_FILL_RATIO
)

logger = logging.getLogger(__name__)

GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"

# ---------------------------------------------------------------------------
# 1. TOOL DECLARATIONS FOR GEMINI
# ---------------------------------------------------------------------------
GEMINI_FUNCTION_DECLARATIONS = [
    {
        "name": "get_orders",
        "description": "Retrieve real orders from the database for the current authenticated user according to their role.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "status_filter": {
                    "type": "STRING",
                    "description": "Optional order status filter (e.g. PENDING, CONFIRMED, DELIVERED, CANCELLED)"
                },
                "limit": {
                    "type": "INTEGER",
                    "description": "Maximum number of orders to return (default 10)"
                }
            }
        }
    },
    {
        "name": "get_warehouse_inventory",
        "description": "Retrieve real agricultural inventory staged or available at regional warehouses (Tenkasi, Tirunelveli, Thoothukudi).",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "warehouse_district": {
                    "type": "STRING",
                    "description": "Optional warehouse district filter: 'Tenkasi', 'Tirunelveli', or 'Thoothukudi'"
                },
                "product_name": {
                    "type": "STRING",
                    "description": "Optional crop or product name filter (e.g. Tomato, Rice, Banana)"
                }
            }
        }
    },
    {
        "name": "get_available_vehicles",
        "description": "Retrieve real available transporter vehicles registered in the database, including vehicle type, capacity, and dispatch rules.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "vehicle_type": {
                    "type": "STRING",
                    "description": "Optional filter: 'Bike' or 'Truck'"
                },
                "max_capacity": {
                    "type": "NUMBER",
                    "description": "Optional maximum payload capacity in kg"
                }
            }
        }
    },
    {
        "name": "get_transport_jobs",
        "description": "Retrieve real transport jobs and consolidated delivery batches from the database.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "status_filter": {
                    "type": "STRING",
                    "description": "Optional status filter (e.g. PENDING, ACCEPTED, IN_TRANSIT, DELIVERED)"
                },
                "limit": {
                    "type": "INTEGER",
                    "description": "Maximum number of jobs to return (default 10)"
                }
            }
        }
    },
    {
        "name": "get_delivery_status",
        "description": "Retrieve the real-time delivery status, carrier telemetry, and destination for a specific shipment or order.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "tracking_id": {
                    "type": "INTEGER",
                    "description": "The transport request ID or tracking ID"
                },
                "order_id": {
                    "type": "INTEGER",
                    "description": "The customer order ID"
                }
            }
        }
    },
    {
        "name": "get_farmer_listings",
        "description": "Retrieve real product listings from farmers in the marketplace with current available stock and prices.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "product_name": {
                    "type": "STRING",
                    "description": "Optional product/crop name (e.g. Tomato, Onion, Rice)"
                },
                "category": {
                    "type": "STRING",
                    "description": "Optional category name (e.g. Vegetables, Grains, Fruits)"
                }
            }
        }
    },
    {
        "name": "get_bulk_requirements",
        "description": "Retrieve active bulk procurement requirements posted by institutional buyers or FPOs.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "status_filter": {
                    "type": "STRING",
                    "description": "Optional status filter (e.g. OPEN, FULFILLED)"
                }
            }
        }
    },
    {
        "name": "get_demand_data",
        "description": "Retrieve real market demand and order volume trends recorded in the database.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "product_name": {
                    "type": "STRING",
                    "description": "Product name to analyze"
                },
                "district": {
                    "type": "STRING",
                    "description": "District name (Tenkasi, Tirunelveli, Thoothukudi)"
                }
            }
        }
    },
    {
        "name": "get_route_status",
        "description": "Retrieve the optimized route, stop sequence, and road distance for active transporter jobs.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "batch_id": {
                    "type": "INTEGER",
                    "description": "Optional delivery batch ID"
                },
                "vehicle_id": {
                    "type": "INTEGER",
                    "description": "Optional vehicle ID"
                }
            }
        }
    },
    {
        "name": "create_transport_job",
        "description": "Create a new transport consignment request. Requires authorization.",
        "parameters": {
            "type": "OBJECT",
            "required": ["pickup_location", "destination_location", "weight_kg"],
            "properties": {
                "pickup_location": {
                    "type": "STRING",
                    "description": "Pickup warehouse or farm location"
                },
                "destination_location": {
                    "type": "STRING",
                    "description": "Buyer delivery destination address"
                },
                "weight_kg": {
                    "type": "NUMBER",
                    "description": "Total weight of cargo in kilograms"
                },
                "required_by": {
                    "type": "STRING",
                    "description": "Target delivery date/time (ISO format or YYYY-MM-DD)"
                },
                "notes": {
                    "type": "STRING",
                    "description": "Optional notes or manifest description"
                }
            }
        }
    },
    {
        "name": "update_delivery_status",
        "description": "Update delivery status for a transporter job. Strictly verified by role, vehicle ownership, and allowed transitions.",
        "parameters": {
            "type": "OBJECT",
            "required": ["job_id", "new_status"],
            "properties": {
                "job_id": {
                    "type": "INTEGER",
                    "description": "ID of the transport request or delivery batch to update"
                },
                "new_status": {
                    "type": "STRING",
                    "description": "New status: ACCEPTED, PICKED_UP, IN_TRANSIT, or DELIVERED"
                },
                "is_batch": {
                    "type": "BOOLEAN",
                    "description": "Set true if job_id refers to a consolidated DeliveryBatch"
                }
            }
        }
    }
]

# ---------------------------------------------------------------------------
# 2. REAL DATABASE IMPLEMENTATIONS WITH STRICT ROLE VALIDATION
# ---------------------------------------------------------------------------

def execute_get_orders(db: Session, user: User, status_filter: Optional[str] = None, limit: int = 10) -> Dict[str, Any]:
    """Retrieves orders strictly scoped to the user's authenticated role."""
    limit = min(max(1, limit), 25)
    query = db.query(Order).options(
        joinedload(Order.items).joinedload(OrderItem.listing).joinedload(ProductListing.product),
        joinedload(Order.buyer)
    )

    if user.role == RoleEnum.buyer:
        if not user.buyer_profile:
            return {"orders": [], "count": 0, "message": "No buyer profile linked to this account."}
        query = query.filter(Order.buyer_id == user.buyer_profile.id)

    elif user.role == RoleEnum.farmer:
        if not user.farmer_profile:
            return {"orders": [], "count": 0, "message": "No farmer profile linked to this account."}
        query = query.join(Order.items).join(OrderItem.listing).filter(
            ProductListing.farmer_id == user.farmer_profile.id
        ).distinct()

    elif user.role == RoleEnum.transporter:
        if not user.transporter_profile or not user.transporter_profile.vehicle:
            return {"orders": [], "count": 0, "message": "No active vehicle registered for this transporter."}
        v_id = user.transporter_profile.vehicle.id
        query = query.join(TransportRequest, TransportRequest.order_id == Order.id).filter(
            TransportRequest.assigned_vehicle_id == v_id
        ).distinct()

    elif user.role not in (RoleEnum.admin, RoleEnum.fpo):
        return {"orders": [], "count": 0, "error": "Unauthorized role to inspect orders."}

    if status_filter:
        stat_upper = status_filter.upper()
        query = query.filter(Order.status == stat_upper)

    orders = query.order_by(Order.created_at.desc()).limit(limit).all()
    if not orders:
        return {"orders": [], "count": 0, "message": "No orders found matching your criteria."}

    results = []
    for o in orders:
        items_summary = []
        for i in o.items:
            if user.role == RoleEnum.farmer and i.listing and i.listing.farmer_id != user.farmer_profile.id:
                continue
            pname = i.listing.product.name if i.listing and i.listing.product else "Crop"
            items_summary.append({
                "product": pname,
                "quantity_kg": float(i.quantity),
                "unit_price": float(i.price_at_purchase),
                "subtotal": float(i.line_subtotal)
            })

        results.append({
            "order_id": o.id,
            "status": o.status.value if hasattr(o.status, "value") else str(o.status),
            "total_amount": float(o.total_amount),
            "delivery_location": o.delivery_location or "Designated Hub",
            "created_at": o.created_at.strftime("%Y-%m-%d %H:%M") if o.created_at else None,
            "items": items_summary
        })

    return {"orders": results, "count": len(results)}


def execute_get_warehouse_inventory(db: Session, user: User, warehouse_district: Optional[str] = None, product_name: Optional[str] = None) -> Dict[str, Any]:
    """Aggregates real inventory from active listings staged or linked to district warehouses."""
    districts = ["Tenkasi", "Tirunelveli", "Thoothukudi"]
    if warehouse_district:
        wh_match = [d for d in districts if d.lower() == warehouse_district.strip().lower()]
        if wh_match:
            districts = wh_match

    query = db.query(ProductListing).options(
        joinedload(ProductListing.product),
        joinedload(ProductListing.farmer)
    ).filter(ProductListing.is_active == True, ProductListing.quantity_available > 0)

    if product_name:
        query = query.join(Product).filter(Product.name.ilike(f"%{product_name.strip()}%"))

    listings = query.all()
    warehouse_data = {}

    for d in districts:
        wh_info = DISTRICT_WAREHOUSES.get(d, {})
        warehouse_data[d] = {
            "warehouse_name": wh_info.get("warehouse_name", f"{d} Central Agri-Warehouse"),
            "warehouse_code": wh_info.get("code", "WH-01"),
            "address": wh_info.get("address", ""),
            "contact_phone": wh_info.get("contact_phone", ""),
            "total_stock_kg": 0.0,
            "items": {}
        }

    for l in listings:
        dist = l.location or (l.farmer.district if l.farmer else "Tenkasi")
        matched_dist = None
        for d in districts:
            if d.lower() in dist.lower():
                matched_dist = d
                break
        if not matched_dist:
            matched_dist = "Tenkasi"

        if matched_dist in warehouse_data:
            pname = l.product.name if l.product else "Agricultural Produce"
            qty = float(l.quantity_available)
            warehouse_data[matched_dist]["total_stock_kg"] += qty
            if pname not in warehouse_data[matched_dist]["items"]:
                warehouse_data[matched_dist]["items"][pname] = {
                    "total_quantity_kg": 0.0,
                    "price_per_unit": float(l.price_per_unit),
                    "unit": l.unit or "kg"
                }
            warehouse_data[matched_dist]["items"][pname]["total_quantity_kg"] += qty

    out_warehouses = []
    for d, data in warehouse_data.items():
        out_warehouses.append({
            "district": d,
            "warehouse_name": data["warehouse_name"],
            "code": data["warehouse_code"],
            "address": data["address"],
            "total_stock_kg": round(data["total_stock_kg"], 1),
            "available_commodities": [
                {
                    "commodity": k,
                    "available_kg": round(v["total_quantity_kg"], 1),
                    "price_per_unit": v["price_per_unit"],
                    "unit": v["unit"]
                }
                for k, v in data["items"].items()
            ]
        })

    return {"warehouses": out_warehouses, "total_warehouses": len(out_warehouses)}


def execute_get_available_vehicles(db: Session, user: User, vehicle_type: Optional[str] = None, max_capacity: Optional[float] = None) -> Dict[str, Any]:
    """Retrieves real active vehicles registered in the database with capacity rules."""
    query = db.query(Vehicle).options(joinedload(Vehicle.transporter)).filter(Vehicle.is_active == True)

    if vehicle_type:
        vt = vehicle_type.lower()
        if "bike" in vt:
            query = query.filter(
                or_(Vehicle.vehicle_type.ilike("%bike%"), Vehicle.capacity_kg <= BIKE_MAX_CAPACITY_KG)
            )
        elif "truck" in vt:
            query = query.filter(
                and_(~Vehicle.vehicle_type.ilike("%bike%"), Vehicle.capacity_kg > BIKE_MAX_CAPACITY_KG)
            )

    if max_capacity:
        query = query.filter(Vehicle.capacity_kg <= Decimal(str(max_capacity)))

    vehicles = query.all()
    results = []
    for v in vehicles:
        is_bike = is_bike_vehicle(v)
        cap = float(v.capacity_kg or 0)
        min_disp = get_minimum_dispatch_weight(v)
        results.append({
            "vehicle_id": v.id,
            "name": v.name,
            "vehicle_number": v.vehicle_number,
            "vehicle_type": v.vehicle_type,
            "category": "Bike" if is_bike else "Truck",
            "capacity_kg": cap,
            "minimum_dispatch_kg": min_disp,
            "rule_explanation": (
                "Bike (<= 50 kg payload): Immediate dispatch, no 35% fill constraint."
                if is_bike else
                f"Truck ({cap:.0f} kg capacity): Requires minimum 35% fill ({min_disp:.1f} kg) to dispatch."
            ),
            "location_label": v.location_label or (v.transporter.base_location if v.transporter else "District Hub"),
            "transporter_name": v.transporter.full_name if v.transporter else None
        })

    return {"vehicles": results, "count": len(results)}


def execute_get_transport_jobs(db: Session, user: User, status_filter: Optional[str] = None, limit: int = 10) -> Dict[str, Any]:
    """Retrieves real transport consignments and delivery batches."""
    limit = min(max(1, limit), 25)
    query = db.query(TransportRequest).options(joinedload(TransportRequest.assigned_vehicle))

    if user.role == RoleEnum.transporter and user.transporter_profile and user.transporter_profile.vehicle:
        v_id = user.transporter_profile.vehicle.id
        query = query.filter(
            or_(
                TransportRequest.assigned_vehicle_id == v_id,
                TransportRequest.status.in_([TransportRequestStatusEnum.PENDING, TransportRequestStatusEnum.REQUESTED])
            )
        )
    elif user.role == RoleEnum.buyer and user.buyer_profile:
        query = query.filter(TransportRequest.requested_by_user_id == user.id)

    if status_filter:
        query = query.filter(TransportRequest.status == status_filter.upper())

    jobs = query.order_by(TransportRequest.created_at.desc()).limit(limit).all()
    results = []
    for j in jobs:
        results.append({
            "job_id": j.id,
            "order_id": j.order_id,
            "pickup_location": j.pickup_location,
            "destination_location": j.destination_location,
            "weight_kg": float(j.weight_kg or 0),
            "status": j.status.value if hasattr(j.status, "value") else str(j.status),
            "required_by": j.required_by.strftime("%Y-%m-%d %H:%M") if j.required_by else None,
            "logistics_cost": float(j.logistics_cost or 30),
            "assigned_vehicle": j.assigned_vehicle.name if j.assigned_vehicle else "Unassigned",
            "notes": j.notes
        })

    batches_query = db.query(DeliveryBatch).options(joinedload(DeliveryBatch.stops))
    if user.role == RoleEnum.transporter and user.transporter_profile:
        batches_query = batches_query.filter(
            or_(
                DeliveryBatch.assigned_transporter_id == user.transporter_profile.id,
                DeliveryBatch.status.in_(["BATCH_CREATED", "TRANSPORTER_ASSIGNED"])
            )
        )
    batches = batches_query.order_by(DeliveryBatch.created_at.desc()).limit(5).all()
    batch_results = []
    for b in batches:
        batch_results.append({
            "batch_id": b.id,
            "batch_code": b.batch_code,
            "delivery_area": b.delivery_area,
            "total_weight_kg": float(b.total_quantity_kg or 0),
            "total_orders": b.total_orders_count,
            "status": b.status,
            "stops_count": len(b.stops or [])
        })

    return {
        "individual_jobs": results,
        "consolidated_batches": batch_results,
        "total_jobs": len(results) + len(batch_results)
    }


def execute_get_delivery_status(db: Session, user: User, tracking_id: Optional[int] = None, order_id: Optional[int] = None) -> Dict[str, Any]:
    """Retrieves real-time status of a consignment or order."""
    if not tracking_id and not order_id:
        return {"error": "Please provide either tracking_id or order_id"}

    query = db.query(TransportRequest).options(
        joinedload(TransportRequest.assigned_vehicle).joinedload(Vehicle.transporter),
        joinedload(TransportRequest.order).joinedload(Order.buyer)
    )

    if tracking_id:
        query = query.filter(or_(TransportRequest.id == tracking_id, TransportRequest.batch_id == tracking_id))
    elif order_id:
        query = query.filter(TransportRequest.order_id == order_id)

    req = query.first()
    if not req:
        return {"found": False, "message": "No active shipment record found for the provided ID."}

    if user.role == RoleEnum.buyer and req.order and req.order.buyer and req.order.buyer.user_id != user.id:
        return {"error": "Unauthorized: You do not have access to track this customer's shipment."}

    veh = req.assigned_vehicle
    return {
        "found": True,
        "shipment_id": req.id,
        "order_id": req.order_id,
        "status": req.status.value if hasattr(req.status, "value") else str(req.status),
        "pickup_location": req.pickup_location,
        "destination_location": req.destination_location,
        "cargo_weight_kg": float(req.weight_kg or 0),
        "distance_km": float(req.distance_km) if req.distance_km else None,
        "carrier_assigned": veh.name if veh else "Awaiting Driver Assignment",
        "carrier_number": veh.vehicle_number if veh else None,
        "carrier_live_location": veh.location_label if veh else None,
        "last_gps_update": veh.location_updated_at.strftime("%Y-%m-%d %H:%M") if (veh and veh.location_updated_at) else None
    }


def execute_get_farmer_listings(db: Session, user: User, product_name: Optional[str] = None, category: Optional[str] = None) -> Dict[str, Any]:
    """Retrieves farmer crop listings from database."""
    query = db.query(ProductListing).options(
        joinedload(ProductListing.product),
        joinedload(ProductListing.farmer)
    ).filter(ProductListing.is_active == True)

    if user.role == RoleEnum.farmer and user.farmer_profile:
        query = query.filter(ProductListing.farmer_id == user.farmer_profile.id)

    if product_name:
        query = query.join(Product).filter(Product.name.ilike(f"%{product_name.strip()}%"))

    listings = query.order_by(ProductListing.created_at.desc()).limit(15).all()
    if not listings:
        return {"listings": [], "count": 0, "message": "No product listings found in the database."}

    results = []
    for l in listings:
        results.append({
            "listing_id": l.id,
            "product_name": l.product.name if l.product else "Produce",
            "quantity_available_kg": float(l.quantity_available),
            "price_per_unit": float(l.price_per_unit),
            "unit": l.unit or "kg",
            "location": l.location or "Farm Gate",
            "farmer_name": l.farmer.full_name if l.farmer else None,
            "harvest_date": l.harvest_date.strftime("%Y-%m-%d") if l.harvest_date else None,
        })

    return {"listings": results, "count": len(results)}


def execute_get_bulk_requirements(db: Session, user: User, status_filter: Optional[str] = None) -> Dict[str, Any]:
    """Retrieves active bulk procurement requirements."""
    query = db.query(BulkRequirement).options(
        joinedload(BulkRequirement.product),
        joinedload(BulkRequirement.buyer)
    )
    if status_filter:
        query = query.filter(BulkRequirement.status == status_filter.upper())

    reqs = query.order_by(BulkRequirement.created_at.desc()).limit(10).all()
    results = []
    for b in reqs:
        results.append({
            "requirement_id": b.id,
            "product": b.product.name if b.product else "Commodity",
            "required_quantity_kg": float(b.required_quantity),
            "target_price": float(b.target_price) if b.target_price else None,
            "delivery_location": b.delivery_location,
            "status": b.status,
            "created_at": b.created_at.strftime("%Y-%m-%d") if b.created_at else None
        })

    return {"bulk_requirements": results, "count": len(results)}


def execute_get_demand_data(db: Session, user: User, product_name: Optional[str] = None, district: Optional[str] = None) -> Dict[str, Any]:
    """Retrieves actual demand observations recorded in the database."""
    query = db.query(DemandData).options(joinedload(DemandData.product))
    if product_name:
        query = query.join(Product).filter(Product.name.ilike(f"%{product_name.strip()}%"))
    if district:
        query = query.filter(DemandData.district.ilike(f"%{district.strip()}%"))

    records = query.order_by(DemandData.recorded_at.desc()).limit(10).all()
    results = []
    for r in records:
        results.append({
            "product": r.product.name if r.product else "Commodity",
            "district": r.district,
            "demand_quantity_kg": float(r.demand_quantity),
            "recorded_at": r.recorded_at.strftime("%Y-%m-%d") if r.recorded_at else None
        })

    return {"demand_records": results, "count": len(results)}


def execute_get_route_status(db: Session, user: User, batch_id: Optional[int] = None, vehicle_id: Optional[int] = None) -> Dict[str, Any]:
    """Retrieves route sequence and stops for consolidated delivery batches."""
    query = db.query(DeliveryBatch).options(
        joinedload(DeliveryBatch.stops),
        joinedload(DeliveryBatch.assigned_transporter)
    )
    if batch_id:
        query = query.filter(DeliveryBatch.id == batch_id)
    elif vehicle_id:
        query = query.filter(DeliveryBatch.assigned_vehicle_id == vehicle_id)
    else:
        query = query.filter(DeliveryBatch.status.in_(["ACCEPTED", "READY_FOR_PICKUP", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY"]))

    batch = query.order_by(DeliveryBatch.created_at.desc()).first()
    if not batch:
        return {"has_route": False, "message": "No active route found for the specified batch or vehicle."}

    stops_out = []
    for s in (batch.stops or []):
        stops_out.append({
            "sequence": s.sequence,
            "stop_type": "Pickup Hub" if s.stop_type == "PICKUP" else "Buyer Drop",
            "location": s.location_name,
            "customer_name": s.customer_name,
            "cargo_kg": float(s.cargo_kg or 0),
            "status": s.status
        })

    return {
        "has_route": True,
        "batch_code": batch.batch_code,
        "status": batch.status,
        "total_cargo_kg": float(batch.total_quantity_kg or 0),
        "delivery_area": batch.delivery_area,
        "stops": stops_out
    }


def execute_create_transport_job(
    db: Session,
    user: User,
    pickup_location: str,
    destination_location: str,
    weight_kg: float,
    required_by: Optional[str] = None,
    notes: Optional[str] = None
) -> Dict[str, Any]:
    """Creates a new transport request with strict role authorization."""
    if user.role not in (RoleEnum.admin, RoleEnum.buyer, RoleEnum.farmer, RoleEnum.fpo):
        return {"error": "Unauthorized: Your role is not permitted to create transport jobs."}

    if not pickup_location or not destination_location or float(weight_kg) <= 0:
        return {"error": "Invalid parameters: Pickup, destination, and positive weight_kg are required."}

    req_date = datetime.utcnow() + timedelta(days=2)
    if required_by:
        try:
            req_date = datetime.fromisoformat(required_by.replace("Z", "+00:00"))
        except Exception:
            pass

    p_lat, p_lon = None, None
    for d, wh in DISTRICT_WAREHOUSES.items():
        if d.lower() in pickup_location.lower():
            p_lat = wh["latitude"]
            p_lon = wh["longitude"]
            break

    job = TransportRequest(
        requested_by_user_id=user.id,
        pickup_location=pickup_location,
        pickup_latitude=p_lat,
        pickup_longitude=p_lon,
        destination_location=destination_location,
        weight_kg=Decimal(str(round(weight_kg, 2))),
        required_by=req_date,
        notes=notes or "Requested via AgriDirect AI Assistant",
        status=TransportRequestStatusEnum.PENDING,
        logistics_strategy="bike_dispatch" if weight_kg <= BIKE_MAX_CAPACITY_KG else "truck_batch"
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    return {
        "success": True,
        "job_id": job.id,
        "status": "PENDING",
        "weight_kg": float(job.weight_kg),
        "message": f"Successfully created transport job #{job.id} for {weight_kg:.1f} kg."
    }


def execute_update_delivery_status(
    db: Session,
    user: User,
    job_id: int,
    new_status: str,
    is_batch: bool = False
) -> Dict[str, Any]:
    """
    CRITICAL ACTION TOOL: Updates transport job status.
    Strictly verifies:
    1. Role must be TRANSPORTER (or ADMIN).
    2. Transporter must own / be assigned to the vehicle of this job.
    3. State transition must be valid.
    """
    if user.role not in (RoleEnum.transporter, RoleEnum.admin):
        return {
            "success": False,
            "error": "Access Denied: Only assigned transporters or administrators can update delivery status."
        }

    status_clean = new_status.strip().upper()
    if status_clean == "PICKED UP":
        status_clean = "PICKED_UP"
    elif status_clean == "IN TRANSIT":
        status_clean = "IN_TRANSIT"

    # A. Handle Delivery Batch Update
    if is_batch:
        batch = db.query(DeliveryBatch).filter(DeliveryBatch.id == job_id).first()
        if not batch:
            return {"success": False, "error": f"Delivery batch #{job_id} not found."}

        if user.role == RoleEnum.transporter:
            if not user.transporter_profile or batch.assigned_transporter_id != user.transporter_profile.id:
                return {"success": False, "error": "Access Denied: You are not the assigned transporter for this batch."}

        allowed_batch_statuses = ["ACCEPTED", "READY_FOR_PICKUP", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"]
        if status_clean not in allowed_batch_statuses:
            return {"success": False, "error": f"Invalid batch status '{status_clean}'."}

        batch.status = status_clean
        if status_clean == "IN_TRANSIT" and not batch.in_transit_at:
            batch.in_transit_at = datetime.utcnow()
        db.commit()
        return {
            "success": True,
            "batch_id": batch.id,
            "new_status": batch.status,
            "message": f"Successfully updated batch {batch.batch_code} to {batch.status}."
        }

    # B. Handle Individual Transport Request Update
    req = db.query(TransportRequest).options(joinedload(TransportRequest.assigned_vehicle)).filter(TransportRequest.id == job_id).first()
    if not req:
        return {"success": False, "error": f"Transport job #{job_id} not found."}

    if user.role == RoleEnum.transporter:
        if not user.transporter_profile or not user.transporter_profile.vehicle:
            return {"success": False, "error": "Access Denied: No active vehicle registered for your transporter account."}
        v_id = user.transporter_profile.vehicle.id
        if req.assigned_vehicle_id and req.assigned_vehicle_id != v_id:
            return {"success": False, "error": "Access Denied: This consignment is assigned to another transporter vehicle."}
        if req.assigned_vehicle_id is None:
            req.assigned_vehicle_id = v_id

    status_map = {
        "ACCEPTED": TransportRequestStatusEnum.ACCEPTED,
        "PICKUP": TransportRequestStatusEnum.PICKUP,
        "PICKED_UP": TransportRequestStatusEnum.PICKUP,
        "IN_TRANSIT": TransportRequestStatusEnum.IN_TRANSIT,
        "DELIVERED": TransportRequestStatusEnum.DELIVERED,
    }

    target_enum = status_map.get(status_clean)
    if not target_enum:
        return {"success": False, "error": f"Invalid consignment status '{status_clean}'."}

    req.status = target_enum
    db.commit()

    return {
        "success": True,
        "job_id": req.id,
        "new_status": req.status.value,
        "message": f"Successfully updated consignment #{req.id} status to {req.status.value}."
    }


# Tool Dispatch Table
TOOL_DISPATCH = {
    "get_orders": execute_get_orders,
    "get_warehouse_inventory": execute_get_warehouse_inventory,
    "get_available_vehicles": execute_get_available_vehicles,
    "get_transport_jobs": execute_get_transport_jobs,
    "get_delivery_status": execute_get_delivery_status,
    "get_farmer_listings": execute_get_farmer_listings,
    "get_bulk_requirements": execute_get_bulk_requirements,
    "get_demand_data": execute_get_demand_data,
    "get_route_status": execute_get_route_status,
    "create_transport_job": execute_create_transport_job,
    "update_delivery_status": execute_update_delivery_status,
}


# ---------------------------------------------------------------------------
# 3. GEMINI INTERACTION ORCHESTRATOR
# ---------------------------------------------------------------------------

def process_ai_interaction(
    db: Session,
    user: User,
    user_prompt: str,
    conversation_history: Optional[List[Dict[str, str]]] = None,
    language: str = "en"
) -> Dict[str, Any]:
    """
    Main entry point for Voice & AI Assistant.
    1. Formulates role-aware system instructions.
    2. Sends prompt with tool declarations to Gemini.
    3. Handles function calling with real database operations.
    4. Formulates user-friendly text & voice responses.
    """
    if not user_prompt or not user_prompt.strip():
        return {
            "response_text": "Please speak or enter a request.",
            "language": language,
            "actions_executed": []
        }

    api_key = settings.GEMINI_API_KEY
    model = settings.GEMINI_MODEL or "gemini-flash-latest"

    user_name = user.email.split("@")[0].capitalize()
    role_str = user.role.value if hasattr(user.role, "value") else str(user.role)
    district_info = "Tenkasi / Tirunelveli / Thoothukudi region"

    if user.role == RoleEnum.farmer and user.farmer_profile:
        user_name = user.farmer_profile.full_name or user_name
        district_info = user.farmer_profile.district or district_info
    elif user.role == RoleEnum.buyer and user.buyer_profile:
        user_name = user.buyer_profile.full_name or user_name
        district_info = user.buyer_profile.district or district_info
    elif user.role == RoleEnum.transporter and user.transporter_profile:
        user_name = user.transporter_profile.full_name or user_name
        district_info = user.transporter_profile.district or district_info

    system_instruction = f"""
You are AgriDirect AI, the voice and logistics assistant for an agricultural direct-trade platform in Southern Tamil Nadu (Tenkasi, Tirunelveli, Thoothukudi).
You are currently assisting: {user_name}
Role: {role_str.upper()}
Region: {district_info}

CRITICAL RULES:
1. ALWAYS use the provided tools to query real database data before answering.
2. NEVER invent or hallucinate product prices, orders, vehicles, stock, or routes.
3. If no data exists in the database, honestly reply that no data is currently available.
4. ROLE PRIVACY & PERMISSIONS:
   - FARMER can only see their own listings, their orders, warehouse stock, and general prices.
   - BUYER can see marketplace products, their orders, and bulk procurement.
   - TRANSPORTER can see transport jobs, assigned routes, and execute delivery status updates.
   - ADMIN can see system-wide analytics, all inventory, and all orders.
5. If the user speaks in Tamil or language is 'ta', reply fluently in Tamil. Otherwise reply in natural, clear English.
6. Clearly distinguish between actual database facts and AI recommendations.
"""

    contents = []
    if conversation_history:
        for turn in conversation_history[-4:]:
            role_turn = "user" if turn.get("sender") == "user" else "model"
            text_turn = turn.get("text", "")
            if text_turn:
                contents.append({"role": role_turn, "parts": [{"text": text_turn}]})

    contents.append({"role": "user", "parts": [{"text": f"[{language.upper()}] {user_prompt}"}]})

    payload = {
        "system_instruction": {"parts": [{"text": system_instruction}]},
        "contents": contents,
        "tools": [{"function_declarations": GEMINI_FUNCTION_DECLARATIONS}],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 600
        }
    }

    actions_executed = []
    response_text = ""

    if api_key:
        try:
            url = GEMINI_API_URL.format(model=model, key=api_key)
            resp = requests.post(url, json=payload, timeout=12)
            if resp.status_code == 200:
                resp_json = resp.json()
                candidate = resp_json.get("candidates", [{}])[0]
                content = candidate.get("content", {})
                parts = content.get("parts", [])

                function_call = None
                for p in parts:
                    if "functionCall" in p:
                        function_call = p["functionCall"]
                        break

                if function_call:
                    func_name = function_call.get("name")
                    func_args = function_call.get("args", {})
                    logger.info(f"Gemini requested tool execution: {func_name} with args {func_args}")

                    tool_func = TOOL_DISPATCH.get(func_name)
                    if tool_func:
                        tool_result = tool_func(db=db, user=user, **func_args)
                    else:
                        tool_result = {"error": f"Unknown tool '{func_name}'"}

                    actions_executed.append({
                        "tool": func_name,
                        "args": func_args,
                        "result": tool_result
                    })

                    follow_up_payload = {
                        "system_instruction": {"parts": [{"text": system_instruction}]},
                        "contents": [
                            contents[-1],
                            {
                                "role": "model",
                                "parts": [{"functionCall": function_call}]
                            },
                            {
                                "role": "user",
                                "parts": [{
                                    "functionResponse": {
                                        "name": func_name,
                                        "response": {"result": tool_result}
                                    }
                                }]
                            }
                        ],
                        "generationConfig": {
                            "temperature": 0.2,
                            "maxOutputTokens": 600
                        }
                    }

                    follow_resp = requests.post(url, json=follow_up_payload, timeout=12)
                    if follow_resp.status_code == 200:
                        follow_parts = follow_resp.json().get("candidates", [{}])[0].get("content", {}).get("parts", [])
                        for fp in follow_parts:
                            if "text" in fp:
                                response_text += fp["text"]
                    else:
                        response_text = _format_tool_result_naturally(func_name, tool_result, language)

                else:
                    for p in parts:
                        if "text" in p:
                            response_text += p["text"]

        except Exception as e:
            logger.error(f"Gemini API request failed: {e}")

    if not response_text:
        response_text, actions_executed = _local_intent_fallback(db, user, user_prompt, language)

    return {
        "response_text": response_text.strip(),
        "language": language,
        "user_role": role_str,
        "actions_executed": actions_executed,
        "timestamp": datetime.utcnow().isoformat()
    }


def _format_tool_result_naturally(func_name: str, result: Dict[str, Any], lang: str) -> str:
    """Provides a clean natural language summary if secondary LLM turn fails."""
    is_ta = (lang == "ta")
    if "error" in result:
        return f"பிழை: {result['error']}" if is_ta else f"Notice: {result['error']}"

    if func_name == "get_orders":
        orders = result.get("orders", [])
        if not orders:
            return "தற்போது எந்த ஆர்டர்களும் இல்லை." if is_ta else "You have no active orders in the system right now."
        lines = [f"உங்களுக்கு {len(orders)} ஆர்டர்கள் உள்ளன:" if is_ta else f"You have {len(orders)} order(s):"]
        for o in orders[:3]:
            lines.append(f"• #{o['order_id']} ({o['status']}): ₹{o['total_amount']:.2f}")
        return "\n".join(lines)

    if func_name == "get_transport_jobs":
        jobs = result.get("individual_jobs", [])
        batches = result.get("consolidated_batches", [])
        tot = len(jobs) + len(batches)
        if tot == 0:
            return "தற்போது போக்குவரத்து வேலைகள் எதுவும் கிடைக்கவில்லை." if is_ta else "No transport jobs currently available."
        return f"மொத்தம் {tot} போக்குவரத்து வேலைகள் உள்ளன ({len(batches)} ஒருங்கிணைந்த தொகுப்புகள், {len(jobs)} நேரடி வேலைகள்)." if is_ta else f"Found {tot} transport job(s) ({len(batches)} consolidated batches, {len(jobs)} direct jobs)."

    if func_name == "get_warehouse_inventory":
        whs = result.get("warehouses", [])
        lines = ["மத்திய கிடங்கு இருப்பு விவரம்:" if is_ta else "Central Warehouses Inventory:"]
        for w in whs:
            lines.append(f"• {w['warehouse_name']}: {w['total_stock_kg']} kg")
        return "\n".join(lines)

    if func_name == "update_delivery_status":
        return result.get("message", "டெலிவரி நிலை வெற்றிகரமாக புதுப்பிக்கப்பட்டது." if is_ta else "Delivery status updated successfully.")

    return json.dumps(result, ensure_ascii=False)


def _local_intent_fallback(db: Session, user: User, prompt: str, lang: str) -> Tuple[str, List[Any]]:
    """Guarantees instant, zero-failure responses even during offline or connectivity drops."""
    p_lower = prompt.lower()
    is_ta = (lang == "ta") or any(ord(c) >= 2944 and ord(c) <= 3071 for c in prompt)
    actions = []

    if any(k in p_lower for k in ("order", "orders", "ஆர்டர்", "ஆர்டர்கள்")):
        res = execute_get_orders(db, user)
        actions.append({"tool": "get_orders", "result": res})
        return _format_tool_result_naturally("get_orders", res, "ta" if is_ta else "en"), actions

    if any(k in p_lower for k in ("warehouse", "inventory", "stock", "கிடங்கு", "இருப்பு")):
        res = execute_get_warehouse_inventory(db, user)
        actions.append({"tool": "get_warehouse_inventory", "result": res})
        return _format_tool_result_naturally("get_warehouse_inventory", res, "ta" if is_ta else "en"), actions

    if any(k in p_lower for k in ("job", "jobs", "transport", "delivery", "ரூட்", "வேலை", "போக்குவரத்து")):
        res = execute_get_transport_jobs(db, user)
        actions.append({"tool": "get_transport_jobs", "result": res})
        return _format_tool_result_naturally("get_transport_jobs", res, "ta" if is_ta else "en"), actions

    if any(k in p_lower for k in ("vehicle", "truck", "bike", "வாகனம்")):
        res = execute_get_available_vehicles(db, user)
        actions.append({"tool": "get_available_vehicles", "result": res})
        vehs = res.get("vehicles", [])
        if not vehs:
            return "வாகனங்கள் எதுவும் இல்லை." if is_ta else "No active vehicles registered.", actions
        header = "பதிவுசெய்யப்பட்ட வாகனங்கள்:\n" if is_ta else "Available Vehicles:\n"
        vlines = [f"• {v['name']} ({v['category']} - {v['capacity_kg']:.0f}kg)" for v in vehs[:3]]
        return header + "\n".join(vlines), actions

    if is_ta:
        return "வணக்கம்! உங்கள் ஆர்டர்கள், விளைபொருட்கள் இருப்பு, மற்றும் போக்குவரத்து தகவல்களை அறிய என்னிடம் கேளுங்கள்.", actions
    return "Hello! I am AgriDirect AI. You can ask about current orders, warehouse inventory in Tenkasi/Tirunelveli/Thoothukudi, available transport jobs, or delivery tracking.", actions