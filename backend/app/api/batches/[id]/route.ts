import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { serializeBatch } from '@/lib/batches';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const batchId = parseInt(params.id, 10);
    if (isNaN(batchId)) return errorResponse('Invalid batch ID', 400);

    const batch = await prisma.deliveryBatch.findUnique({
      where: { id: batchId },
      include: {
        stops: true,
        fulfillmentItems: true,
        transporter: true,
        vehicle: true,
      },
    });

    if (!batch) return errorResponse('Batch not found', 404);
    return jsonResponse(serializeBatch(batch));
  } catch (err: any) {
    console.error('Batch detail error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

