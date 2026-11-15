import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { getAuthUser } from '@/lib/auth';
import { serializeOrder } from '@/lib/orders';
import { resolveSellerWarehouse, dispatchOrderFulfillment } from '@/lib/fulfillment';
import {
  calculateOrderTransportFee,
  calculateMultiWarehouseOrderFee,
} from '@/lib/logistics';
import { createRazorpayOrder } from '@/lib/payment';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return errorResponse('Not authenticated', 401);

    const orders = await prisma.order.findMany({
      include: {
        buyer: true,
        items: {
          include: {
            listing: {
              include: { product: true },
            },
          },
        },
        transportRequests: true,
        payment: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return jsonResponse(orders.map((o) => serializeOrder(o)));
  } catch (err: any) {
    console.error('Get orders error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return errorResponse('Not authenticated', 401);

    const body = await req.json();
    const {
      items: cartItems,
      delivery_location,
      delivery_latitude,
      delivery_longitude,
      payment_method,
    } = body;

    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      return errorResponse('Cart is empty', 400);
    }

    const user = await prisma.user.findUnique({
      where: { id: authUser.userId },
      include: {
        buyerProfile: true,
        farmerProfile: true,
        transporterProfile: true,
      },
    });
    if (!user) return errorResponse('User not found', 404);

    let buyerProfile = user.buyerProfile;
    const delLat = delivery_latitude != null
      ? Number(delivery_latitude)
      : (buyerProfile?.defaultLatitude != null ? Number(buyerProfile.defaultLatitude) : 8.7139);
    const delLon = delivery_longitude != null
      ? Number(delivery_longitude)
      : (buyerProfile?.defaultLongitude != null ? Number(buyerProfile.defaultLongitude) : 77.7567);

    if (!buyerProfile) {
      const fullName = user.farmerProfile?.fullName || user.transporterProfile?.fullName || user.email.split('@')[0] || 'AgriDirect Buyer';
      const district = user.farmerProfile?.district || user.transporterProfile?.district || 'Tirunelveli';
      buyerProfile = await prisma.buyerProfile.create({
        data: {
          userId: user.id,
          fullName,
          buyerType: 'consumer',
          district,
          location: delivery_location || `${district} Central Destination`,
          defaultLatitude: delLat,
          defaultLongitude: delLon,
        },
      });
    }

    // Process listings and decrement inventory in a transaction
    const orderData = await prisma.$transaction(async (tx) => {
      let subtotal = 0;
      let totalKg = 0;
      const orderItemsData: any[] = [];
      const uniqueWarehouses = new Map<string, any>();

      for (const item of cartItems) {
        const listing = await tx.productListing.findUnique({
          where: { id: item.listing_id },
          include: {
            farmer: true,
            fpo: true,
            product: true,
          },
        });

        if (!listing || !listing.isActive) {
          throw new Error(`Listing ${item.listing_id} not found or inactive`);
        }

        const qty = Number(item.quantity);
        if (qty < Number(listing.minOrderQuantity || 0)) {
          throw new Error(`Minimum order quantity for ${listing.product?.name} is ${listing.minOrderQuantity} ${listing.unit}`);
        }

        if (qty > Number(listing.quantityAvailable)) {
          throw new Error(`Only ${listing.quantityAvailable} ${listing.unit} is available for ${listing.product?.name}`);
        }

        const price = Number(listing.pricePerUnit);
        const lineSubtotal = Math.round(qty * price * 100) / 100;
        subtotal += lineSubtotal;
        totalKg += qty;

        const wh = resolveSellerWarehouse(listing);
        const whKey = `${wh.latitude},${wh.longitude}`;
        if (!uniqueWarehouses.has(whKey)) {
          uniqueWarehouses.set(whKey, wh);
        }

        const newQtyAvailable = Number(listing.quantityAvailable) - qty;
        await tx.productListing.update({
          where: { id: listing.id },
          data: {
            quantityAvailable: newQtyAvailable,
            isActive: newQtyAvailable > 0,
          },
        });

        orderItemsData.push({
          listingId: listing.id,
          quantity: qty,
          priceAtPurchase: price,
          lineSubtotal,
        });
      }

      return {
        subtotal: Math.round(subtotal * 100) / 100,
        totalKg,
        orderItemsData,
        uniqueWarehouses: Array.from(uniqueWarehouses.values()),
      };
    });

    // Calculate real road transport fee
    const warehouses = orderData.uniqueWarehouses;
    let feeInfo: any;
    if (warehouses.length <= 1) {
      const wh = warehouses[0] || {
        latitude: 8.7139,
        longitude: 77.7567,
        warehouse_name: 'Tirunelveli Central Agri-Warehouse',
      };
      feeInfo = await calculateOrderTransportFee(
        wh.latitude,
        wh.longitude,
        delLat,
        delLon,
        orderData.totalKg
      );
    } else {
      const whCoords: [number, number, string][] = warehouses.map((w: any) => [
        w.latitude,
        w.longitude,
        w.warehouse_name,
      ]);
      feeInfo = await calculateMultiWarehouseOrderFee(
        whCoords,
        delLat,
        delLon,
        orderData.totalKg,
        delivery_location || 'Customer Delivery'
      );
    }

    const logisticsCost = Math.round(Number(feeInfo.total_fee) * 100) / 100;
    const platformFee = Math.round((orderData.subtotal * 0.02) * 100) / 100; // 2% platform fee
    const totalAmount = Math.round((orderData.subtotal + logisticsCost + platformFee) * 100) / 100;

    const isPod = payment_method === 'PAY_ON_DELIVERY';
    const isUpi = payment_method === 'UPI';
    const initialStatus = isPod ? 'CONFIRMED' : 'PENDING';
    const generatedOtp = `${Math.floor(100000 + Math.random() * 900000)}`;

    const order = await prisma.order.create({
      data: {
        buyerId: buyerProfile.id,
        subtotal: orderData.subtotal,
        logisticsCost,
        platformFee,
        totalAmount,
        deliveryLocation: delivery_location || 'Customer Location',
        deliveryLatitude: delLat,
        deliveryLongitude: delLon,
        baseFare: feeInfo.base_fare,
        distanceFare: feeInfo.distance_fare,
        tollCharges: feeInfo.toll_charges,
        loadingUnloadingCharge: feeInfo.loading_unloading_charge,
        waitingCharge: feeInfo.waiting_charge,
        roadDistanceKm: feeInfo.road_distance_km,
        allocatedVehicleType: feeInfo.vehicle_type,
        status: initialStatus,
        deliveryOtp: generatedOtp,
        paymentMethod: payment_method || 'PAY_ON_DELIVERY',
        paymentStatus: 'PENDING',
        farmerSettlementAmount: orderData.subtotal,
        transporterSettlementAmount: logisticsCost,
        platformCommissionAmount: platformFee,
        items: {
          create: orderData.orderItemsData,
        },
      },
      include: {
        buyer: true,
        items: {
          include: {
            listing: {
              include: { product: true },
            },
          },
        },
        transportRequests: true,
        payment: true,
      },
    });

    let rzpOrder = null;
    if (isPod) {
      await prisma.payment.create({
        data: {
          orderId: order.id,
          amount: totalAmount,
          currency: 'INR',
          paymentMethod: 'PAY_ON_DELIVERY',
          paymentStatus: 'PENDING',
          farmerAmount: orderData.subtotal,
          transporterAmount: logisticsCost,
          commissionAmount: platformFee,
        },
      });
      // Immediately dispatch fulfillment for Pay On Delivery orders!
      await dispatchOrderFulfillment(order.id);
    } else if (isUpi) {
      rzpOrder = await createRazorpayOrder({
        id: order.id,
        totalAmount,
        buyerId: buyerProfile.id,
        deliveryLocation: delivery_location,
      });
      await prisma.payment.create({
        data: {
          orderId: order.id,
          amount: totalAmount,
          currency: 'INR',
          paymentMethod: 'UPI',
          paymentStatus: 'PENDING',
          gateway: 'RAZORPAY',
          gatewayOrderId: rzpOrder.id,
          farmerAmount: orderData.subtotal,
          transporterAmount: logisticsCost,
          commissionAmount: platformFee,
        },
      });
      // Fulfillment is withheld until UPI payment verification!
    }

    const freshOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: {
        buyer: true,
        items: {
          include: {
            listing: {
              include: { product: true },
            },
          },
        },
        transportRequests: true,
        payment: true,
      },
    });

    return jsonResponse(serializeOrder(freshOrder || order, rzpOrder), 201);
  } catch (err: any) {
    console.error('Create order error:', err);
    return errorResponse(err.message || 'Internal server error', 400);
  }
}

