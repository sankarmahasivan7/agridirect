"""
Central operating constants and District Warehouse definitions for AgriDirect.

AgriDirect strictly operates in 3 southern Tamil Nadu districts:
1. Tenkasi
2. Tirunelveli
3. Thoothukudi (Tuticorin)

Each district has exactly 1 Central Agri-Warehouse that acts as the primary
consolidation and dispatch center for all farm produce. When a buyer places an order,
transporters pick up consignments from the seller's District Warehouse and deliver them
directly to the buyer.
"""
from decimal import Decimal
from typing import Optional, Dict, Any

SUPPORTED_DISTRICTS = {"Tenkasi", "Tirunelveli", "Thoothukudi"}

# Aliases and normalization mapping
DISTRICT_ALIASES = {
    "tenkasi": "Tenkasi",
    "tirunelveli": "Tirunelveli",
    "nellai": "Tirunelveli",
    "thoothukudi": "Thoothukudi",
    "thothukudi": "Thoothukudi",
    "tuticorin": "Thoothukudi",
}

DISTRICT_WAREHOUSES: Dict[str, Dict[str, Any]] = {
    "Tenkasi": {
        "district": "Tenkasi",
        "warehouse_name": "Tenkasi Central Agri-Warehouse",
        "code": "WH-TKS-01",
        "address": "Tenkasi Regulated Market Complex, Old Bus Stand Road, Tenkasi - 627811",
        "latitude": Decimal("8.959400"),
        "longitude": Decimal("77.316700"),
        "contact_phone": "+91 4633 222100",
        "operating_hours": "06:00 AM - 08:00 PM",
    },
    "Tirunelveli": {
        "district": "Tirunelveli",
        "warehouse_name": "Tirunelveli Central Agri-Warehouse",
        "code": "WH-TNV-01",
        "address": "Tirunelveli Agro-Logistics Hub, Bypass Road, Tirunelveli - 627005",
        "latitude": Decimal("8.713900"),
        "longitude": Decimal("77.756700"),
        "contact_phone": "+91 462 2334100",
        "operating_hours": "06:00 AM - 08:00 PM",
    },
    "Thoothukudi": {
        "district": "Thoothukudi",
        "warehouse_name": "Thoothukudi Central Agri-Warehouse",
        "code": "WH-TUT-01",
        "address": "Thoothukudi Port-Agri Warehousing Center, Harbour Express Highway, Thoothukudi - 628004",
        "latitude": Decimal("8.764200"),
        "longitude": Decimal("78.134800"),
        "contact_phone": "+91 461 2352100",
        "operating_hours": "06:00 AM - 08:00 PM",
    },
}

DEFAULT_DISTRICT = "Tenkasi"


def normalize_district(raw_name: Optional[str]) -> str:
    """
    Validates and normalizes a district name.
    Raises ValueError if district is not one of Tenkasi, Tirunelveli, Thoothukudi.
    """
    if not raw_name or not str(raw_name).strip():
        raise ValueError(
            "District is required. AgriDirect currently operates exclusively in 3 districts: "
            "Tenkasi, Tirunelveli, and Thoothukudi."
        )
    cleaned = str(raw_name).strip().lower()
    canonical = DISTRICT_ALIASES.get(cleaned)
    if not canonical:
        raise ValueError(
            f"District '{raw_name}' is not supported. AgriDirect currently operates exclusively in 3 districts: "
            f"Tenkasi, Tirunelveli, and Thoothukudi."
        )
    return canonical


def get_district_warehouse(district_name: Optional[str], fallback_text: Optional[str] = None) -> Dict[str, Any]:
    """
    Retrieves the 1 designated Central Agri-Warehouse for a given district.
    If district is not directly specified, tries to infer from fallback_text (e.g. location field).
    Defaults safely to Tenkasi warehouse if undetermined.
    """
    if district_name:
        try:
            canonical = normalize_district(district_name)
            return DISTRICT_WAREHOUSES[canonical]
        except ValueError:
            pass

    if fallback_text:
        fb_lower = fallback_text.lower()
        for alias, canonical in DISTRICT_ALIASES.items():
            if alias in fb_lower:
                return DISTRICT_WAREHOUSES[canonical]

    return DISTRICT_WAREHOUSES[DEFAULT_DISTRICT]

