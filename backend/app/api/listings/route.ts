import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { getAuthUser } from '@/lib/auth';
import { serializeListing, checkAndAssignAdvanceDemands } from '@/lib/listings';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const categoryName = searchParams.get('category');
    const district = searchParams.get('district');

    const listings = await prisma.productListing.findMany({
      where: {
        isActive: true,
        ...(categoryName
          ? {
              product: {
                category: {
                  name: { contains: categoryName },
                },
              },
            }
          : {}),
        ...(district
          ? {
              OR: [
                { location: { contains: district } },
                { farmer: { district: { contains: district } } },
              ],
            }
          : {}),
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
    console.error('Get listings error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser || (authUser.role !== 'farmer' && authUser.role !== 'fpo')) {
      return errorResponse('Forbidden: only farmers and FPOs can create listings', 403);
    }

    const body = await req.json();
    const {
      product_name,
      category_name,
      quantity_available,
      unit,
      price_per_unit,
      quality_grade,
      harvest_date,
      available_from,
      available_until,
      location,
      min_order_quantity,
      is_perishable,
      shelf_life_days,
      expected_sell_by_date,
      perishability_level,
      storage_requirement,
      certification_info,
      image_url,
    } = body;

    if (!product_name || !category_name || quantity_available == null || price_per_unit == null) {
      return errorResponse('Product name, category name, quantity, and price are required', 400);
    }

    // Get or create category
    let category = await prisma.category.findFirst({
      where: { name: category_name },
    });
    if (!category) {
      category = await prisma.category.create({
        data: { name: category_name },
      });
    }

    // Get or create product
    let product = await prisma.product.findFirst({
      where: { name: product_name, categoryId: category.id },
    });
    if (!product) {
      product = await prisma.product.create({
        data: {
          name: product_name,
          categoryId: category.id,
          defaultUnit: unit || 'kg',
        },
      });
    }

    let farmerProfileId: number | null = null;
    let fpoProfileId: number | null = null;

    if (authUser.role === 'farmer') {
      const fp = await prisma.farmerProfile.findUnique({
        where: { userId: authUser.userId },
      });
      if (!fp) return errorResponse('Farmer profile not found', 404);
      farmerProfileId = fp.id;
    } else {
      const fpo = await prisma.fpoProfile.findUnique({
        where: { userId: authUser.userId },
      });
      if (!fpo) return errorResponse('FPO profile not found', 404);
      fpoProfileId = fpo.id;
    }

    let sellByDate = expected_sell_by_date ? new Date(expected_sell_by_date) : null;
    if (!sellByDate && (is_perishable ?? true)) {
      const base = harvest_date ? new Date(harvest_date) : new Date();
      const life = shelf_life_days ? Number(shelf_life_days) : 7;
      sellByDate = new Date(base.getTime() + life * 24 * 3600 * 1000);
    }

    const listing = await prisma.productListing.create({
      data: {
        productId: product.id,
        farmerId: farmerProfileId,
        fpoId: fpoProfileId,
        quantityAvailable: Number(quantity_available),
        unit: unit || 'kg',
        pricePerUnit: Number(price_per_unit),
        qualityGrade: quality_grade || 'A',
        harvestDate: harvest_date ? new Date(harvest_date) : null,
        availableFrom: available_from ? new Date(available_from) : null,
        availableUntil: available_until ? new Date(available_until) : null,
        location: location || null,
        minOrderQuantity: min_order_quantity ? Number(min_order_quantity) : 0,
        isPerishable: is_perishable ?? true,
        shelfLifeDays: shelf_life_days ? Number(shelf_life_days) : null,
        expectedSellByDate: sellByDate,
        perishabilityLevel: perishability_level || 'HIGH',
        storageRequirement: storage_requirement || 'AMBIENT',
        certificationInfo: certification_info || null,
        imageUrl: image_url || null,
        isActive: true,
      },
      include: {
        product: { include: { category: true } },
        farmer: { include: { reviews: true } },
        fpo: true,
        reviews: true,
      },
    });

    await checkAndAssignAdvanceDemands(listing.id);

    const refreshed = await prisma.productListing.findUnique({
      where: { id: listing.id },
      include: {
        product: { include: { category: true } },
        farmer: { include: { reviews: true } },
        fpo: true,
        reviews: true,
      },
    });

    return jsonResponse(serializeListing(refreshed || listing), 201);
  } catch (err: any) {
    console.error('Create listing error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

