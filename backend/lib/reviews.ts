export function serializeReview(r: any) {
  return {
    id: r.id,
    order_id: r.orderId,
    buyer_id: r.buyerId,
    buyer_name: r.buyer?.fullName || 'Verified Buyer',
    farmer_id: r.farmerId,
    farmer_name: r.farmer?.fullName || 'Direct Producer',
    listing_id: r.listingId,
    product_id: r.productId,
    product_name: r.productName || r.product?.name || 'Produce Item',
    rating: Number(r.rating),
    comment: r.comment,
    image_url: r.imageUrl,
    is_waste_reported: Boolean(r.isWasteReported),
    created_at: r.createdAt,
  };
}

export function buildRatingSummary(reviews: any[]) {
  if (!reviews || reviews.length === 0) {
    return {
      average_rating: 0.0,
      total_reviews: 0,
      rating_breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      waste_reports_count: 0,
      reviews: [],
    };
  }

  const breakdown: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let wasteCount = 0;
  let totalStars = 0;

  for (const r of reviews) {
    const stars = Math.max(1, Math.min(5, Math.round(Number(r.rating))));
    breakdown[stars] = (breakdown[stars] || 0) + 1;
    totalStars += stars;
    if (r.isWasteReported) wasteCount++;
  }

  const avgRating = Math.round((totalStars / reviews.length) * 10) / 10;
  const sorted = [...reviews].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return {
    average_rating: avgRating,
    total_reviews: reviews.length,
    rating_breakdown: breakdown,
    waste_reports_count: wasteCount,
    reviews: sorted.map((r) => serializeReview(r)),
  };
}

