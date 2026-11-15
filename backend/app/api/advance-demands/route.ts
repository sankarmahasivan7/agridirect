import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { getAuthUser } from '@/lib/auth';
import { serializeAdvanceDemand } from '@/lib/advanceDemands';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET() {
  try {
    const demands = await prisma.bulkRequirement.findMany({
      include: {
        product: true,
        buyer: { include: { user: true } },
        matches: { include: { listing: { include: { farmer: true, fpo: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return jsonResponse(demands.map((d) => serializeAdvanceDemand(d)));
  } catch (err: any) {
    console.error('Get advance demands error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser || authUser.role !== 'buyer') {
      return errorResponse('Forbidden: only buyers can create advance demands', 403);
    }

    const buyer = await prisma.buyerProfile.findUnique({
      where: { userId: authUser.userId },
    });
    if (!buyer) return errorResponse('Buyer profile required', 400);

    const body = await req.json();
    const {
      product_name,
      required_quantity,
      unit,
      needed_by,
      delivery_location,
      quality_grade,
      delivery_latitude,
      delivery_longitude,
    } = body;

    if (!product_name || !required_quantity) {
      return errorResponse('product_name and required_quantity are required', 400);
    }

    const cleanName = product_name.trim();
    let product = await prisma.product.findFirst({
      where: { name: { contains: cleanName } },
    });

    if (!product) {
      let category = await prisma.category.findFirst();
      if (!category) {
        category = await prisma.category.create({ data: { name: 'Vegetables' } });
      }
      product = await prisma.product.create({
        data: {
          name: cleanName,
          categoryId: category.id,
          defaultUnit: unit || 'kg',
        },
      });
    }

    const reqQty = Number(required_quantity);
    const demand = await prisma.bulkRequirement.create({
      data: {
        buyerId: buyer.id,
        productId: product.id,
        requiredQuantity: reqQty,
        unit: unit || 'kg',
        neededBy: needed_by ? new Date(needed_by) : new Date(Date.now() + 7 * 24 * 3600 * 1000),
        deliveryLocation: delivery_location || 'Customer Destination',
        qualityGrade: quality_grade || 'A',
        deliveryLatitude: delivery_latitude != null ? Number(delivery_latitude) : null,
        deliveryLongitude: delivery_longitude != null ? Number(delivery_longitude) : null,
        status: 'OPEN',
      },
    });

    // Broadcast push notifications to all farmers
    const farmers = await prisma.user.findMany({
      where: { role: 'farmer', isActive: true },
    });
    for (const f of farmers) {
      await prisma.notification.create({
        data: {
          userId: f.id,
          title: `📢 Advance Demand: ${reqQty} kg ${product.name}`,
          message: `Buyer needs ${reqQty} kg ${product.name} in ${delivery_location || 'district'}. Deliver to warehouse to secure first-priority guaranteed sale!`,
          notificationType: 'DEMAND',
          link: '/farmer/inventory',
          isRead: false,
        },
      });
    }

    // Auto-match if active listings exist
    const existingListings = await prisma.productListing.findMany({
      where: {
        productId: product.id,
        isActive: true,
        quantityAvailable: { gt: 0 },
      },
      orderBy: { createdAt: 'asc' },
    });

    let remainingNeeded = reqQty;
    for (const l of existingListings) {
      if (remainingNeeded <= 0) break;
      const avail = Number(l.quantityAvailable);
      const alloc = Math.min(avail, remainingNeeded);
      if (alloc > 0) {
        await prisma.supplierMatch.create({
          data: {
            requirementId: demand.id,
            listingId: l.id,
            matchedQuantity: alloc,
            farmerPrice: l.pricePerUnit,
            logisticsCost: 0,
            platformFee: 0,
          },
        });
        await prisma.productListing.update({
          where: { id: l.id },
          data: {
            quantityAvailable: avail - alloc,
            isActive: avail - alloc > 0,
          },
        });
        remainingNeeded -= alloc;
      }
    }

    const finalStatus = remainingNeeded <= 0 ? 'MATCHED' : (remainingNeeded < reqQty ? 'PARTIALLY_MATCHED' : 'OPEN');
    await prisma.bulkRequirement.update({
      where: { id: demand.id },
      data: { status: finalStatus },
    });

    const refreshed = await prisma.bulkRequirement.findUnique({
      where: { id: demand.id },
      include: {
        product: true,
        buyer: { include: { user: true } },
        matches: { include: { listing: { include: { farmer: true, fpo: true } } } },
      },
    });

    return jsonResponse(serializeAdvanceDemand(refreshed || demand), 201);
  } catch (err: any) {
    console.error('Create advance demand error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

