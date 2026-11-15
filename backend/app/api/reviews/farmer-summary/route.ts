import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { getAuthUser } from '@/lib/auth';
import { buildRatingSummary } from '@/lib/reviews';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser || authUser.role !== 'farmer') {
      return errorResponse('Forbidden: only farmers can access farmer review summary', 403);
    }

    const farmer = await prisma.farmerProfile.findUnique({
      where: { userId: authUser.userId },
    });
    if (!farmer) {
      return jsonResponse(buildRatingSummary([]));
    }

    const reviews = await prisma.review.findMany({
      where: { farmerId: farmer.id },
      include: { buyer: true, farmer: true, product: true },
      orderBy: { createdAt: 'desc' },
    });

    return jsonResponse(buildRatingSummary(reviews));
  } catch (err: any) {
    console.error('Farmer review summary error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

