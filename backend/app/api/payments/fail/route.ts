import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { getAuthUser } from '@/lib/auth';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return errorResponse('Not authenticated', 401);

    const body = await req.json();
    const { order_id } = body;
    if (!order_id) return errorResponse('order_id is required', 400);

    const orderId = Number(order_id);
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) return errorResponse(`Order #${orderId} not found`, 404);

    if (order.paymentStatus === 'PAID') {
      return errorResponse('Cannot fail an already paid order', 400);
    }

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: 'FAILED',
          status: 'CANCELLED',
        },
      });

      await tx.payment.updateMany({
        where: { orderId },
        data: { paymentStatus: 'FAILED' },
      });

      // Restore inventory
      for (const item of order.items) {
        await tx.productListing.update({
          where: { id: item.listingId },
          data: {
            quantityAvailable: { increment: Number(item.quantity) },
            isActive: true,
          },
        });
      }
    });

    return jsonResponse({
      success: true,
      order_id: order.id,
      payment_status: 'FAILED',
      order_status: 'CANCELLED',
      message: 'Payment failed or cancelled. Produce inventory has been restored.',
    });
  } catch (err: any) {
    console.error('Payment fail error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

