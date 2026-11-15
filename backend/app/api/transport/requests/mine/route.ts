import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { getAuthUser } from '@/lib/auth';
import { serializeTransportRequest } from '@/lib/transport';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return errorResponse('Not authenticated', 401);

    const requests = await prisma.transportRequest.findMany({
      where: { requestedByUserId: authUser.userId },
      include: {
        assignedVehicle: { include: { transporter: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return jsonResponse(requests.map((r) => serializeTransportRequest(r)));
  } catch (err: any) {
    console.error('My transport requests error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

