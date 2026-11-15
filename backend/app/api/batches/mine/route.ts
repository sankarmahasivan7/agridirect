import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { getAuthUser } from '@/lib/auth';
import { serializeBatch } from '@/lib/batches';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser || authUser.role !== 'transporter') {
      return errorResponse('Forbidden: only transporters have batches', 403);
    }

    const transporter = await prisma.transporterProfile.findUnique({
      where: { userId: authUser.userId },
    });
    if (!transporter) return jsonResponse([]);

    const batches = await prisma.deliveryBatch.findMany({
      where: { assignedTransporterId: transporter.id },
      include: {
        stops: true,
        fulfillmentItems: true,
        transporter: true,
        vehicle: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return jsonResponse(batches.map((b) => serializeBatch(b)));
  } catch (err: any) {
    console.error('My batches error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

