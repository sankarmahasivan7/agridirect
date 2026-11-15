import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { getAuthUser } from '@/lib/auth';
import { serializeReview } from '@/lib/reviews';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET() {
  try {
    const reviews = await prisma.review.findMany({
      include: {
        buyer: true,
        farmer: true,
        product: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return jsonResponse(reviews.map((r) => serializeReview(r)));
  } catch (err: any) {
    console.error('Get reviews error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser || authUser.role !== 'buyer') {
      return errorResponse('Forbidden: only buyers can submit reviews', 403);
    }

    const buyer = await prisma.buyerProfile.findUnique({
      where: { userId: authUser.userId },
    });
    if (!buyer) return errorResponse('Buyer profile required', 400);

    let orderId: number | null = null;
    let rating = 5;
    let listingId: number | null = null;
    let comment: string | null = null;
    let imageUrl: string | null = null;

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      orderId = formData.get('order_id') ? parseInt(formData.get('order_id') as string, 10) : null;
      rating = formData.get('rating') ? parseInt(formData.get('rating') as string, 10) : 5;
      listingId = formData.get('listing_id') ? parseInt(formData.get('listing_id') as string, 10) : null;
      comment = (formData.get('comment') as string) || null;
      imageUrl = (formData.get('image_url') as string) || null;

      const file = formData.get('image') as File | null;
      if (file && file.size > 0) {
        const buffer = await file.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        imageUrl = `data:${file.type || 'image/jpeg'};base64,${base64}`;
      }
    } else {
      const body = await req.json();
      orderId = body.order_id ? Number(body.order_id) : null;
      rating = body.rating ? Number(body.rating) : 5;
      listingId = body.listing_id ? Number(body.listing_id) : null;
      comment = body.comment || null;
      imageUrl = body.image_url || null;
    }

    if (!orderId) return errorResponse('order_id is required', 400);

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { listing: { include: { product: true } } } },
      },
    });

    if (!order) return errorResponse(`Order #${orderId} not found`, 404);
    if (order.buyerId !== buyer.id) return errorResponse('You can only review your own orders', 403);

    let selectedItem = null;
    if (listingId) {
      selectedItem = order.items.find((i) => i.listingId === listingId);
    }
    if (!selectedItem && order.items.length > 0) {
      selectedItem = order.items[0];
    }
    if (!selectedItem) return errorResponse('No items found in this order to review', 400);

    const listing = selectedItem.listing;
    const farmerId = listing?.farmerId || null;
    const productId = listing?.productId || null;
    const productName = listing?.product?.name || 'Farm Produce';

    const isWasteReported =
      rating <= 2 ||
      (comment != null &&
        ['waste', 'spoil', 'rotten', 'damage', 'decay', 'bad', 'poor'].some((kw) =>
          comment!.toLowerCase().includes(kw)
        ));

    const review = await prisma.review.create({
      data: {
        orderId: order.id,
        buyerId: buyer.id,
        farmerId,
        listingId: listing?.id || null,
        productId,
        productName,
        rating,
        comment,
        imageUrl,
        isWasteReported,
      },
      include: {
        buyer: true,
        farmer: true,
        product: true,
      },
    });

    if (farmerId) {
      const farmer = await prisma.farmerProfile.findUnique({ where: { id: farmerId } });
      if (farmer) {
        await prisma.notification.create({
          data: {
            userId: farmer.userId,
            title: `New Review (${rating} ⭐): Order #${order.id}`,
            message: `Buyer rated your produce "${productName}" ${rating} stars.${comment ? ` Feedback: "${comment}"` : ''}`,
            notificationType: 'REVIEW',
            link: '/farmer/dashboard',
            isRead: false,
          },
        });
      }
    }

    return jsonResponse(serializeReview(review), 201);
  } catch (err: any) {
    console.error('Submit review error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

