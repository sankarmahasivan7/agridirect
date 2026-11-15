import prisma from './prisma';

export async function createNotification(
  userId: number,
  title: string,
  message: string,
  notificationType = 'INFO',
  link: string | null = null
) {
  return prisma.notification.create({
    data: {
      userId,
      title,
      message,
      notificationType,
      link,
      isRead: false,
    },
  });
}

export async function notifyOrderPlaced(orderId: number) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      buyer: true,
      items: {
        include: {
          listing: {
            include: {
              farmer: true,
              fpo: true,
              product: true,
            },
          },
        },
      },
      transportRequests: {
        include: {
          assignedVehicle: {
            include: {
              transporter: true,
            },
          },
        },
      },
    },
  });

  if (!order) return;

  // 1. Buyer Notification
  if (order.buyer?.userId) {
    const otpTitle = order.deliveryOtp
      ? `Order #${order.id} Placed Successfully! (Delivery OTP: ${order.deliveryOtp})`
      : `Order #${order.id} Placed Successfully!`;
    const otpInfo = order.deliveryOtp
      ? ` Your Secret Delivery Verification OTP is ${order.deliveryOtp}. Please share this OTP with the delivery driver upon arrival to receive your produce.`
      : '';
    await createNotification(
      order.buyer.userId,
      otpTitle,
      `Your order of ${order.items.length} item(s) (₹${order.totalAmount}) has been confirmed.${otpInfo} Consignment is dispatched via District Central Warehouse to ${order.deliveryLocation || 'your delivery location'}.`,
      'ORDER',
      '/buyer/orders'
    );
  }

  // 2. Seller Notifications
  const notifiedSellers = new Set<number>();
  for (const item of order.items) {
    const listing = item.listing;
    let sellerUid: number | null = null;
    if (listing?.farmer?.userId) {
      sellerUid = listing.farmer.userId;
    } else if (listing?.fpo?.userId) {
      sellerUid = listing.fpo.userId;
    }

    if (sellerUid && !notifiedSellers.has(sellerUid) && listing) {
      const productName = listing.product?.name || 'produce';
      const unit = listing.unit || 'kg';
      await createNotification(
        sellerUid,
        `New Order Received: #${order.id}`,
        `A buyer placed an order for ${item.quantity} ${unit} of ${productName}. Prepare consignment for District Warehouse fulfillment.`,
        'ORDER',
        '/farmer/orders'
      );
      notifiedSellers.add(sellerUid);
    }
  }

  // 3. Transporter Notifications
  const assignedUserIds = new Set<number>();
  for (const req of order.transportRequests) {
    if (req.assignedVehicle?.transporter?.userId) {
      const transUid = req.assignedVehicle.transporter.userId;
      assignedUserIds.add(transUid);
      await createNotification(
        transUid,
        `New Transport Assignment: Consignment #${req.id}`,
        `Consignment #${req.id} ready at ${req.pickupLocation} (${req.weightKg} kg). Deliver to ${req.destinationLocation}. Estimated payout: ₹${req.logisticsCost}.`,
        'TRANSPORT',
        '/transporter/dashboard'
      );
    }
  }

  const pendingReqs = order.transportRequests.filter((r) => !r.assignedVehicleId);
  if (pendingReqs.length > 0) {
    const availableTransporters = await prisma.transporterProfile.findMany({
      where: {
        isAvailable: true,
        user: { isActive: true },
      },
    });
    for (const tp of availableTransporters) {
      if (!assignedUserIds.has(tp.userId)) {
        const req0 = pendingReqs[0];
        await createNotification(
          tp.userId,
          `Transport Job Available: Consignment #${req0.id}`,
          `New delivery job from ${req0.pickupLocation} to ${req0.destinationLocation} (${req0.weightKg} kg). Payout: ₹${req0.logisticsCost}. Accept now in your dashboard.`,
          'TRANSPORT',
          '/transporter/dashboard'
        );
      }
    }
  }
}

