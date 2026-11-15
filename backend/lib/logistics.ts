import prisma from './prisma';
import {
  getRoadDistanceAndDuration,
  getRouteTollCharges,
  optimizeMultiPickupDeliveryOrder,
  RouteStop,
} from './maps';

export const BIKE_MAX_CAPACITY_KG = 50.0;
export const DEFAULT_TRUCK_MIN_FILL_PCT = 35.0;

export const DEFAULT_RATES: Record<string, {
  base_fare: number;
  rate_per_km: number;
  minimum_fare: number;
  loading_unloading_charge: number;
  waiting_charge_per_hour: number;
}> = {
  BIKE: {
    base_fare: 30.0,
    rate_per_km: 8.0,
    minimum_fare: 40.0,
    loading_unloading_charge: 0.0,
    waiting_charge_per_hour: 0.0,
  },
  MINI_TRUCK: {
    base_fare: 150.0,
    rate_per_km: 18.0,
    minimum_fare: 200.0,
    loading_unloading_charge: 50.0,
    waiting_charge_per_hour: 100.0,
  },
  TRUCK: {
    base_fare: 300.0,
    rate_per_km: 25.0,
    minimum_fare: 350.0,
    loading_unloading_charge: 100.0,
    waiting_charge_per_hour: 150.0,
  },
};

export function selectVehicleType(cargoWeightKg: number): string {
  const w = Number(cargoWeightKg) || 0.0;
  if (w <= BIKE_MAX_CAPACITY_KG) return 'BIKE';
  if (w <= 1500.0) return 'MINI_TRUCK';
  return 'TRUCK';
}

export async function getVehicleRate(vehicleType: string) {
  const vNorm = (vehicleType || 'TRUCK').toUpperCase();
  let lookupKey = 'TRUCK';
  if (vNorm.includes('BIKE') || vNorm.includes('TWO') || vNorm.includes('SCOOTER') || vNorm.includes('MOTORCYCLE')) {
    lookupKey = 'BIKE';
  } else if (vNorm.includes('MINI') || vNorm.includes('TEMPO') || vNorm.includes('PICKUP')) {
    lookupKey = 'MINI_TRUCK';
  }

  try {
    const rate = await prisma.vehicle_rates.findFirst({
      where: {
        vehicle_type: lookupKey,
        active: true,
      },
    });
    if (rate) {
      return {
        vehicle_type: lookupKey,
        base_fare: Number(rate.base_fare),
        rate_per_km: Number(rate.rate_per_km),
        minimum_fare: Number(rate.minimum_fare),
        loading_unloading_charge: Number(rate.loading_unloading_charge),
        waiting_charge_per_hour: Number(rate.waiting_charge_per_hour),
      };
    }
  } catch {
    // Fallback to in-memory default
  }

  const fb = DEFAULT_RATES[lookupKey] || DEFAULT_RATES.TRUCK;
  return {
    vehicle_type: lookupKey,
    ...fb,
  };
}

