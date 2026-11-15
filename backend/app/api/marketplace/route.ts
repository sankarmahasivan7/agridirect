import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { serializeListing, calculatePerishability } from '@/lib/listings';
import { haversineKm } from '@/lib/geo';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q');
    const category = searchParams.get('category');
    const location = searchParams.get('location');
    const minPrice = searchParams.get('min_price');
    const maxPrice = searchParams.get('max_price');
    const minQuantity = searchParams.get('min_quantity');
    const qualityGrade = searchParams.get('quality_grade');
    const isPerishable = searchParams.get('is_perishable');
    const channel = (searchParams.get('channel') || 'consumer').toUpperCase();
    const perishabilityStatus = searchParams.get('perishability_status');
    const buyerLat = searchParams.get('buyer_lat') ? parseFloat(searchParams.get('buyer_lat')!) : null;
    const buyerLon = searchParams.get('buyer_lon') ? parseFloat(searchParams.get('buyer_lon')!) : null;

    const listings = await prisma.productListing.findMany({
      where: {
        isActive: true,
        quantityAvailable: { gt: 0 },
        ...(q
          ? {
              product: {
                name: { contains: q },
              },
            }
          : {}),
        ...(category
          ? {
              product: {
                category: {
                  name: { contains: category },
                },
              },
            }
          : {}),
        ...(location ? { location: { contains: location } } : {}),
        ...(minPrice ? { pricePerUnit: { gte: parseFloat(minPrice) } } : {}),
        ...(maxPrice ? { pricePerUnit: { lte: parseFloat(maxPrice) } } : {}),
        ...(minQuantity ? { quantityAvailable: { gte: parseFloat(minQuantity) } } : {}),
        ...(qualityGrade ? { qualityGrade } : {}),
        ...(isPerishable != null ? { isPerishable: isPerishable === 'true' } : {}),
      },
      include: {
        product: { include: { category: true } },
        farmer: { include: { reviews: true } },
        fpo: true,
        reviews: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const results: { sortKey: any[]; data: any }[] = [];

    for (const listing of listings) {
      const { status, channels } = calculatePerishability(listing);

      // Food safety: never offer EXPIRED to consumers
      if (status === 'EXPIRED') continue;

      if (channel === 'CONSUMER' && !channels.includes('CONSUMER') && !channels.includes('RETAIL')) {
        // Allow general retail / consumer
      }

      if (perishabilityStatus && status.toUpperCase() !== perishabilityStatus.trim().toUpperCase()) {
        continue;
      }

      let distKm: number | null = null;
      let sLat: number | null = null;
      let sLon: number | null = null;

      if (listing.farmer?.farmLatitude != null && listing.farmer?.farmLongitude != null) {
        sLat = Number(listing.farmer.farmLatitude);
        sLon = Number(listing.farmer.farmLongitude);
      } else if (listing.fpo?.latitude != null && listing.fpo?.longitude != null) {
        sLat = Number(listing.fpo.latitude);
        sLon = Number(listing.fpo.longitude);
      }

      let strategy = 'direct';
      if (buyerLat != null && buyerLon != null && sLat != null && sLon != null) {
        distKm = haversineKm(buyerLat, buyerLon, sLat, sLon);
        strategy = distKm > 60 ? 'aggregation_hub' : 'direct';
      }

      const serialized = serializeListing(listing, distKm, strategy);

      let urgencyPriority = 1;
      if (['CRITICAL', 'URGENT'].includes(status) && distKm != null && distKm <= 50.0) {
        urgencyPriority = 0;
      }

      const sortKey = [
        buyerLat != null && buyerLon != null ? urgencyPriority : 0,
        distKm != null ? distKm : Infinity,
        -listing.id,
      ];

      results.push({ sortKey, data: serialized });
    }

    if (buyerLat != null && buyerLon != null) {
      results.sort((a, b) => {
        if (a.sortKey[0] !== b.sortKey[0]) return a.sortKey[0] - b.sortKey[0];
        if (a.sortKey[1] !== b.sortKey[1]) return a.sortKey[1] - b.sortKey[1];
        return a.sortKey[2] - b.sortKey[2];
      });
    }

    return jsonResponse(results.map((r) => r.data));
  } catch (err: any) {
    console.error('Marketplace browse error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

