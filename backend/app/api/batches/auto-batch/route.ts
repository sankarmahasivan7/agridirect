import { NextRequest } from 'next/server';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { createDeliveryBatches } from '@/lib/fulfillment';
import { serializeBatch } from '@/lib/batches';
import prisma from '@/lib/prisma';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const district = searchParams.get('delivery_district');

    await createDeliveryBatches(district);

    const batches = await prisma.deliveryBatch.findMany({
      include: {
        stops: true,
        fulfillmentItems: true,
        transporter: true,
        vehicle: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return jsonResponse(batches.map((b) => serializeBatch(b)));
  } catch (err: any) {
    console.error('Auto batch error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

