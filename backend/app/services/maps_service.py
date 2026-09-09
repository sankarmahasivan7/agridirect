"""
Real Road Mapping, Distance & Route Optimization Service.

Integrates:
1. Google Maps Distance Matrix API & Directions API (when GOOGLE_MAPS_API_KEY is provided).
2. OSRM (Open Source Routing Machine) public driving API as a 100% free, real-road fallback.
3. Great-circle Haversine with standard 1.25x road circuity factor as offline fallback.

Includes in-memory LRU caching to eliminate redundant external HTTP requests.
"""
import logging
from functools import lru_cache
from typing import Optional, Tuple, List, Dict, Any
import httpx

from app.core.config import settings
from app.utils.geo import haversine_km

logger = logging.getLogger(__name__)

# Standard road winding / circuity coefficient for rural/suburban Indian road networks
ROAD_CIRCUITY_FACTOR = 1.25
ASSUMED_SPEED_KMPH = 35.0
HTTP_TIMEOUT_SECONDS = 4.0

# Memory cache for coordinate pair distances: key -> (distance_km, duration_minutes, provider)
_DISTANCE_CACHE: Dict[Tuple[float, float, float, float], Tuple[float, int, str]] = {}


def _make_cache_key(lat1: float, lon1: float, lat2: float, lon2: float) -> Tuple[float, float, float, float]:
    return (round(float(lat1), 4), round(float(lon1), 4), round(float(lat2), 4), round(float(lon2), 4))


def _fetch_google_maps_distance(
    lat1: float, lon1: float, lat2: float, lon2: float, api_key: str
) -> Optional[Tuple[float, int]]:
    """Fetches real driving distance (km) and duration (mins) from Google Maps Distance Matrix API."""
    try:
        url = "https://maps.googleapis.com/maps/api/distancematrix/json"
        params = {
            "origins": f"{lat1},{lon1}",
            "destinations": f"{lat2},{lon2}",
            "mode": "driving",
            "key": api_key,
        }
        with httpx.Client(timeout=HTTP_TIMEOUT_SECONDS) as client:
            resp = client.get(url, params=params)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("status") == "OK" and data.get("rows"):
                    elements = data["rows"][0].get("elements", [])
                    if elements and elements[0].get("status") == "OK":
                        distance_meters = elements[0]["distance"]["value"]
                        duration_seconds = elements[0]["duration"]["value"]
                        dist_km = round(distance_meters / 1000.0, 2)
                        dur_mins = max(5, round(duration_seconds / 60))
                        return dist_km, dur_mins
    except Exception as e:
        logger.warning(f"Google Maps API call failed: {e}")
    return None


def _fetch_osrm_distance(
    lat1: float, lon1: float, lat2: float, lon2: float
) -> Optional[Tuple[float, int]]:
    """Fetches real driving road distance (km) and duration (mins) from OSRM (OpenStreetMap)."""
    try:
        # OSRM expects coordinates in {longitude},{latitude} format
        url = f"https://router.project-osrm.org/route/v1/driving/{lon1},{lat1};{lon2},{lat2}?overview=false"
        with httpx.Client(timeout=HTTP_TIMEOUT_SECONDS) as client:
            resp = client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("code") == "Ok" and data.get("routes"):
                    route = data["routes"][0]
                    dist_km = round(route["distance"] / 1000.0, 2)
                    dur_mins = max(5, round(route["duration"] / 60))
                    return dist_km, dur_mins
    except Exception as e:
        logger.warning(f"OSRM routing call failed: {e}")
    return None


