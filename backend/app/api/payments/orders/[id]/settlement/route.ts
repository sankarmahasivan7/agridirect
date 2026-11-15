import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { getAuthUser } from '@/lib/auth';

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
        items: { include: { listing: { include: { farmer: true, fpo: true } } } },
        transportRequests: { include: { assignedVehicle: { include: { transporter: true } } } },
        payment: true,
      },
    });

    if (!order) return errorResponse('Order not found', 404);

    const farmerAmount = Number(order.farmerSettlementAmount || order.subtotal);
    const transporterAmount = Number(order.transporterSettlementAmount || order.logisticsCost);
    const platformFee = Number(order.platformCommissionAmount || order.platformFee);
    const totalAmount = Number(order.totalAmount);

    return jsonResponse({
      order_id: order.id,
      total_amount: totalAmount,
      subtotal: Number(order.subtotal),
      logistics_cost: Number(order.logisticsCost),
      platform_fee: platformFee,
      payment_method: order.paymentMethod,
      payment_status: order.paymentStatus,
      paid_at: order.paidAt,
      farmer_settlement: {
        amount: farmerAmount,
        status: order.paymentStatus === 'PAID' ? 'CREDITED' : 'PENDING',
      },
      transporter_settlement: {
        amount: transporterAmount,
        status: order.paymentStatus === 'PAID' ? 'CREDITED' : 'PENDING',
      },
      platform_commission: {
        amount: platformFee,
        percentage: 2.0,
      },
    });
  } catch (err: any) {
    console.error('Order settlement error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

