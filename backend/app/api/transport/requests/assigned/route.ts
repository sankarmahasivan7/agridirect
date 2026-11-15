import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { getAuthUser } from '@/lib/auth';
import { serializeTransportRequest } from '@/lib/transport';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser || authUser.role !== 'transporter') {
      return errorResponse('Forbidden: only transporters have assigned requests', 403);
    }

    const transporter = await prisma.transporterProfile.findUnique({
      where: { userId: authUser.id },
      include: { vehicle: true },
    });
    if (!transporter) return jsonResponse([]);

    const vehicleIds = transporter.vehicle ? [transporter.vehicle.id] : [];

    const requests = await prisma.transportRequest.findMany({
      where: {
        assignedVehicleId: { in: vehicleIds },
      },
      include: {
        assignedVehicle: { include: { transporter: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return jsonResponse(requests.map((r) => serializeTransportRequest(r)));
  } catch (err: any) {
    console.error('Assigned transport requests error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

