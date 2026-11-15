import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { serializeBatch } from '@/lib/batches';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const deliveryArea = searchParams.get('delivery_area');
    const statusFilter = searchParams.get('status_filter');

    const batches = await prisma.deliveryBatch.findMany({
      where: {
        ...(deliveryArea ? { deliveryArea } : {}),
        ...(statusFilter ? { status: statusFilter as any } : {}),
      },
      include: {
        stops: true,
        fulfillmentItems: true,
        transporter: true,
        vehicle: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return jsonResponse(batches.map((b) => serializeBatch(b)));
  } catch (err: any) {
    console.error('List batches error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}
