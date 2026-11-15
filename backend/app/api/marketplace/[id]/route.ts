import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { serializeListing } from '@/lib/listings';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const listingId = parseInt(params.id, 10);
    if (isNaN(listingId)) return errorResponse('Invalid listing ID', 400);

    const listing = await prisma.productListing.findUnique({
      where: { id: listingId },
      include: {
        product: { include: { category: true } },
        farmer: { include: { reviews: true } },
        fpo: true,
        reviews: true,
      },
    });

    if (!listing) return errorResponse('Listing not found', 404);
    return jsonResponse(serializeListing(listing));
  } catch (err: any) {
    console.error('Marketplace item error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

