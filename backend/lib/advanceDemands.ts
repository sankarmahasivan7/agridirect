export function serializeAdvanceDemand(r: any) {
  let matchedTotal = 0;
  const matchesOut = (r.matches || []).map((m: any) => {
    const qty = Number(m.matchedQuantity);
    matchedTotal += qty;
    let fname = m.listing?.farmer?.fullName || m.listing?.fpo?.organizationName || 'Verified Producer';
    return {
      id: m.id,
      listing_id: m.listingId,
      farmer_name: fname,
      matched_quantity: qty,
      farmer_price: Number(m.farmerPrice),
      matched_at: m.matchedAt || null,
    };
  });

  const reqQty = Number(r.requiredQuantity || 0);
  const remQty = Math.max(0, reqQty - matchedTotal);

  return {
    id: r.id,
    buyer_id: r.buyerId,
    buyer_name: r.buyer?.fullName || null,
    buyer_phone: r.buyer?.user?.phone || null,
    product_id: r.productId,
    product_name: r.product?.name || 'Produce',
    required_quantity: reqQty,
    matched_quantity: matchedTotal,
    remaining_quantity: remQty,
    unit: r.unit || 'kg',
    needed_by: r.neededBy ? new Date(r.neededBy).toISOString().split('T')[0] : null,
    delivery_location: r.deliveryLocation,
    quality_grade: r.qualityGrade || 'A',
    status: r.status,
    created_at: r.createdAt,
    matches: matchesOut,
  };
}

