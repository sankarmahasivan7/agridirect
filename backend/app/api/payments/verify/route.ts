import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { getAuthUser } from '@/lib/auth';
import { serializeOrder } from '@/lib/orders';
import { verifyRazorpaySignature } from '@/lib/payment';
import { dispatchOrderFulfillment } from '@/lib/fulfillment';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return errorResponse('Not authenticated', 401);

    const body = await req.json();
    const { order_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
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

    const isValid = verifyRazorpaySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValid) {
      await prisma.payment.updateMany({
        where: { orderId: order.id },
        data: { paymentStatus: 'FAILED' },
      });
      await prisma.order.update({
        where: { id: order.id },
        data: { paymentStatus: 'FAILED' },
      });
      return errorResponse('Razorpay signature verification failed. Untrusted payment attempt.', 400);
    }

    const now = new Date();
    await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentMethod: 'UPI',
        paymentStatus: 'PAID',
        status: 'CONFIRMED',
        paidAt: now,
      },
    });

    const existingPayment = order.payment;
    if (existingPayment) {
      await prisma.payment.update({
        where: { id: existingPayment.id },
        data: {
          paymentStatus: 'PAID',
          gatewayPaymentId: razorpay_payment_id,
          gatewaySignature: razorpay_signature,
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
          gateway: 'RAZORPAY',
          gatewayOrderId: razorpay_order_id,
          gatewayPaymentId: razorpay_payment_id,
          gatewaySignature: razorpay_signature,
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
    console.error('Verify payment error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

