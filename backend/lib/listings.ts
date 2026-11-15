import prisma from './prisma';

export function calculatePerishability(listing: any) {
  const isPerishable = listing.isPerishable ?? true;
  let sellBy = listing.expectedSellByDate ? new Date(listing.expectedSellByDate) : null;
  if (!sellBy && isPerishable) {
    const base = listing.harvestDate ? new Date(listing.harvestDate) : new Date();
    const life = listing.shelfLifeDays || 7;
    sellBy = new Date(base.getTime() + life * 24 * 3600 * 1000);
  }

  let daysRemaining: number | null = null;
  let status = 'FRESH';
  let channels = ['INTERSTATE', 'WHOLESALE', 'EXPORT', 'RETAIL'];

  if (sellBy) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffMs = sellBy.getTime() - today.getTime();
    daysRemaining = Math.ceil(diffMs / (24 * 3600 * 1000));

    if (!isPerishable) {
      status = 'FRESH';
      channels = ['INTERSTATE', 'WHOLESALE', 'EXPORT', 'RETAIL'];
    } else if (daysRemaining <= 0) {
      status = 'EXPIRED';
      channels = ['PROCESSING_ONLY', 'COMPOST'];
    } else if (daysRemaining <= 2) {
      status = 'CRITICAL';
      channels = ['LOCAL_RETAIL', 'QUICK_COMMERCE', 'PROCESSING'];
    } else if (daysRemaining <= 4) {
      status = 'URGENT';
      channels = ['WHOLESALE', 'RETAIL', 'INSTITUTIONAL'];
    } else {
      status = 'FRESH';
      channels = ['INTERSTATE', 'WHOLESALE', 'EXPORT', 'RETAIL'];
    }
  }

  return { sellBy, daysRemaining, status, channels };
}

export function serializeListing(listing: any, distanceKm?: number | null, recommendedStrategy?: string | null) {
  const { sellBy, daysRemaining, status, channels } = calculatePerishability(listing);

  let farmerRating = 5.0;
  let farmerReviewCount = 0;
  if (listing.farmer?.reviews) {
    farmerReviewCount = listing.farmer.reviews.length;
    if (farmerReviewCount > 0) {
      const sum = listing.farmer.reviews.reduce((acc: number, r: any) => acc + Number(r.rating || 0), 0);
      farmerRating = Math.round((sum / farmerReviewCount) * 10) / 10;
    }
  }

  let prodRating = farmerRating;
  let prodReviewCount = 0;
  if (listing.reviews) {
    prodReviewCount = listing.reviews.length;
    if (prodReviewCount > 0) {
      const sum = listing.reviews.reduce((acc: number, r: any) => acc + Number(r.rating || 0), 0);
      prodRating = Math.round((sum / prodReviewCount) * 10) / 10;
    }
  }

  return {
    id: listing.id,
    product_name: listing.product?.name || 'Produce Item',
    category_name: listing.product?.category?.name || 'Produce',
    farmer_name: listing.farmer?.fullName || null,
    fpo_name: listing.fpo?.organizationName || null,
    quantity_available: Number(listing.quantityAvailable),
    unit: listing.unit || 'kg',
    price_per_unit: Number(listing.pricePerUnit),
    quality_grade: listing.qualityGrade || 'A',
    harvest_date: listing.harvestDate ? new Date(listing.harvestDate).toISOString().split('T')[0] : null,
    available_from: listing.availableFrom ? new Date(listing.availableFrom).toISOString().split('T')[0] : null,
    available_until: listing.availableUntil ? new Date(listing.availableUntil).toISOString().split('T')[0] : null,
    location: listing.location,
    min_order_quantity: Number(listing.minOrderQuantity || 0),
    is_perishable: listing.isPerishable ?? true,
    shelf_life_days: listing.shelfLifeDays,
    expected_sell_by_date: sellBy ? sellBy.toISOString().split('T')[0] : null,
    perishability_level: listing.perishabilityLevel || 'HIGH',
    storage_requirement: listing.storageRequirement || 'AMBIENT',
    perishability_status: status,
    days_remaining: daysRemaining,
    eligible_channels: channels,
    is_active: listing.isActive ?? true,
    distance_km: distanceKm != null ? Math.round(distanceKm * 10) / 10 : null,
    recommended_strategy: recommendedStrategy || null,
    created_at: listing.createdAt,
    farmer_rating: farmerRating,
    farmer_review_count: farmerReviewCount,
    product_rating: prodRating,
    product_review_count: prodReviewCount,
  };
}

export async function checkAndAssignAdvanceDemands(listingId: number) {
  const listing = await prisma.productListing.findUnique({
    where: { id: listingId },
    include: {
      product: true,
      farmer: true,
      fpo: true,
    },
  });

  if (!listing || Number(listing.quantityAvailable) <= 0 || !listing.isActive) {
    return;
  }

  const openDemands = await prisma.bulkRequirement.findMany({
    where: {
      productId: listing.productId,
      status: { in: ['OPEN', 'PARTIALLY_MATCHED'] },
    },
    include: {
      buyer: { include: { user: true } },
      matches: true,
      product: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  let remainingListingQty = Number(listing.quantityAvailable);
  const sellerName = listing.farmer?.fullName || listing.fpo?.organizationName || 'Verified Producer';

  for (const demand of openDemands) {
    if (remainingListingQty <= 0) break;

    const alreadyMatched = demand.matches.reduce((acc, m) => acc + Number(m.matchedQuantity), 0);
    const needed = Number(demand.requiredQuantity) - alreadyMatched;
    if (needed <= 0) {
      await prisma.bulkRequirement.update({
        where: { id: demand.id },
        data: { status: 'MATCHED' },
      });
      continue;
    }

    const allocQty = Math.min(remainingListingQty, needed);
    if (allocQty > 0) {
      await prisma.supplierMatch.create({
        data: {
          requirementId: demand.id,
          listingId: listing.id,
          matchedQuantity: allocQty,
          farmerPrice: listing.pricePerUnit,
          logisticsCost: 0,
          platformFee: 0,
        },
      });

      remainingListingQty -= allocQty;
      const newStatus = alreadyMatched + allocQty >= Number(demand.requiredQuantity) ? 'MATCHED' : 'PARTIALLY_MATCHED';
      await prisma.bulkRequirement.update({
        where: { id: demand.id },
        data: { status: newStatus },
      });

      if (demand.buyer?.userId) {
        await prisma.notification.create({
          data: {
            userId: demand.buyer.userId,
            title: `🎉 Advance Booking Assigned: ${allocQty} kg ${listing.product.name} Reserved!`,
            message: `Fresh ${listing.product.name} has arrived from ${sellerName}. Your advance booking has been assigned with #1 PRIORITY! (${allocQty} kg reserved at ₹${listing.pricePerUnit}/kg).`,
            notificationType: 'ORDER',
            link: '/buyer/advance-demands',
            isRead: false,
          },
        });
      }

      if (listing.farmer?.userId) {
        const buyerDisplay = demand.buyer?.fullName || 'Advance Buyer';
        await prisma.notification.create({
          data: {
            userId: listing.farmer.userId,
            title: `🎯 Advance Demand Auto-Matched (${allocQty} kg)!`,
            message: `${allocQty} kg of your ${listing.product.name} listing was automatically allocated to priority buyer ${buyerDisplay}.`,
            notificationType: 'ORDER',
            link: '/farmer/dashboard',
            isRead: false,
          },
        });
      }
    }
  }

  await prisma.productListing.update({
    where: { id: listing.id },
    data: {
      quantityAvailable: remainingListingQty,
      isActive: remainingListingQty > 0,
    },
  });
}

