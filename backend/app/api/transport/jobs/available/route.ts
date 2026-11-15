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
      return errorResponse('Forbidden: only transporters can view available jobs', 403);
    }

    const transporter = await prisma.transporterProfile.findUnique({
      where: { userId: authUser.id },
      include: { vehicle: true },
    });
    if (!transporter) return jsonResponse([]);

    const vehicleIds = transporter.vehicle ? [transporter.vehicle.id] : [];

    const jobs = await prisma.transportRequest.findMany({
      where: {
        OR: [
          { assignedVehicleId: null, status: 'PENDING' },
          { assignedVehicleId: { in: vehicleIds }, status: { in: ['PENDING', 'ASSIGNED'] } },
        ],
      },
      include: {
        assignedVehicle: { include: { transporter: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return jsonResponse(jobs.map((j) => serializeTransportRequest(j)));
  } catch (err: any) {
    console.error('Available transport jobs error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

