"""
Straight-line (Haversine) distance and a simple, honest ETA estimate.

This is NOT real road-routing distance -- that would need OSRM/a routing
engine with real road-network data. Haversine gives the great-circle
distance between two coordinates, which is a reasonable, deterministic
stand-in for "how far apart are these two points" when picking the nearest
feasible vehicle, and for sanity-checking that a delivery couldn't possibly
have already happened. It's honest about being an approximation, not a
turn-by-turn route.
"""
import math

EARTH_RADIUS_KM = 6371.0

# Conservative average speed assumption for local/regional agri-logistics
# (mix of rural roads, loading/unloading, traffic). Used only to compute a
# floor for "earliest possible delivery time" -- not shown to users as a
# precise ETA.
ASSUMED_AVERAGE_SPEED_KMPH = 30.0

# Even a delivery next door involves loading, driving, and unloading.
MINIMUM_TRANSIT_MINUTES = 20

# Applied when we don't have both endpoints' coordinates -- a conservative
# flat floor so "Delivered" can't be fired the instant a trip starts.
DEFAULT_TRANSIT_MINUTES_NO_COORDS = 45


def haversine_km(lat1, lon1, lat2, lon2) -> float:
    lat1, lon1, lat2, lon2 = map(lambda v: math.radians(float(v)), [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    c = 2 * math.asin(math.sqrt(a))
    return EARTH_RADIUS_KM * c


def estimate_transit_minutes(pickup_lat, pickup_lon, dest_lat, dest_lon) -> int:
    """Returns a whole-minute, floor-bounded transit estimate for a given pickup/destination pair."""
    if None in (pickup_lat, pickup_lon, dest_lat, dest_lon):
        return DEFAULT_TRANSIT_MINUTES_NO_COORDS
    distance_km = haversine_km(pickup_lat, pickup_lon, dest_lat, dest_lon)
    minutes = (distance_km / ASSUMED_AVERAGE_SPEED_KMPH) * 60
    return max(MINIMUM_TRANSIT_MINUTES, round(minutes))


KNOWN_LOCATIONS = {
    "tirunelveli": (8.7139, 77.7567),
    "tenkasi": (8.9594, 77.3167),
    "thoothukudi": (8.7642, 78.1348),
    "tuticorin": (8.7642, 78.1348),
    # Local Southern Tamil Nadu towns (Tenkasi / Tirunelveli / Thoothukudi)
    "surandai": (8.9774, 77.4262),
    "alangulam": (8.8711, 77.5020),
    "pavoorchatram": (8.9056, 77.3778),
    "kadayanallur": (9.0768, 77.3450),
    "sankarankovil": (9.1724, 77.5325),
    "puliyangudi": (9.1750, 77.4000),
    "sivagiri": (9.3400, 77.4300),
    "shencottai": (8.9833, 77.2500),
    "sengottai": (8.9833, 77.2500),
    "courtallam": (8.9324, 77.2736),
    "kutralam": (8.9324, 77.2736),
    "palayamkottai": (8.7180, 77.7420),
    "ambasamudram": (8.7058, 77.4583),
    "cheranmahadevi": (8.6833, 77.5667),
    "kalakkad": (8.5133, 77.5500),
    "valliyur": (8.3811, 77.6167),
    "nanguneri": (8.4892, 77.6661),
    "kovilpatti": (9.1742, 77.8687),
    "kayathar": (8.9542, 77.7733),
    "srivaikuntam": (8.6256, 77.9108),
    "tiruchendur": (8.4975, 78.1250),
    "kudankulam": (8.1800, 77.7100),
    # Other Tamil Nadu hubs
    "chennai": (13.0827, 80.2707),
    "coimbatore": (11.0168, 76.9558),
    "madurai": (9.9252, 78.1198),
    "salem": (11.6643, 78.1460),
    "trichy": (10.7905, 78.7047),
    "erode": (11.3410, 77.7172),
    "vellore": (12.9165, 79.1325),
    "thanjavur": (10.7870, 79.1378),
    "dindigul": (10.3673, 77.9803),
    "pollachi": (10.6609, 77.0048),
    "hosur": (12.7409, 77.8253),
    "bengaluru": (12.9716, 77.5946),
    "bangalore": (12.9716, 77.5946),
}


def resolve_location_coords(location_str: str | None) -> tuple[float | None, float | None]:
    """Helper to resolve approximate coordinates for common cities/towns if not explicitly geocoded."""
    if not location_str:
        return None, None
    loc_lower = location_str.lower()
    # Sort keys by descending length so specific towns match before broader district names (e.g. 'Surandai' before 'Tenkasi')
    for name, coords in sorted(KNOWN_LOCATIONS.items(), key=lambda item: len(item[0]), reverse=True):
        if name in loc_lower:
            return coords
    return None, None
