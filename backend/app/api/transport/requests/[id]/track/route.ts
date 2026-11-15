import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const requestId = parseInt(params.id, 10);
    if (isNaN(requestId)) return errorResponse('Invalid request ID', 400);

    const transportReq = await prisma.transportRequest.findUnique({
      where: { id: requestId },
      include: {
        assignedVehicle: { include: { transporter: true } },
      },
    });

    if (!transportReq) return errorResponse('Transport request not found', 404);

    const v = transportReq.assignedVehicle;
    let vLat = v?.currentLatitude != null ? Number(v.currentLatitude) : null;
    let vLon = v?.currentLongitude != null ? Number(v.currentLongitude) : null;
    let locLabel = v?.locationLabel || null;

    if ((vLat == null || vLon == null) && v?.transporter) {
      vLat = v.transporter.baseLatitude != null ? Number(v.transporter.baseLatitude) : null;
      vLon = v.transporter.baseLongitude != null ? Number(v.transporter.baseLongitude) : null;
      locLabel = locLabel || v.transporter.baseLocation || null;
    }

    let progressPct = 0;
    if (transportReq.status === 'DELIVERED') {
      progressPct = 100;
    } else if (transportReq.status === 'IN_TRANSIT') {
      const transitMins = transportReq.estimated_transit_minutes || 30;
      if (transportReq.in_transit_at) {
        const elapsedMins = (Date.now() - new Date(transportReq.in_transit_at).getTime()) / (60 * 1000);
        progressPct = Math.min(95, Math.max(15, Math.round((elapsedMins / transitMins) * 100)));
      } else {
        progressPct = 40;
      }
    } else if (transportReq.status === 'PICKUP' || transportReq.status === 'ACCEPTED') {
      progressPct = 20;
    }

    return jsonResponse({
      request_id: transportReq.id,
      order_id: transportReq.orderId,
      status: transportReq.status,
      pickup_location: transportReq.pickupLocation,
      pickup_latitude: transportReq.pickupLatitude != null ? Number(transportReq.pickupLatitude) : null,
      pickup_longitude: transportReq.pickupLongitude != null ? Number(transportReq.pickupLongitude) : null,
      destination_location: transportReq.destinationLocation,
      destination_latitude: transportReq.destinationLatitude != null ? Number(transportReq.destinationLatitude) : null,
      destination_longitude: transportReq.destinationLongitude != null ? Number(transportReq.destinationLongitude) : null,
      distance_km: transportReq.distanceKm != null ? Number(transportReq.distanceKm) : null,
      estimated_transit_minutes: transportReq.estimated_transit_minutes != null ? Number(transportReq.estimated_transit_minutes) : null,
      in_transit_at: transportReq.in_transit_at,
      progress_percentage: progressPct,
      vehicle: v
        ? {
            id: v.id,
            name: v.name,
            vehicle_number: v.vehicleNumber,
            vehicle_type: v.vehicleType,
            transporter_name: v.transporter?.fullName || null,
            latitude: vLat,
            longitude: vLon,
            location_label: locLabel,
            updated_at: v.locationUpdatedAt || null,
          }
        : null,
    });
  } catch (err: any) {
    console.error('Track transport request error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

