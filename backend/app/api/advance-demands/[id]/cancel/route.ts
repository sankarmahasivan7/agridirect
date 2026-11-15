import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { getAuthUser } from '@/lib/auth';
import { serializeAdvanceDemand } from '@/lib/advanceDemands';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const demandId = parseInt(params.id, 10);
    if (isNaN(demandId)) return errorResponse('Invalid demand ID', 400);

    const authUser = await getAuthUser(req);
    if (!authUser) return errorResponse('Not authenticated', 401);

    const demand = await prisma.bulkRequirement.findUnique({
      where: { id: demandId },
      include: {
        matches: true,
      },
    });

    if (!demand) return errorResponse('Demand not found', 404);

    // Release any matched inventory back to farmer listings
    for (const match of demand.matches) {
      await prisma.productListing.update({
        where: { id: match.listingId },
        data: {
          quantityAvailable: { increment: Number(match.matchedQuantity) },
          isActive: true,
        },
      });
      await prisma.supplierMatch.delete({
        where: { id: match.id },
      });
    }

    const updated = await prisma.bulkRequirement.update({
      where: { id: demandId },
      data: { status: 'CANCELLED' },
      include: {
        product: true,
        buyer: { include: { user: true } },
        matches: { include: { listing: { include: { farmer: true, fpo: true } } } },
      },
    });

    return jsonResponse(serializeAdvanceDemand(updated));
  } catch (err: any) {
    console.error('Cancel advance demand error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

