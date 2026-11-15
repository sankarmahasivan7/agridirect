import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { getAuthUser } from '@/lib/auth';
import { serializeOrder } from '@/lib/orders';
import { dispatchOrderFulfillment } from '@/lib/fulfillment';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return errorResponse('Not authenticated', 401);

    const body = await req.json();
    const { order_id, utr_number } = body;
    if (!order_id) return errorResponse('order_id is required', 400);

    const orderId = Number(order_id);
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        buyer: true,
        items: { include: { listing: { include: { product: true } } } },
        transportRequests: true,
        payment: true,
      },
    });

    if (!order) return errorResponse(`Order #${orderId} not found`, 404);

    if (order.paymentStatus === 'PAID') {
      return jsonResponse(serializeOrder(order));
    }

    const now = new Date();
    const txRef = utr_number ? String(utr_number).trim() : `UPI_QR_${order.id}_${Math.floor(now.getTime() / 1000)}`;

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentMethod: 'UPI',
        paymentStatus: 'PAID',
        status: 'CONFIRMED',
        paidAt: now,
      },
      include: {
        buyer: true,
        items: { include: { listing: { include: { product: true } } } },
        transportRequests: true,
        payment: true,
      },
    });

    const existingPayment = updated.payment;
    if (existingPayment) {
      await prisma.payment.update({
        where: { id: existingPayment.id },
        data: {
          paymentStatus: 'PAID',
          gateway: 'UPI_QR',
          gatewayPaymentId: txRef,
          paidAt: now,
        },
      });
    } else {
      await prisma.payment.create({
        data: {
          orderId: order.id,
          amount: order.totalAmount,
          currency: 'INR',
          paymentMethod: 'UPI',
          paymentStatus: 'PAID',
          gateway: 'UPI_QR',
          gatewayPaymentId: txRef,
          farmerAmount: order.farmerSettlementAmount,
          transporterAmount: order.transporterSettlementAmount,
          commissionAmount: order.platformCommissionAmount,
          paidAt: now,
        },
      });
    }

    await dispatchOrderFulfillment(order.id);

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
    console.error('Confirm QR payment error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

