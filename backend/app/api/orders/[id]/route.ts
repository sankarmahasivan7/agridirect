import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { getAuthUser } from '@/lib/auth';
import { serializeOrder } from '@/lib/orders';

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

    const authUser = await getAuthUser(req);
    if (!authUser) return errorResponse('Not authenticated', 401);

    const order = await prisma.order.findUnique({
      where: { id: orderId },
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
    });

    if (!order) return errorResponse('Order not found', 404);
    return jsonResponse(serializeOrder(order));
  } catch (err: any) {
    console.error('Get order error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