export function evaluateDispatchReadiness(
  cargoWeightKg: number,
  vehicleCapacityKg: number,
  vehicleType?: string,
  minFillPct = DEFAULT_TRUCK_MIN_FILL_PCT
) {
  const w = Math.round(Number(cargoWeightKg || 0) * 100) / 100;
  const cap = Math.round(Number(vehicleCapacityKg || 0) * 100) / 100;
  const vType = (vehicleType || selectVehicleType(w)).toUpperCase();

  const isBike =
    vType.includes('BIKE') ||
    vType.includes('TWO') ||
    vType.includes('SCOOTER') ||
    (w <= BIKE_MAX_CAPACITY_KG && cap <= BIKE_MAX_CAPACITY_KG);

  if (isBike) {
    if (w > BIKE_MAX_CAPACITY_KG) {
      return {
        dispatch_status: 'EXCEEDS_CAPACITY',
        is_eligible: false,
        reason: `Cargo weight (${w} kg) exceeds Bike max capacity (${BIKE_MAX_CAPACITY_KG} kg). Truck required.`,
        fill_percentage: cap > 0 ? Math.round((w / cap) * 1000) / 10 : 100.0,
        vehicle_type: 'BIKE',
      };
    }
    if (cap > 0 && w > cap) {
      return {
        dispatch_status: 'EXCEEDS_CAPACITY',
        is_eligible: false,
        reason: `Cargo weight (${w} kg) exceeds bike registered capacity (${cap} kg).`,
        fill_percentage: Math.round((w / cap) * 1000) / 10,
        vehicle_type: 'BIKE',
      };
    }
    const fillPct = cap > 0 ? Math.round((w / cap) * 1000) / 10 : 100.0;
    return {
      dispatch_status: 'DISPATCH_READY',
      is_eligible: true,
      reason: 'Eligible bike for immediate dispatch (no minimum fill requirement).',
      fill_percentage: fillPct,
      vehicle_type: 'BIKE',
    };
  }

  // TRUCK RULE
  if (w <= BIKE_MAX_CAPACITY_KG) {
    return {
      dispatch_status: 'INEFFICIENT_VEHICLE',
      is_eligible: false,
      reason: `Cargo weight (${w} kg) is <= 50 kg. A bike must be used instead of a truck.`,
      fill_percentage: cap > 0 ? Math.round((w / cap) * 1000) / 10 : 0.0,
      vehicle_type: vType,
    };
  }

  if (cap > 0 && w > cap) {
    return {
      dispatch_status: 'EXCEEDS_CAPACITY',
      is_eligible: false,
      reason: `Cargo weight (${w} kg) exceeds vehicle capacity (${cap} kg). Never assign overloaded vehicles.`,
      fill_percentage: Math.round((w / cap) * 1000) / 10,
      vehicle_type: vType,
    };
  }

  const fillPct = cap > 0 ? Math.round((w / cap) * 1000) / 10 : 100.0;
  const minRequiredWeight = Math.round(cap * (minFillPct / 100.0) * 100) / 100;

  if (w < minRequiredWeight) {
    return {
      dispatch_status: 'HOLD_FOR_CONSOLIDATION',
      is_eligible: false,
      reason: `Cargo weight (${w} kg) is below ${minFillPct}% minimum dispatch threshold (${minRequiredWeight} kg for ${cap} kg vehicle; current fill: ${fillPct}%). Hold batch to combine with compatible orders.`,
      fill_percentage: fillPct,
      vehicle_type: vType,
      min_required_weight_kg: minRequiredWeight,
    };
  }

  return {
    dispatch_status: 'DISPATCH_READY',
    is_eligible: true,
    reason: `Eligible truck (reaches ${fillPct}% capacity, exceeding ${minFillPct}% threshold).`,
    fill_percentage: fillPct,
    vehicle_type: vType,
    min_required_weight_kg: minRequiredWeight,
  };
}

export async function calculateTransportFee(
  roadDistanceKm: number,
  vehicleType: string,
  toll = 0.0,
  loadingUnloading?: number | null,
  waitingHours = 0.0
) {
  const rates = await getVehicleRate(vehicleType);
  const dKm = Number(roadDistanceKm) || 0;
  const tollFee = Number(toll) || 0;
  const waitingH = Number(waitingHours) || 0;

  const baseFare = rates.base_fare;
  const rateKm = rates.rate_per_km;
  const minFare = rates.minimum_fare;
  const loadCharge = loadingUnloading != null ? Number(loadingUnloading) : rates.loading_unloading_charge;
  const waitingCharge = waitingH * rates.waiting_charge_per_hour;
  const distanceFare = dKm * rateKm;

  const subtotal = baseFare + distanceFare + tollFee + loadCharge + waitingCharge;
  const totalFee = Math.max(minFare, subtotal);
  const isMinFareApplied = subtotal < minFare;

  return {
    vehicle_type: rates.vehicle_type,
    road_distance_km: Math.round(dKm * 100) / 100,
    base_fare: Math.round(baseFare * 100) / 100,
    rate_per_km: Math.round(rateKm * 100) / 100,
    distance_fare: Math.round(distanceFare * 100) / 100,
    toll_charges: Math.round(tollFee * 100) / 100,
    loading_unloading_charge: Math.round(loadCharge * 100) / 100,
    waiting_charge: Math.round(waitingCharge * 100) / 100,
    subtotal: Math.round(subtotal * 100) / 100,
    minimum_fare: Math.round(minFare * 100) / 100,
    is_minimum_fare_applied: isMinFareApplied,
    total_fee: Math.round(totalFee * 100) / 100,
  };
}

