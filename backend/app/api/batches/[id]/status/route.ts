import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { getAuthUser } from '@/lib/auth';
import { serializeBatch } from '@/lib/batches';
import { updateBatchStatus } from '@/lib/fulfillment';

export async function OPTIONS() {
  return handleOptions();
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const batchId = parseInt(params.id, 10);
    if (isNaN(batchId)) return errorResponse('Invalid batch ID', 400);

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

    const updated = await updateBatchStatus(
      batchId,
      newStatus,
      authUser.userId,
      authUser.role === 'admin',
      otp
    );

    const refreshed = await prisma.deliveryBatch.findUnique({
      where: { id: batchId },
      include: {
        stops: true,
        fulfillmentItems: true,
        transporter: true,
        vehicle: true,
      },
    });

    return jsonResponse(serializeBatch(refreshed || updated));
  } catch (err: any) {
    console.error('Update batch status error:', err);
    return errorResponse(err.message || 'Internal server error', 400);
  }
}

