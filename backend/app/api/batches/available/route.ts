import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { getAuthUser } from '@/lib/auth';
import { serializeBatch } from '@/lib/batches';
import { evaluateDispatchReadiness } from '@/lib/logistics';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser || authUser.role !== 'transporter') {
      return errorResponse('Forbidden: only transporters can view available batches', 403);
    }

    const transporter = await prisma.transporterProfile.findUnique({
      where: { userId: authUser.id },
      include: { vehicle: true },
    });

    if (!transporter || !transporter.vehicle || !transporter.vehicle.isActive) {
      return jsonResponse([]);
    }

    const vehicle = transporter.vehicle;
    const batches = await prisma.deliveryBatch.findMany({
      where: {
        status: { in: ['BATCH_CREATED', 'TRANSPORTER_ASSIGNED'] as any },
        totalQuantityKg: { lte: vehicle.capacityKg },
        OR: [
          { assignedTransporterId: null },
          { assignedTransporterId: transporter.id },
        ],
      },
      include: {
        stops: true,
        fulfillmentItems: true,
        transporter: true,
        vehicle: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const eligibleBatches = batches.filter((b) => {
      const readiness = evaluateDispatchReadiness(
        Number(b.totalQuantityKg),
        Number(vehicle.capacityKg),
        vehicle.vehicleType
      );
      return readiness.is_eligible;
    });

    return jsonResponse(eligibleBatches.map((b) => serializeBatch(b)));
  } catch (err: any) {
    console.error('Available batches error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

