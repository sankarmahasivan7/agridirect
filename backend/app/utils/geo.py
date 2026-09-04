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
