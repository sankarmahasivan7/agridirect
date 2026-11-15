import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { getAuthUser } from '@/lib/auth';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser || authUser.role !== 'transporter') {
      return errorResponse('Forbidden: only transporters can access transporter dashboard', 403);
    }

    const transporter = await prisma.transporterProfile.findUnique({
      where: { userId: authUser.id },
      include: {
        vehicle: true,
        batches: {
          include: { stops: true },
        },
      },
    });

    if (!transporter) {
      return jsonResponse({
        total_deliveries: 0,
        active_jobs_count: 0,
        completed_deliveries_count: 0,
        total_earnings: '0',
        total_cargo_handled_kg: 0,
        vehicles_count: 0,
      });
    }

    const batches = transporter.batches;
    const completed = batches.filter((b) => b.status === 'DELIVERED');
    const active = batches.filter((b) =>
      ['ACCEPTED', 'READY_FOR_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(b.status)
    );
    const earnings = completed.reduce((acc, b) => acc + Number(b.estimatedLogisticsCost || 0), 0);
    const cargo = completed.reduce((acc, b) => acc + Number(b.totalQuantityKg || 0), 0);

    return jsonResponse({
      total_deliveries: batches.length,
      active_jobs_count: active.length,
      completed_deliveries_count: completed.length,
      total_earnings: earnings.toFixed(2),
      total_cargo_handled_kg: Math.round(cargo * 10) / 10,
      vehicles_count: transporter.vehicle ? 1 : 0,
      primary_vehicle: transporter.vehicle
        ? {
            id: transporter.vehicle.id,
            name: transporter.vehicle.name,
            vehicle_type: transporter.vehicle.vehicleType,
            capacity_kg: Number(transporter.vehicle.capacityKg),
          }
        : null,
    });
  } catch (err: any) {
    console.error('Transporter dashboard error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}
