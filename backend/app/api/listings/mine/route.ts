import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { getAuthUser } from '@/lib/auth';
import { serializeListing } from '@/lib/listings';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser || (authUser.role !== 'farmer' && authUser.role !== 'fpo')) {
      return errorResponse('Forbidden: only farmers and FPOs have listings', 403);
    }

    let farmerProfileId: number | null = null;
    let fpoProfileId: number | null = null;

    if (authUser.role === 'farmer') {
      const fp = await prisma.farmerProfile.findUnique({
        where: { userId: authUser.userId },
      });
      if (!fp) return jsonResponse([]);
      farmerProfileId = fp.id;
    } else {
      const fpo = await prisma.fpoProfile.findUnique({
        where: { userId: authUser.userId },
      });
      if (!fpo) return jsonResponse([]);
      fpoProfileId = fpo.id;
    }

    const listings = await prisma.productListing.findMany({
      where: {
        ...(farmerProfileId ? { farmerId: farmerProfileId } : {}),
        ...(fpoProfileId ? { fpoId: fpoProfileId } : {}),
      },
      include: {
        product: { include: { category: true } },
        farmer: { include: { reviews: true } },
        fpo: true,
        reviews: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return jsonResponse(listings.map((l) => serializeListing(l)));
  } catch (err: any) {
    console.error('My listings error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

