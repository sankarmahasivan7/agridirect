import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { getAuthUser } from '@/lib/auth';
import { serializeOrder } from '@/lib/orders';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = parseInt(params.id, 10);
    if (isNaN(orderId)) return errorResponse('Invalid order ID', 400);

    const authUser = await getAuthUser(req);
    if (!authUser || (authUser.role !== 'transporter' && authUser.role !== 'admin')) {
      return errorResponse('Forbidden: only transporters or admins can record COD collection', 403);
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        buyer: true,
        items: { include: { listing: { include: { product: true } } } },
        transportRequests: true,
        payment: true,
      },
    });

    if (!order) return errorResponse('Order not found', 404);

    const now = new Date();
    await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: 'PAID',
        paidAt: now,
      },
    });

    await prisma.payment.updateMany({
      where: { orderId },
      data: {
        paymentStatus: 'PAID',
        paidAt: now,
      },
    });

    const refreshed = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        buyer: true,
        items: { include: { listing: { include: { product: true } } } },
        transportRequests: true,
        payment: true,
      },
    });

    return jsonResponse(serializeOrder(refreshed));
  } catch (err: any) {
    console.error('Collect COD error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

