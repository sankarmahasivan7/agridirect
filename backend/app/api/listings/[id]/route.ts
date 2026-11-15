import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { getAuthUser } from '@/lib/auth';
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
    console.error('Get listing detail error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const listingId = parseInt(params.id, 10);
    if (isNaN(listingId)) return errorResponse('Invalid listing ID', 400);

    const authUser = await getAuthUser(req);
    if (!authUser || (authUser.role !== 'farmer' && authUser.role !== 'fpo')) {
      return errorResponse('Forbidden: only farmers and FPOs can update listings', 403);
    }

    const listing = await prisma.productListing.findUnique({
      where: { id: listingId },
      include: { farmer: true, fpo: true },
    });
    if (!listing) return errorResponse('Listing not found', 404);

    const owns =
      (authUser.role === 'farmer' && listing.farmer?.userId === authUser.userId) ||
      (authUser.role === 'fpo' && listing.fpo?.userId === authUser.userId);

    if (!owns) return errorResponse('You do not own this listing', 403);

    const body = await req.json();
    const updateData: any = {};
    if (body.quantity_available !== undefined) updateData.quantityAvailable = Number(body.quantity_available);
    if (body.price_per_unit !== undefined) updateData.pricePerUnit = Number(body.price_per_unit);
    if (body.unit !== undefined) updateData.unit = body.unit;
    if (body.quality_grade !== undefined) updateData.qualityGrade = body.quality_grade;
    if (body.location !== undefined) updateData.location = body.location;
    if (body.min_order_quantity !== undefined) updateData.minOrderQuantity = Number(body.min_order_quantity);
    if (body.is_active !== undefined) updateData.isActive = Boolean(body.is_active);
    if (body.is_perishable !== undefined) updateData.isPerishable = Boolean(body.is_perishable);
    if (body.shelf_life_days !== undefined) updateData.shelfLifeDays = Number(body.shelf_life_days);
    if (body.expected_sell_by_date !== undefined) updateData.expectedSellByDate = new Date(body.expected_sell_by_date);
    if (body.storage_requirement !== undefined) updateData.storageRequirement = body.storage_requirement;
    if (body.image_url !== undefined) updateData.imageUrl = body.image_url;

    const updated = await prisma.productListing.update({
      where: { id: listingId },
      data: updateData,
      include: {
        product: { include: { category: true } },
        farmer: { include: { reviews: true } },
        fpo: true,
        reviews: true,
      },
    });

    return jsonResponse(serializeListing(updated));
  } catch (err: any) {
    console.error('Update listing error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const listingId = parseInt(params.id, 10);
    if (isNaN(listingId)) return errorResponse('Invalid listing ID', 400);

    const authUser = await getAuthUser(req);
    if (!authUser || (authUser.role !== 'farmer' && authUser.role !== 'fpo')) {
      return errorResponse('Forbidden', 403);
    }

    const listing = await prisma.productListing.findUnique({
      where: { id: listingId },
      include: { farmer: true, fpo: true },
    });
    if (!listing) return errorResponse('Listing not found', 404);

    const owns =
      (authUser.role === 'farmer' && listing.farmer?.userId === authUser.userId) ||
      (authUser.role === 'fpo' && listing.fpo?.userId === authUser.userId);

    if (!owns) return errorResponse('You do not own this listing', 403);

    const hasOrders = await prisma.orderItem.findFirst({
      where: { listingId },
    });

    if (hasOrders) {
      await prisma.productListing.update({
        where: { id: listingId },
        data: { isActive: false },
      });
    } else {
      await prisma.productListing.delete({
        where: { id: listingId },
      });
    }

    return jsonResponse({ success: true }, 200);
  } catch (err: any) {
    console.error('Delete listing error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

