import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { getAuthUser } from '@/lib/auth';
import { serializeBatch } from '@/lib/batches';
import { acceptDeliveryBatch } from '@/lib/fulfillment';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const batchId = parseInt(params.id, 10);
    if (isNaN(batchId)) return errorResponse('Invalid batch ID', 400);

    const authUser = await getAuthUser(req);
    if (!authUser || authUser.role !== 'transporter') {
      return errorResponse('Forbidden: only transporters can accept batches', 403);
    }

    const transporter = await prisma.transporterProfile.findUnique({
      where: { userId: authUser.userId },
    });
    if (!transporter) return errorResponse('Transporter profile not found', 404);

    const acceptedBatch = await acceptDeliveryBatch(batchId, transporter.id);

    const refreshed = await prisma.deliveryBatch.findUnique({
      where: { id: batchId },
      include: {
        stops: true,
        fulfillmentItems: true,
        transporter: true,
        vehicle: true,
      },
    });

    return jsonResponse(serializeBatch(refreshed || acceptedBatch));
  } catch (err: any) {
    console.error('Accept batch error:', err);
    return errorResponse(err.message || 'Internal server error', 400);
  }
}