export async function notifyTransportAccepted(requestId: number) {
  const req = await prisma.transportRequest.findUnique({
    where: { id: requestId },
    include: {
      order: {
        include: {
          buyer: true,
          items: {
            include: {
              listing: {
                include: {
                  farmer: true,
                  fpo: true,
                },
              },
            },
          },
        },
      },
      assignedVehicle: {
        include: {
          transporter: true,
        },
      },
    },
  });

  if (!req) return;
  const transName = req.assignedVehicle?.transporter?.fullName || 'Carrier';

  if (req.order?.buyer?.userId) {
    await createNotification(
      req.order.buyer.userId,
      `Transporter Assigned: Consignment #${req.id}`,
      `Transporter ${transName} has accepted your consignment from ${req.pickupLocation}. Preparing for pickup and transit.`,
      'TRANSPORT',
      '/transport/my-requests'
    );
  }

  if (req.order?.items) {
    for (const item of req.order.items) {
      const sellerUid = item.listing?.farmer?.userId || item.listing?.fpo?.userId;
      if (sellerUid) {
        await createNotification(
          sellerUid,
          `Carrier Assigned: Consignment #${req.id}`,
          `Transporter ${transName} is scheduled to pick up order produce from ${req.pickupLocation}.`,
          'TRANSPORT',
          '/farmer/orders'
        );
      }
    }
  }
}

export async function notifyTransportStatusUpdate(requestId: number, newStatus: string) {
  const req = await prisma.transportRequest.findUnique({
    where: { id: requestId },
    include: {
      order: {
        include: {
          buyer: true,
          items: {
            include: {
              listing: {
                include: {
                  farmer: true,
                  fpo: true,
                },
              },
            },
          },
        },
      },
      assignedVehicle: {
        include: {
          transporter: true,
        },
      },
    },
  });

  if (!req) return;
  const transName = req.assignedVehicle?.transporter?.fullName || 'Carrier';
  const buyerUid = req.order?.buyer?.userId || req.requestedByUserId;

  if (newStatus === 'PICKUP' || newStatus === 'PICKED_UP') {
    if (buyerUid) {
      await createNotification(
        buyerUid,
        `Consignment #${req.id} Picked Up`,
        `Your produce has been picked up from ${req.pickupLocation} by ${transName}.`,
        'DELIVERY',
        `/transport/track/${req.id}`
      );
    }
  } else if (newStatus === 'IN_TRANSIT') {
    if (buyerUid) {
      const eta = (req as any).estimated_transit_minutes || (req as any).estimatedTransitMinutes;
      const etaStr = eta ? `~${eta} mins` : 'in transit';
      await createNotification(
        buyerUid,
        `Shipment #${req.id} In Transit!`,
        `Consignment is on the road to ${req.destinationLocation} (ETA: ${etaStr}). Live tracking active.`,
        'DELIVERY',
        `/transport/track/${req.id}`
      );
    }
  } else if (newStatus === 'DELIVERED') {
    if (buyerUid) {
      await createNotification(
        buyerUid,
        `Order #${req.orderId || req.id} Delivered!`,
        `Your fresh produce has arrived at ${req.destinationLocation}. Thank you for supporting direct farmers!`,
        'DELIVERY',
        '/buyer/orders'
      );
    }
    if (req.order?.items) {
      for (const item of req.order.items) {
        const sellerUid = item.listing?.farmer?.userId || item.listing?.fpo?.userId;
        if (sellerUid) {
          await createNotification(
            sellerUid,
            `Order #${req.orderId || req.id} Delivered`,
            `Produce delivered to buyer. Net earnings credited to your balance.`,
            'ORDER',
            '/farmer/orders'
          );
        }
      }
    }
    if (req.assignedVehicle?.transporter?.userId) {
      await createNotification(
        req.assignedVehicle.transporter.userId,
        `Consignment #${req.id} Completed`,
        `Delivery confirmed at ${req.destinationLocation}. Logistics fee payout of ₹${req.logisticsCost} credited.`,
        'TRANSPORT',
        '/transporter/dashboard'
      );
    }
  }
}