def get_road_distance_and_duration(
    lat1: float | None,
    lon1: float | None,
    lat2: float | None,
    lon2: float | None,
) -> Tuple[float, int]:
    """
    Returns (distance_km, duration_minutes) using:
    1. In-memory cache
    2. Google Maps Distance Matrix API (if GOOGLE_MAPS_API_KEY configured)
    3. OSRM driving network (free OpenStreetMap road network)
    4. Offline Haversine * 1.25x road winding factor
    """
    if lat1 is None or lon1 is None or lat2 is None or lon2 is None:
        return 15.0, 30

    # Identical coordinates
    if round(float(lat1), 5) == round(float(lat2), 5) and round(float(lon1), 5) == round(float(lon2), 5):
        return 0.0, 0

    cache_key = _make_cache_key(lat1, lon1, lat2, lon2)
    if cache_key in _DISTANCE_CACHE:
        return _DISTANCE_CACHE[cache_key][0], _DISTANCE_CACHE[cache_key][1]

    provider = "haversine"
    result = None

    # 1. Attempt Google Maps if key is configured
    google_key = getattr(settings, "GOOGLE_MAPS_API_KEY", None)
    routing_mode = getattr(settings, "ROUTING_PROVIDER", "auto")

    if google_key and routing_mode in ("auto", "google"):
        result = _fetch_google_maps_distance(lat1, lon1, lat2, lon2, google_key)
        if result:
            provider = "google_maps"

    # 2. Fallback to OSRM (OpenStreetMap real roads)
    if result is None and routing_mode in ("auto", "osrm"):
        result = _fetch_osrm_distance(lat1, lon1, lat2, lon2)
        if result:
            provider = "osrm"

    # 3. Offline Haversine with Indian road circuity factor
    if result is None:
        crow_fly = haversine_km(lat1, lon1, lat2, lon2)
        dist_km = round(crow_fly * ROAD_CIRCUITY_FACTOR, 2)
        dur_mins = max(10, round((dist_km / ASSUMED_SPEED_KMPH) * 60))
        result = (dist_km, dur_mins)
        provider = "haversine_circuity"

    # Store in memory cache
    _DISTANCE_CACHE[cache_key] = (result[0], result[1], provider)
    return result[0], result[1]


def get_batch_road_distance(stops: List[Any]) -> Tuple[float, int]:
    """
    Computes total real road driving distance and duration through sequential stops.
    """
    if not stops or len(stops) < 2:
        return 0.0, 0

    total_km = 0.0
    total_mins = 0

    for idx in range(len(stops) - 1):
        s1 = stops[idx]
        s2 = stops[idx + 1]
        lat1 = getattr(s1, "latitude", None)
        lon1 = getattr(s1, "longitude", None)
        lat2 = getattr(s2, "latitude", None)
        lon2 = getattr(s2, "longitude", None)

        if lat1 is not None and lon1 is not None and lat2 is not None and lon2 is not None:
            km, mins = get_road_distance_and_duration(lat1, lon1, lat2, lon2)
            total_km += km
            total_mins += mins
        else:
            total_km += 15.0
            total_mins += 30

    return round(total_km, 2), total_mins


def optimize_multi_pickup_delivery_order(
    pickup_stops: List[Dict[str, Any]],
    delivery_stops: List[Dict[str, Any]],
) -> Tuple[List[Dict[str, Any]], float]:
    """
    Given multiple warehouse pickup stops and customer delivery stops,
    evaluates permutations of pickups followed by deliveries to find the
    shortest overall driving distance along real road networks.
    
    Example (Surandai destination with Tenkasi & Tirunelveli warehouse pickups):
    - Permutation 1: Tenkasi -> Tirunelveli -> Surandai (~135 km)
    - Permutation 2: Tirunelveli -> Tenkasi -> Surandai (~85 km)  <-- Selected!
    """
    import itertools

    if len(pickup_stops) <= 1 and len(delivery_stops) <= 1:
        combined = pickup_stops + delivery_stops
        return combined, 0.0

    best_sequence = None
    min_total_km = float("inf")

    # Evaluate possible pickup orders (warehouse pickups must all complete before delivery dropoffs)
    for p_perm in itertools.permutations(pickup_stops):
        for d_perm in itertools.permutations(delivery_stops):
            current_route = list(p_perm) + list(d_perm)
            current_km = 0.0
            for i in range(len(current_route) - 1):
                loc1 = current_route[i]
                loc2 = current_route[i + 1]
                km, _ = get_road_distance_and_duration(
                    loc1.get("latitude"), loc1.get("longitude"),
                    loc2.get("latitude"), loc2.get("longitude"),
                )
                current_km += km

            if current_km < min_total_km:
                min_total_km = current_km
                best_sequence = current_route

    return best_sequence or (pickup_stops + delivery_stops), round(min_total_km, 2)

