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
    if (!authUser) return errorResponse('Not authenticated', 401);

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        buyer: true,
        items: true,
        transportRequests: true,
        fulfillmentItems: true,
      },
    });

    if (!order) return errorResponse('Order not found', 404);

    if (order.status !== 'PENDING' && order.status !== 'CONFIRMED') {
      return errorResponse(`Cannot cancel order in status '${order.status}'`, 400);
    }

    const now = new Date();
    const orderTime = new Date(order.createdAt).getTime();
    if (now.getTime() - orderTime > 60 * 60 * 1000) {
      return errorResponse('Cancellation window (1 hour) has expired', 400);
    }

    // Release inventory and cancel in transaction
    await prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        await tx.productListing.update({
          where: { id: item.listingId },
          data: {
            quantityAvailable: { increment: Number(item.quantity) },
            isActive: true,
          },
        });
      }

      await tx.orderFulfillmentItem.updateMany({
        where: { orderId: order.id },
        data: { status: 'CANCELLED' },
      });

      await tx.transportRequest.updateMany({
        where: { orderId: order.id },
        data: { status: 'CANCELLED' },
      });

      await tx.payment.updateMany({
        where: { orderId: order.id },
        data: { paymentStatus: 'FAILED' },
      });

      await tx.order.update({
        where: { id: order.id },
        data: { status: 'CANCELLED' },
      });
    });

    const refreshed = await prisma.order.findUnique({
      where: { id: order.id },
      include: {
        buyer: true,
        items: { include: { listing: { include: { product: true } } } },
        transportRequests: true,
        payment: true,
      },
    });

    return jsonResponse(serializeOrder(refreshed));
  } catch (err: any) {
    console.error('Cancel order error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

