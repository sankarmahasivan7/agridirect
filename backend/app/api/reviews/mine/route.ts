import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { getAuthUser } from '@/lib/auth';
import { serializeReview } from '@/lib/reviews';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return errorResponse('Not authenticated', 401);

    const buyer = await prisma.buyerProfile.findUnique({
      where: { userId: authUser.userId },
    });
    if (!buyer) return jsonResponse([]);

    const reviews = await prisma.review.findMany({
      where: { buyerId: buyer.id },
      include: { buyer: true, farmer: true, product: true },
      orderBy: { createdAt: 'desc' },
    });

    return jsonResponse(reviews.map((r) => serializeReview(r)));
  } catch (err: any) {
    console.error('My reviews error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

