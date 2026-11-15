import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { getAuthUser } from '@/lib/auth';

export async function OPTIONS() {
  return handleOptions();
}

export async function PUT(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser || (authUser.role !== 'transporter' && authUser.role !== 'admin')) {
      return errorResponse('Forbidden: only transporters can update vehicle location', 403);
    }

    const body = await req.json();
    const { vehicle_id, latitude, longitude, location_label } = body;

    let targetVehicleId = vehicle_id ? Number(vehicle_id) : null;
    if (!targetVehicleId) {
      const tp = await prisma.transporterProfile.findUnique({
        where: { userId: authUser.id },
        include: { vehicle: true },
      });
      if (!tp || !tp.vehicle) {
        return errorResponse('No vehicle registered for this transporter', 400);
      }
      targetVehicleId = tp.vehicle.id;
    }

    const updated = await prisma.vehicle.update({
      where: { id: targetVehicleId },
      data: {
        currentLatitude: latitude != null ? Number(latitude) : undefined,
        currentLongitude: longitude != null ? Number(longitude) : undefined,
        locationLabel: location_label || undefined,
        locationUpdatedAt: new Date(),
      },
    });

    return jsonResponse({
      id: updated.id,
      name: updated.name,
      vehicle_number: updated.vehicleNumber,
      vehicle_type: updated.vehicleType,
      capacity_kg: Number(updated.capacityKg),
      current_latitude: updated.currentLatitude != null ? Number(updated.currentLatitude) : null,
      current_longitude: updated.currentLongitude != null ? Number(updated.currentLongitude) : null,
      location_label: updated.locationLabel,
      location_updated_at: updated.locationUpdatedAt,
    });
  } catch (err: any) {
    console.error('Update vehicle location error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}
