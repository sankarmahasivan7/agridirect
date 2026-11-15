import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { getAuthUser } from '@/lib/auth';
import { serializeTransportRequest } from '@/lib/transport';
import { notifyTransportStatusUpdate } from '@/lib/notifications';

export async function OPTIONS() {
  return handleOptions();
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const requestId = parseInt(params.id, 10);
    if (isNaN(requestId)) return errorResponse('Invalid request ID', 400);

    const authUser = await getAuthUser(req);
    if (!authUser) return errorResponse('Not authenticated', 401);

    const { searchParams } = new URL(req.url);
    let newStatus = searchParams.get('new_status');
    let otp = searchParams.get('otp');

    if (!newStatus) {
      try {
        const body = await req.json();
        newStatus = body.new_status || body.status;
        otp = body.otp || otp;
      } catch {
        // ignore
      }
    }

    if (!newStatus) return errorResponse('new_status parameter is required', 400);

    const transportReq = await prisma.transportRequest.findUnique({
      where: { id: requestId },
      include: {
        order: { include: { buyer: true, payment: true } },
      },
    });

    if (!transportReq) return errorResponse('Transport request not found', 404);

    if (newStatus === 'DELIVERED') {
      if (transportReq.order?.deliveryOtp && authUser.role !== 'admin') {
        const submittedOtp = (otp || '').trim();
        if (submittedOtp !== transportReq.order.deliveryOtp.trim()) {
          return errorResponse('Invalid Delivery Verification OTP. Please ask the buyer for their 6-digit OTP.', 400);
        }
      }
    }

    const now = new Date();
    const updateData: any = { status: newStatus };
    if (newStatus === 'IN_TRANSIT') {
      updateData.in_transit_at = now;
      const dist = Number(transportReq.distanceKm || 0);
      updateData.estimated_transit_minutes = dist > 0 ? Math.max(1, Math.round((dist / 40.0) * 60)) : 30;
    }

    const updated = await prisma.transportRequest.update({
      where: { id: requestId },
      data: updateData,
      include: {
        assignedVehicle: { include: { transporter: true } },
      },
    });

    if (newStatus === 'DELIVERED' && transportReq.orderId) {
      const isPod = transportReq.order?.paymentMethod === 'PAY_ON_DELIVERY' && transportReq.order?.paymentStatus === 'PENDING';
      await prisma.order.update({
        where: { id: transportReq.orderId },
        data: {
          status: 'DELIVERED',
          ...(isPod ? { paymentStatus: 'PAID', paidAt: now } : {}),
        },
      });
      if (isPod) {
        await prisma.payment.updateMany({
          where: { orderId: transportReq.orderId },
          data: { paymentStatus: 'PAID', paidAt: now },
        });
      }
    }

    await notifyTransportStatusUpdate(transportReq.id, newStatus);

    return jsonResponse(serializeTransportRequest(updated));
  } catch (err: any) {
    console.error('Update transport request status error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

