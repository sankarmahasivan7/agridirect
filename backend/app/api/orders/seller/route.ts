import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { getAuthUser } from '@/lib/auth';
import { serializeOrder } from '@/lib/orders';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser || (authUser.role !== 'farmer' && authUser.role !== 'fpo')) {
      return errorResponse('Forbidden: only farmers and FPOs have seller orders', 403);
    }

    let farmerProfileId: number | null = null;
    let fpoProfileId: number | null = null;

    if (authUser.role === 'farmer') {
      const fp = await prisma.farmerProfile.findUnique({
        where: { userId: authUser.id },
      });
      if (!fp) return jsonResponse([]);
      farmerProfileId = fp.id;
    } else {
      const fpo = await prisma.fpoProfile.findUnique({
        where: { userId: authUser.id },
      });
      if (!fpo) return jsonResponse([]);
      fpoProfileId = fpo.id;
    }

    const orders = await prisma.order.findMany({
      where: {
        items: {
          some: {
            listing: {
              ...(farmerProfileId ? { farmerId: farmerProfileId } : {}),
              ...(fpoProfileId ? { fpoId: fpoProfileId } : {}),
            },
          },
        },
      },
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
      orderBy: { createdAt: 'desc' },
    });

    return jsonResponse(orders.map((o) => serializeOrder(o)));
  } catch (err: any) {
    console.error('Seller orders error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

