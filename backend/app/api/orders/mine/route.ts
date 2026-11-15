import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { getAuthUser } from '@/lib/auth';
import { serializeOrder } from '@/lib/orders';

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

    const orders = await prisma.order.findMany({
      where: { buyerId: buyer.id },
      include: {
        buyer: true,
        items: {
          include: {
            listing: {
              include: { product: true },
            },
          },
        },
        transportRequests: true,
        payment: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return jsonResponse(orders.map((o) => serializeOrder(o)));
  } catch (err: any) {
    console.error('My orders error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

