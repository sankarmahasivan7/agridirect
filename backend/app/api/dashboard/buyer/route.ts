import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { getAuthUser } from '@/lib/auth';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser || authUser.role !== 'buyer') {
      return errorResponse('Forbidden: only buyers can access buyer dashboard', 403);
    }

    const buyer = await prisma.buyerProfile.findUnique({
      where: { userId: authUser.userId },
      include: { orders: true },
    });

    if (!buyer) {
      return jsonResponse({
        total_orders: 0,
        total_spent: '0',
        message: 'You have no orders yet.',
        orders_by_status: {},
      });
    }

    const orders = buyer.orders;
    const totalSpent = orders.reduce((acc, o) => acc + Number(o.totalAmount), 0);

    const ordersByStatus: Record<string, number> = {};
    for (const o of orders) {
      ordersByStatus[o.status] = (ordersByStatus[o.status] || 0) + 1;
    }

    return jsonResponse({
      total_orders: orders.length,
      total_spent: totalSpent.toFixed(2),
      orders_by_status: ordersByStatus,
    });
  } catch (err: any) {
    console.error('Buyer dashboard error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

