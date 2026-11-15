import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { getAuthUser } from '@/lib/auth';
import { serializeTransportRequest } from '@/lib/transport';
import { notifyTransportAccepted } from '@/lib/notifications';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const jobId = parseInt(params.id, 10);
    if (isNaN(jobId)) return errorResponse('Invalid job ID', 400);

    const authUser = await getAuthUser(req);
    if (!authUser || authUser.role !== 'transporter') {
      return errorResponse('Forbidden: only transporters can accept transport jobs', 403);
    }

    const transporter = await prisma.transporterProfile.findUnique({
      where: { userId: authUser.id },
      include: { vehicle: true },
    });

    if (!transporter || !transporter.vehicle || !transporter.vehicle.isActive) {
      return errorResponse('No active vehicle registered for this transporter', 400);
    }

    const vehicle = transporter.vehicle;

    const job = await prisma.transportRequest.findUnique({
      where: { id: jobId },
    });

    if (!job) return errorResponse('Transport job not found', 404);

    if (job.status !== 'PENDING' && job.status !== 'ASSIGNED') {
      return errorResponse(`Cannot accept job with status '${job.status}'. Already claimed or in transit.`, 400);
    }

    const updated = await prisma.transportRequest.update({
      where: { id: jobId },
      data: {
        assignedVehicleId: vehicle.id,
        vehicleCapacityKg: vehicle.capacityKg,
        status: 'ACCEPTED',
      },
      include: {
        assignedVehicle: { include: { transporter: true } },
      },
    });

    await notifyTransportAccepted(jobId);

    return jsonResponse(serializeTransportRequest(updated));
  } catch (err: any) {
    console.error('Accept transport job error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

