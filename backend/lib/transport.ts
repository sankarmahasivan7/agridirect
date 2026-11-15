export function serializeTransportRequest(req: any) {
  let vehicleOut = null;
  if (req.assignedVehicle) {
    const v = req.assignedVehicle;
    let lat = v.currentLatitude != null ? Number(v.currentLatitude) : null;
    let lon = v.currentLongitude != null ? Number(v.currentLongitude) : null;
    let locLabel = v.locationLabel || null;
    let updatedAt = v.locationUpdatedAt || null;

    if ((lat == null || lon == null) && v.transporter) {
      lat = v.transporter.baseLatitude != null ? Number(v.transporter.baseLatitude) : null;
      lon = v.transporter.baseLongitude != null ? Number(v.transporter.baseLongitude) : null;
      locLabel = locLabel || v.transporter.baseLocation || null;
      updatedAt = updatedAt || v.transporter.user?.createdAt || null;
    }

    vehicleOut = {
      id: v.id,
      name: v.name,
      vehicle_number: v.vehicleNumber,
      vehicle_type: v.vehicleType,
      capacity_kg: Number(v.capacityKg),
      current_latitude: lat,
      current_longitude: lon,
      location_label: locLabel,
      location_updated_at: updatedAt,
    };
  }

  return {
    id: req.id,
    pickup_location: req.pickupLocation,
    pickup_latitude: req.pickupLatitude != null ? Number(req.pickupLatitude) : null,
    pickup_longitude: req.pickupLongitude != null ? Number(req.pickupLongitude) : null,
    destination_location: req.destinationLocation,
    destination_latitude: req.destinationLatitude != null ? Number(req.destinationLatitude) : null,
    destination_longitude: req.destinationLongitude != null ? Number(req.destinationLongitude) : null,
    required_by: req.requiredBy,
    available_from: req.availableFrom,
    weight_kg: Number(req.weightKg),
    notes: req.notes,
    status: req.status,
    order_id: req.orderId,
    assigned_vehicle: vehicleOut,
    logistics_strategy: req.logisticsStrategy || 'direct',
    hub_name: req.hubName,
    distance_km: req.distanceKm != null ? Number(req.distanceKm) : null,
    logistics_cost: req.logisticsCost != null ? Number(req.logisticsCost) : null,
    vehicle_capacity_kg: req.vehicleCapacityKg != null ? Number(req.vehicleCapacityKg) : null,
    is_perishable: Boolean(req.isPerishable),
    perishability_urgency: req.perishabilityUrgency || 'NORMAL',
    storage_requirement: req.storageRequirement || null,
    in_transit_at: req.inTransitAt,
    estimated_transit_minutes: req.estimatedTransitMinutes != null ? Number(req.estimatedTransitMinutes) : null,
    created_at: req.createdAt,
  };
}

