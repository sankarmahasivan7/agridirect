export function serializeBatch(b: any) {
  const stops = (b.stops || []).map((s: any) => ({
    id: s.id,
    batch_id: s.batchId,
    stop_type: s.stopType,
    sequence: s.sequence,
    location_name: s.locationName,
    latitude: s.latitude != null ? Number(s.latitude) : null,
    longitude: s.longitude != null ? Number(s.longitude) : null,
    cargo_kg: s.cargoKg != null ? Number(s.cargoKg) : null,
    order_id: s.orderId,
    customer_name: s.customerName,
    notes: s.notes,
    status: s.status,
  }));

  const fulfillmentItems = (b.fulfillmentItems || []).map((f: any) => ({
    id: f.id,
    order_id: f.orderId,
    order_item_id: f.orderItemId,
    warehouse_name: f.warehouseName,
    warehouse_code: f.warehouseCode,
    warehouse_district: f.warehouseDistrict,
    warehouse_latitude: f.warehouseLatitude != null ? Number(f.warehouseLatitude) : null,
    warehouse_longitude: f.warehouseLongitude != null ? Number(f.warehouseLongitude) : null,
    quantity: Number(f.quantity),
    status: f.status,
    batch_id: f.batchId,
    available_from: f.availableFrom,
    created_at: f.createdAt,
  }));

  return {
    id: b.id,
    batch_code: b.batchCode,
    delivery_area: b.deliveryArea,
    total_quantity_kg: Number(b.totalQuantityKg),
    total_orders_count: b.totalOrdersCount,
    total_customers_count: b.totalCustomersCount,
    estimated_distance_km: b.estimatedDistanceKm != null ? Number(b.estimatedDistanceKm) : null,
    estimated_logistics_cost: b.estimatedLogisticsCost != null ? Number(b.estimatedLogisticsCost) : null,
    assigned_transporter_id: b.assignedTransporterId,
    assigned_vehicle_id: b.assignedVehicleId,
    status: b.status,
    pickup_deadline: b.pickupDeadline,
    delivery_deadline: b.deliveryDeadline,
    earliest_available_date: b.earliestAvailableDate,
    in_transit_at: b.inTransitAt,
    estimated_transit_minutes: b.estimatedTransitMinutes != null ? Number(b.estimatedTransitMinutes) : null,
    base_fare: b.baseFare != null ? Number(b.baseFare) : null,
    distance_fare: b.distanceFare != null ? Number(b.distanceFare) : null,
    toll_charges: b.tollCharges != null ? Number(b.tollCharges) : null,
    loading_unloading_charge: b.loadingUnloadingCharge != null ? Number(b.loadingUnloadingCharge) : null,
    waiting_charge: b.waitingCharge != null ? Number(b.waitingCharge) : null,
    allocated_vehicle_type: b.allocatedVehicleType,
    created_at: b.createdAt,
    updated_at: b.updatedAt,
    stops,
    fulfillment_items: fulfillmentItems,
    transporter: b.transporter
      ? {
          id: b.transporter.id,
          full_name: b.transporter.fullName,
          license_number: b.transporter.licenseNumber,
          base_location: b.transporter.baseLocation,
          district: b.transporter.district,
        }
      : null,
    vehicle: b.vehicle
      ? {
          id: b.vehicle.id,
          name: b.vehicle.name,
          vehicle_number: b.vehicle.vehicleNumber,
          vehicle_type: b.vehicle.vehicleType,
          capacity_kg: Number(b.vehicle.capacityKg),
          current_latitude: b.vehicle.currentLatitude != null ? Number(b.vehicle.currentLatitude) : null,
          current_longitude: b.vehicle.currentLongitude != null ? Number(b.vehicle.currentLongitude) : null,
          location_label: b.vehicle.locationLabel,
        }
      : null,
  };
}

