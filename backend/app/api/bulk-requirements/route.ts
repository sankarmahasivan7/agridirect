import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { getAuthUser } from '@/lib/auth';
import { serializeAdvanceDemand } from '@/lib/advanceDemands';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser || authUser.role !== 'buyer') {
      return errorResponse('Forbidden: only buyers can create bulk requirements', 403);
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

    let product = await prisma.product.findFirst({
      where: { name: { contains: product_name.trim() } },
    });

    if (!product) {
      let category = await prisma.category.findFirst();
      if (!category) {
        category = await prisma.category.create({ data: { name: 'Vegetables' } });
      }
      product = await prisma.product.create({
        data: {
          name: product_name.trim(),
          categoryId: category.id,
          defaultUnit: unit || 'kg',
        },
      });
    }

    const demand = await prisma.bulkRequirement.create({
      data: {
        buyerId: buyer.id,
        productId: product.id,
        requiredQuantity: Number(required_quantity),
        unit: unit || 'kg',
        neededBy: needed_by ? new Date(needed_by) : new Date(Date.now() + 7 * 24 * 3600 * 1000),
        deliveryLocation: delivery_location || 'Customer Destination',
        qualityGrade: quality_grade || 'A',
        deliveryLatitude: delivery_latitude != null ? Number(delivery_latitude) : null,
        deliveryLongitude: delivery_longitude != null ? Number(delivery_longitude) : null,
        status: 'OPEN',
      },
      include: {
        product: true,
        buyer: { include: { user: true } },
        matches: true,
      },
    });

    return jsonResponse(serializeAdvanceDemand(demand), 201);
  } catch (err: any) {
    console.error('Create bulk requirement error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

