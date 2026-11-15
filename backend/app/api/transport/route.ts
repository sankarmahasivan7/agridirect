import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { getAuthUser } from '@/lib/auth';
import { serializeTransportRequest } from '@/lib/transport';
import { calculateOrderTransportFee } from '@/lib/logistics';
import { DISTRICT_WAREHOUSES } from '@/lib/constants';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return errorResponse('Not authenticated', 401);

    const body = await req.json();
    const {
      pickup_location,
      pickup_latitude,
      pickup_longitude,
      destination_location,
      destination_latitude,
      destination_longitude,
      required_by,
      weight_kg,
      notes,
      order_id,
    } = body;

    let pLat = pickup_latitude != null ? Number(pickup_latitude) : null;
    let pLon = pickup_longitude != null ? Number(pickup_longitude) : null;
    let dLat = destination_latitude != null ? Number(destination_latitude) : null;
    let dLon = destination_longitude != null ? Number(destination_longitude) : null;

    if (pLat == null || pLon == null) {
      const wh = DISTRICT_WAREHOUSES.Tenkasi;
      pLat = wh.latitude;
      pLon = wh.longitude;
    }
    if (dLat == null || dLon == null) {
      const wh = DISTRICT_WAREHOUSES.Tirunelveli;
      dLat = wh.latitude;
      dLon = wh.longitude;
    }

    const weight = Number(weight_kg || 50);
    const feeInfo = await calculateOrderTransportFee(pLat, pLon, dLat, dLon, weight);

    const transportReq = await prisma.transportRequest.create({
      data: {
        requestedByUserId: authUser.id,
        orderId: order_id ? Number(order_id) : null,
        pickupLocation: pickup_location || 'Source Location',
        pickupLatitude: pLat,
        pickupLongitude: pLon,
        destinationLocation: destination_location || 'Destination Location',
        destinationLatitude: dLat,
        destinationLongitude: dLon,
        requiredBy: required_by ? new Date(required_by) : new Date(Date.now() + 48 * 3600 * 1000),
        weightKg: weight,
        notes: notes || null,
        status: 'PENDING',
        distanceKm: feeInfo.road_distance_km,
        logisticsCost: feeInfo.total_fee,
        baseFare: feeInfo.base_fare,
        distanceFare: feeInfo.distance_fare,
        tollCharges: feeInfo.toll_charges,
        loadingUnloadingCharge: feeInfo.loading_unloading_charge,
        waitingCharge: feeInfo.waiting_charge,
        roadDistanceKm: feeInfo.road_distance_km,
        allocatedVehicleType: feeInfo.vehicle_type,
      } as any,
      include: {
        assignedVehicle: { include: { transporter: true } },
      },
    });

    return jsonResponse(serializeTransportRequest(transportReq), 201);
  } catch (err: any) {
    console.error('Create transport request error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}
