import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import prisma from '@/lib/prisma';
import { serializeAdvanceDemand } from '@/lib/advanceDemands';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET() {
  try {
    const demands = await prisma.bulkRequirement.findMany({
      where: {
        status: { in: ['OPEN', 'PARTIALLY_MATCHED'] },
      },
      include: {
        product: true,
        buyer: { include: { user: true } },
        matches: { include: { listing: { include: { farmer: true, fpo: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return jsonResponse(demands.map((d) => serializeAdvanceDemand(d)));
  } catch (err: any) {
    console.error('Open advance demands error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

