import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { getAuthUser } from '@/lib/auth';
import { serializeAdvanceDemand } from '@/lib/advanceDemands';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser || authUser.role !== 'buyer') {
      return errorResponse('Forbidden: only buyers have advance demands', 403);
    }

    const buyer = await prisma.buyerProfile.findUnique({
      where: { userId: authUser.userId },
    });
    if (!buyer) return jsonResponse([]);

    const demands = await prisma.bulkRequirement.findMany({
      where: { buyerId: buyer.id },
      include: {
        product: true,
        buyer: { include: { user: true } },
        matches: { include: { listing: { include: { farmer: true, fpo: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return jsonResponse(demands.map((d) => serializeAdvanceDemand(d)));
  } catch (err: any) {
    console.error('My advance demands error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

