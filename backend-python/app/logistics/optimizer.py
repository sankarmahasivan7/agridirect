"""
Consolidates real order stops into vehicle-capacity-respecting groups using
OR-Tools CP-SAT (a capacitated bin-packing formulation). This operates on
the exact stops/quantities passed in -- it never invents stops.

Without real geocoordinates for every location (spec section 25 lists this as
an available input, but we don't force a paid geocoding API), we optimize the
load-consolidation problem (bin packing by capacity) rather than a full
distance-based VRP. If lat/lon are supplied per stop, `estimate_route_order`
below does a nearest-neighbor ordering within each vehicle's stops.
"""
import math
from typing import Optional

from ortools.sat.python import cp_model


def optimize_routes(stops: list[dict], vehicle_capacity_kg: float) -> list[dict]:
    n = len(stops)
    if n == 0:
        return []

    demands = [int(round(s["demand_kg"])) for s in stops]
    capacity = int(round(vehicle_capacity_kg))
    max_vehicles = n  # worst case: one stop per vehicle

    model = cp_model.CpModel()
    # x[i][v] = 1 if stop i is assigned to vehicle v
    x = {(i, v): model.NewBoolVar(f"x_{i}_{v}") for i in range(n) for v in range(max_vehicles)}
    used = [model.NewBoolVar(f"used_{v}") for v in range(max_vehicles)]

    for i in range(n):
        model.Add(sum(x[i, v] for v in range(max_vehicles)) == 1)

    for v in range(max_vehicles):
        model.Add(sum(demands[i] * x[i, v] for i in range(n)) <= capacity)
        for i in range(n):
            model.Add(x[i, v] <= used[v])

    # Minimize number of vehicles used (fewer trips = lower logistics cost).
    model.Minimize(sum(used))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 5.0
    status = solver.Solve(model)

    routes: list[dict] = []
    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        for v in range(max_vehicles):
            if solver.Value(used[v]) == 0:
                continue
            assigned = [stops[i] for i in range(n) if solver.Value(x[i, v]) == 1]
            if not assigned:
                continue
            ordered = estimate_route_order(assigned)
            routes.append({
                "vehicle": f"Vehicle {len(routes) + 1}",
                "stops": ordered,
                "total_load_kg": sum(s["demand_kg"] for s in assigned),
                "capacity_kg": vehicle_capacity_kg,
            })
    else:
        # Fallback: naive greedy packing if the solver can't find a solution in time.
        routes = _greedy_pack(stops, vehicle_capacity_kg)

    return routes


def estimate_route_order(stops: list[dict]) -> list[dict]:
    """Nearest-neighbor ordering if lat/lon are present; otherwise returns as-is."""
    if not stops or "lat" not in stops[0] or "lon" not in stops[0]:
        return stops
    remaining = stops[:]
    ordered = [remaining.pop(0)]
    while remaining:
        last = ordered[-1]
        remaining.sort(key=lambda s: math.hypot(s["lat"] - last["lat"], s["lon"] - last["lon"]))
        ordered.append(remaining.pop(0))
    return ordered


def _greedy_pack(stops: list[dict], capacity: float) -> list[dict]:
    sorted_stops = sorted(stops, key=lambda s: -s["demand_kg"])
    routes: list[dict] = []
    for stop in sorted_stops:
        placed = False
        for route in routes:
            if route["total_load_kg"] + stop["demand_kg"] <= capacity:
                route["stops"].append(stop)
                route["total_load_kg"] += stop["demand_kg"]
                placed = True
                break
        if not placed:
            routes.append({
                "vehicle": f"Vehicle {len(routes) + 1}",
                "stops": [stop],
                "total_load_kg": stop["demand_kg"],
                "capacity_kg": capacity,
            })
    return routes
