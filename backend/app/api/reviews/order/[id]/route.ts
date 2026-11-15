import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { serializeReview } from '@/lib/reviews';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = parseInt(params.id, 10);
    if (isNaN(orderId)) return errorResponse('Invalid order ID', 400);

    const reviews = await prisma.review.findMany({
      where: { orderId },
      include: { buyer: true, farmer: true, product: true },
      orderBy: { createdAt: 'desc' },
    });

    return jsonResponse(reviews.map((r) => serializeReview(r)));
  } catch (err: any) {
    console.error('Order reviews error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

