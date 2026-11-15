import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { buildRatingSummary } from '@/lib/reviews';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const productId = parseInt(params.id, 10);
    if (isNaN(productId)) return errorResponse('Invalid product ID', 400);

    const reviews = await prisma.review.findMany({
      where: { productId },
      include: { buyer: true, farmer: true, product: true },
      orderBy: { createdAt: 'desc' },
    });

    return jsonResponse(buildRatingSummary(reviews));
  } catch (err: any) {
    console.error('Product reviews error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

