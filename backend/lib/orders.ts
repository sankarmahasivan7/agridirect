export function serializeOrder(order: any, razorpayOrder: any = null) {
  const items = (order.items || []).map((item: any) => ({
    listing_id: item.listingId,
    product_name: item.listing?.product?.name || 'Produce Item',
    quantity: Number(item.quantity),
    price_at_purchase: Number(item.priceAtPurchase),
    line_subtotal: Number(item.lineSubtotal),
  }));

  const payment = order.payments?.[0] || order.payment;
  const rzpOrderId =
    razorpayOrder?.id || payment?.gatewayOrderId || null;
  const rzpKeyId =
    razorpayOrder?.key_id ||
    (order.paymentMethod === 'UPI' ? process.env.RAZORPAY_KEY_ID || 'rzp_test_TZrzdQ5wla6foh' : null);
  const amountPaise =
    razorpayOrder?.amount ||
    (order.paymentMethod === 'UPI' ? Math.round(Number(order.totalAmount) * 100) : null);

  const isUpi = order.paymentMethod === 'UPI';
  const upiId = isUpi ? process.env.DEFAULT_UPI_ID || 'agridirect@okaxis' : null;
  const upiName = isUpi ? process.env.DEFAULT_UPI_NAME || 'AgriDirect Payments' : null;
  const upiUri = isUpi
    ? `upi://pay?pa=${upiId}&pn=${encodeURIComponent(upiName || '')}&mc=0000&mode=02&purpose=00&am=${Number(order.totalAmount).toFixed(2)}&cu=INR&tn=AgriDirect_Order_${order.id}`
    : null;

  const transportRequestId =
    order.transportRequests?.[0]?.id || null;

  const now = new Date();
  const orderCreated = order.createdAt ? new Date(order.createdAt) : now;
  const cancellationDeadline = new Date(orderCreated.getTime() + 60 * 60 * 1000);
  const secondsRemaining = Math.max(0, Math.floor((cancellationDeadline.getTime() - now.getTime()) / 1000));
  const cancellableStatuses = ['PENDING', 'CONFIRMED'];
  const canCancel = cancellableStatuses.includes(order.status) && secondsRemaining > 0;

  return {
    id: order.id,
    subtotal: Number(order.subtotal),
    logistics_cost: Number(order.logisticsCost),
    platform_fee: Number(order.platformFee),
    total_amount: Number(order.totalAmount),
    delivery_location: order.deliveryLocation,
    status: order.status,
    delivery_otp: order.deliveryOtp,
    payment_method: order.paymentMethod,
    payment_status: order.paymentStatus,
    paid_at: order.paidAt,
    farmer_settlement_amount: Number(order.farmerSettlementAmount || order.subtotal),
    transporter_settlement_amount: Number(order.transporterSettlementAmount || order.logisticsCost),
    platform_commission_amount: Number(order.platformCommissionAmount || order.platformFee),
    razorpay_order_id: rzpOrderId,
    razorpay_key_id: rzpKeyId,
    amount_paise: amountPaise,
    currency: 'INR',
    upi_uri: upiUri,
    upi_id: upiId,
    upi_name: upiName,
    transport_request_id: transportRequestId,
    base_fare: order.baseFare != null ? Number(order.baseFare) : null,
    distance_fare: order.distanceFare != null ? Number(order.distanceFare) : null,
    toll_charges: order.tollCharges != null ? Number(order.tollCharges) : null,
    loading_unloading_charge: order.loadingUnloadingCharge != null ? Number(order.loadingUnloadingCharge) : null,
    waiting_charge: order.waitingCharge != null ? Number(order.waitingCharge) : null,
    road_distance_km: order.roadDistanceKm != null ? Number(order.roadDistanceKm) : null,
    allocated_vehicle_type: order.allocatedVehicleType || null,
    can_cancel: canCancel,
    cancellation_deadline: cancellationDeadline.toISOString(),
    seconds_remaining_to_cancel: secondsRemaining,
    created_at: orderCreated.toISOString(),
    items,
  };
}

