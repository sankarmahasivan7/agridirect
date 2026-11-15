import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import prisma from '@/lib/prisma';
import { serializeBatch } from '@/lib/batches';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET() {
  try {
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

    return jsonResponse({
      plans_count: batches.length,
      plans: batches.map((b) => serializeBatch(b)),
    });
  } catch (err: any) {
    console.error('AI logistics plans error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

