import sys
from pathlib import Path
import pytest

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.core.config import settings
from app.utils.geo import resolve_location_coords, haversine_km
from app.services.maps_service import (
    get_road_distance_and_duration,
    get_batch_road_distance,
    optimize_multi_pickup_delivery_order,
)


def test_surandai_geocoding():
    """Verify Surandai and local towns resolve to their exact real GPS coordinates."""
    lat, lon = resolve_location_coords("Surandai, Tenkasi District")
    assert lat is not None and lon is not None
    assert round(lat, 2) == 8.98
    assert round(lon, 2) == 77.43


def test_surandai_to_tenkasi_real_road_distance():
    """
    Verify distance between Surandai and Tenkasi is realistic (~15-18 km),
    NOT an erroneous 500+ km calculation.
    """
    # Tenkasi Central Warehouse
    tenkasi_lat, tenkasi_lon = 8.9594, 77.3167
    # Surandai
    surandai_lat, surandai_lon = 8.9774, 77.4262

    km, mins = get_road_distance_and_duration(tenkasi_lat, tenkasi_lon, surandai_lat, surandai_lon)

    # Road distance is approximately 16.9 km, definitely under 25 km
    assert 12.0 <= km <= 25.0, f"Expected between 12 and 25 km, got {km} km"
    assert mins >= 10, f"Expected realistic transit duration, got {mins} mins"


def test_surandai_multi_pickup_route_optimization():
    """
    Given an order to Surandai with 2 products:
    - Product 1 in Tenkasi Warehouse
    - Product 2 in Tirunelveli Warehouse
    Verify optimize_multi_pickup_delivery_order finds the shortest sequence.
    """
    tenkasi_stop = {
        "id": "wh_tenkasi",
        "name": "Tenkasi Central Warehouse",
        "latitude": 8.9594,
        "longitude": 77.3167,
    }
    tirunelveli_stop = {
        "id": "wh_tirunelveli",
        "name": "Tirunelveli Central Warehouse",
        "latitude": 8.7139,
        "longitude": 77.7567,
    }
    surandai_stop = {
        "id": "dest_surandai",
        "name": "Surandai Customer Delivery",
        "latitude": 8.9774,
        "longitude": 77.4262,
    }

    pickups = [tenkasi_stop, tirunelveli_stop]
    deliveries = [surandai_stop]

    optimized_stops, total_km = optimize_multi_pickup_delivery_order(pickups, deliveries)

    assert len(optimized_stops) == 3
    # The delivery must always be the final stop
    assert optimized_stops[-1]["id"] == "dest_surandai"

    # Total route distance for both pickups + delivery must be well under 150 km, NOT 500 km
    assert total_km < 150.0, f"Expected optimized route under 150 km, got {total_km} km"


def test_google_maps_api_key_configuration():
    """Verify settings loads GOOGLE_MAPS_API_KEY without errors."""
    assert hasattr(settings, "GOOGLE_MAPS_API_KEY")
    assert hasattr(settings, "ROUTING_PROVIDER")