export async function calculateOrderTransportFee(
  pickupLat: number | null | undefined,
  pickupLon: number | null | undefined,
  deliveryLat: number | null | undefined,
  deliveryLon: number | null | undefined,
  cargoWeightKg: number,
  loadingUnloading?: number | null,
  waitingHours = 0.0
) {
  if (pickupLat == null || pickupLon == null || deliveryLat == null || deliveryLon == null) {
    throw new Error('Pickup and delivery coordinates (latitude and longitude) are strictly required for road transport fee calculation.');
  }

  const { distanceKm, durationMinutes } = await getRoadDistanceAndDuration(
    pickupLat,
    pickupLon,
    deliveryLat,
    deliveryLon,
    true
  );

  const toll = await getRouteTollCharges(pickupLat, pickupLon, deliveryLat, deliveryLon);
  const vType = selectVehicleType(cargoWeightKg);

  const feeBreakdown = await calculateTransportFee(
    distanceKm,
    vType,
    toll,
    loadingUnloading,
    waitingHours
  );

  return {
    ...feeBreakdown,
    estimated_duration_minutes: durationMinutes,
    cargo_weight_kg: Number(cargoWeightKg),
  };
}

export async function calculateMultiWarehouseOrderFee(
  warehouseCoords: [number, number, string][],
  deliveryLat: number,
  deliveryLon: number,
  cargoWeightKg: number,
  deliveryLabel = 'Customer Delivery'
) {
  if (deliveryLat == null || deliveryLon == null) {
    throw new Error('Delivery coordinates (latitude and longitude) are strictly required.');
  }
  if (!warehouseCoords || warehouseCoords.length === 0) {
    throw new Error('At least one pickup warehouse location is required.');
  }

  const pickupStops: RouteStop[] = warehouseCoords.map((w) => ({
    latitude: Number(w[0]),
    longitude: Number(w[1]),
    name: w[2],
    type: 'PICKUP',
  }));

  const deliveryStops: RouteStop[] = [
    {
      latitude: Number(deliveryLat),
      longitude: Number(deliveryLon),
      name: deliveryLabel,
      type: 'DELIVERY',
    },
  ];

  const { route: bestRoute } = await optimizeMultiPickupDeliveryOrder(pickupStops, deliveryStops);

  let totalRoadKm = 0;
  let totalDurationMins = 0;
  let totalTolls = 0;

  for (let i = 0; i < bestRoute.length - 1; i++) {
    const p1 = bestRoute[i];
    const p2 = bestRoute[i + 1];
    const { distanceKm, durationMinutes } = await getRoadDistanceAndDuration(
      p1.latitude,
      p1.longitude,
      p2.latitude,
      p2.longitude,
      true
    );
    totalRoadKm += distanceKm;
    totalDurationMins += durationMinutes;
    const legToll = await getRouteTollCharges(p1.latitude, p1.longitude, p2.latitude, p2.longitude);
    totalTolls += legToll;
  }

  totalRoadKm = Math.round(totalRoadKm * 100) / 100;
  const vType = selectVehicleType(cargoWeightKg);
  const rates = await getVehicleRate(vType);
  const loadingCharge = rates.loading_unloading_charge * warehouseCoords.length;

  const feeBreakdown = await calculateTransportFee(
    totalRoadKm,
    vType,
    totalTolls,
    loadingCharge,
    0.0
  );

  return {
    ...feeBreakdown,
    estimated_duration_minutes: totalDurationMins,
    cargo_weight_kg: Number(cargoWeightKg),
    route_stops: bestRoute,
  };
}

export function allocateMultiCustomerRouteCosts(
  totalRouteCost: number,
  shipments: { weight_kg?: number; direct_road_distance_km?: number; [key: string]: any }[]
) {
  if (!shipments || shipments.length === 0) return [];
  const cTotal = Math.round(Number(totalRouteCost) * 100) / 100;
  if (shipments.length === 1) {
    return [
      {
        ...shipments[0],
        allocated_fee: cTotal,
        allocation_share_pct: 100.0,
      },
    ];
  }

  const factors = shipments.map((s) => {
    const w = Math.max(0.1, Number(s.weight_kg || 1.0));
    const d = Math.max(1.0, Number(s.direct_road_distance_km || 1.0));
    return w * d;
  });

  const sumFactors = factors.reduce((acc, f) => acc + f, 0) || shipments.length;
  let runningSum = 0;
  let largestIdx = 0;
  let maxShare = -1;

  const allocated = shipments.map((s, idx) => {
    const share = factors[idx] / sumFactors;
    if (share > maxShare) {
      maxShare = share;
      largestIdx = idx;
    }
    const itemFee = Math.round(cTotal * share * 100) / 100;
    runningSum += itemFee;
    return {
      ...s,
      allocated_fee: itemFee,
      allocation_share_pct: Math.round(share * 1000) / 10,
    };
  });

  const roundingDiff = Math.round((cTotal - runningSum) * 100) / 100;
  if (roundingDiff !== 0) {
    allocated[largestIdx].allocated_fee = Math.round((allocated[largestIdx].allocated_fee + roundingDiff) * 100) / 100;
  }

  return allocated;
}
