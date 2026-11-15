import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { getAuthUser } from '@/lib/auth';
import { calculatePerishability } from '@/lib/listings';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser || authUser.role !== 'farmer') {
      return errorResponse('Forbidden: only farmers can access farmer dashboard', 403);
    }

    const farmer = await prisma.farmerProfile.findUnique({
      where: { userId: authUser.userId },
      include: {
        listings: {
          include: {
            product: true,
            orderItems: { include: { order: true } },
          },
        },
        reviews: {
          include: { buyer: true, product: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!farmer) {
      return jsonResponse({
        active_listings_count: 0,
        total_listings_count: 0,
        pending_orders_count: 0,
        earnings: { gross: '0', net_earnings: '0', message: 'No profile found.' },
        perishability_alerts: [],
        urgent_listings_count: 0,
        rating_summary: {
          average_rating: 5.0,
          total_reviews: 0,
          waste_reports_count: 0,
          recent_reviews: [],
        },
        note: 'No farmer profile found.',
      });
    }

    const listings = farmer.listings;
    const activeListings = listings.filter((l) => l.isActive);

    const allOrderItems = listings.flatMap((l) => l.orderItems);
    const deliveredItems = allOrderItems.filter((i) => i.order?.status === 'DELIVERED');
    const gross = deliveredItems.reduce((acc, i) => acc + Number(i.lineSubtotal), 0);

    let netEarnings = 0;
    for (const i of deliveredItems) {
      const order = i.order;
      if (order && Number(order.subtotal) > 0) {
        const share = Number(i.lineSubtotal) / Number(order.subtotal);
        netEarnings += Number(i.lineSubtotal) - Number(order.platformFee) * share;
      }
    }

    const pendingOrders = allOrderItems.filter(
      (i) => i.order && ['PENDING', 'CONFIRMED'].includes(i.order.status)
    );

    const urgentLots = [];
    for (const l of activeListings) {
      const { status, sellBy } = calculatePerishability(l);
      if (['CRITICAL', 'URGENT'].includes(status)) {
        urgentLots.push({
          listing_id: l.id,
          product_name: l.product?.name || 'Produce Item',
          quantity: Number(l.quantityAvailable),
          unit: l.unit,
          status,
          sell_by_date: sellBy ? sellBy.toISOString().split('T')[0] : null,
        });
      }
    }

    const reviews = farmer.reviews;
    const totalReviews = reviews.length;
    const avgRating =
      totalReviews > 0
        ? Math.round((reviews.reduce((acc, r) => acc + Number(r.rating || 0), 0) / totalReviews) * 10) / 10
        : 5.0;

    const wasteReports = reviews.filter((r) => r.isWasteReported);
    const recentReviews = reviews.slice(0, 10).map((r) => ({
      id: r.id,
      order_id: r.orderId,
      buyer_name: r.buyer?.fullName || 'Verified Buyer',
      product_name: r.productName || r.product?.name || 'Produce Item',
      rating: Number(r.rating),
      comment: r.comment,
      image_url: r.imageUrl,
      is_waste_reported: r.isWasteReported,
      created_at: r.createdAt,
    }));

    return jsonResponse({
      active_listings_count: activeListings.length,
      total_listings_count: listings.length,
      pending_orders_count: pendingOrders.length,
      earnings: {
        gross: gross.toFixed(2),
        net_earnings: netEarnings.toFixed(2),
      },
      perishability_alerts: urgentLots,
      urgent_listings_count: urgentLots.length,
      rating_summary: {
        average_rating: avgRating,
        total_reviews: totalReviews,
        waste_reports_count: wasteReports.length,
        recent_reviews: recentReviews,
      },
      note: 'All values are computed from actual listings and orders.',
    });
  } catch (err: any) {
    console.error('Farmer dashboard error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

