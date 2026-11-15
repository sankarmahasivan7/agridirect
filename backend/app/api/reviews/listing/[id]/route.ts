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
    const listingId = parseInt(params.id, 10);
    if (isNaN(listingId)) return errorResponse('Invalid listing ID', 400);

    const reviews = await prisma.review.findMany({
      where: { listingId },
      include: { buyer: true, farmer: true, product: true },
      orderBy: { createdAt: 'desc' },
    });

    return jsonResponse(buildRatingSummary(reviews));
  } catch (err: any) {
    console.error('Listing reviews error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

