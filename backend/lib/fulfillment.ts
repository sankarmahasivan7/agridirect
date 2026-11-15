import crypto from 'crypto';
import prisma from './prisma';
import {
  getDistrictWarehouse,
  normalizeDistrict,
  DISTRICT_ALIASES,
  DEFAULT_DISTRICT,
  DISTRICT_WAREHOUSES,
  SUPPORTED_DISTRICTS,
} from './constants';
import {
  calculateTransportFee,
  selectVehicleType,
  evaluateDispatchReadiness,
  allocateMultiCustomerRouteCosts,
  DEFAULT_TRUCK_MIN_FILL_PCT,
  BIKE_MAX_CAPACITY_KG,
} from './logistics';
import { getRoadDistanceAndDuration, getRouteTollCharges } from './maps';
import { haversineKm } from './geo';
import {
  createNotification,
  notifyOrderPlaced,
} from './notifications';

export const WAREHOUSE_SEQUENCE = ['WH-TKS-01', 'WH-TNV-01', 'WH-TUT-01'];

export function resolveSellerWarehouse(listing: any) {
  let district: string | null = null;
  let fallback: string | null = null;
  if (listing) {
    fallback = listing.location || null;
    if (listing.farmer?.district) {
      district = listing.farmer.district;
    } else if (listing.fpo?.district) {
      district = listing.fpo.district;
    }
  }
  return getDistrictWarehouse(district, fallback);
}

export function resolveOrderDistrict(order: any): string {
  if (order.buyer?.district) {
    try {
      return normalizeDistrict(order.buyer.district);
    } catch {
      // fallback
    }
  }
  if (order.deliveryLocation) {
    const locLower = order.deliveryLocation.toLowerCase();
    for (const [alias, canonical] of Object.entries(DISTRICT_ALIASES)) {
      if (locLower.includes(alias.toLowerCase())) {
        return canonical;
      }
    }
  }
  return DEFAULT_DISTRICT;
}

export async function createFulfillmentItemsForOrder(orderId: number) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
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
    },
  });

  if (!order) return [];

  const createdItems = [];
  for (const item of order.items) {
    const listing = item.listing;
    const wh = resolveSellerWarehouse(listing);
    const itemAvail = listing?.availableFrom || listing?.harvestDate || null;

    const fi = await prisma.orderFulfillmentItem.create({
      data: {
        orderId: order.id,
        orderItemId: item.id,
        warehouseName: wh.warehouse_name,
        warehouseCode: wh.code,
        warehouseDistrict: wh.district,
        warehouseLatitude: wh.latitude,
        warehouseLongitude: wh.longitude,
        quantity: item.quantity,
        status: 'PENDING',
        availableFrom: itemAvail,
      },
    });
    createdItems.push(fi);
  }
  return createdItems;
}

export async function createTransportRequestsForOrder(orderId: number) {
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
      transportRequests: true,
    },
  });

  if (!order || order.transportRequests.length > 0) return order?.transportRequests || [];

  const whMap = new Map<string, { wh: any; weightKg: number }>();
  let totalOrderWeight = 0;

  for (const item of order.items) {
    const wh = resolveSellerWarehouse(item.listing);
    const qty = Number(item.quantity) || 0;
    totalOrderWeight += qty;
    const existing = whMap.get(wh.code) || { wh, weightKg: 0 };
    existing.weightKg += qty;
    whMap.set(wh.code, existing);
  }

  const deliveryLat = order.deliveryLatitude ? Number(order.deliveryLatitude) : 8.7139;
  const deliveryLon = order.deliveryLongitude ? Number(order.deliveryLongitude) : 77.7567;
  const deliveryLoc = order.deliveryLocation || 'Customer Location';

  const buyerUserId = order.buyer?.userId || order.buyerId;
  const createdReqs = [];

  for (const { wh, weightKg } of whMap.values()) {
    const { distanceKm, durationMinutes } = await getRoadDistanceAndDuration(
      wh.latitude,
      wh.longitude,
      deliveryLat,
      deliveryLon
    );
    const toll = await getRouteTollCharges(wh.latitude, wh.longitude, deliveryLat, deliveryLon);
    const vType = selectVehicleType(weightKg);
    const feeBreakdown = await calculateTransportFee(distanceKm, vType, toll);

    const req = await prisma.transportRequest.create({
      data: {
        requestedByUserId: buyerUserId,
        orderId: order.id,
        pickupLocation: wh.warehouse_name,
        pickupLatitude: wh.latitude,
        pickupLongitude: wh.longitude,
        destinationLocation: deliveryLoc,
        destinationLatitude: deliveryLat,
        destinationLongitude: deliveryLon,
        requiredBy: new Date(Date.now() + 48 * 3600 * 1000),
        weightKg,
        notes: `Delivery from ${wh.warehouse_name} for Order #${order.id}`,
        status: 'PENDING',
        logisticsStrategy: 'consolidated',
        hubName: wh.warehouse_name,
        distanceKm,
        logisticsCost: feeBreakdown.total_fee,
        baseFare: feeBreakdown.base_fare,
        distanceFare: feeBreakdown.distance_fare,
        tollCharges: feeBreakdown.toll_charges,
        loadingUnloadingCharge: feeBreakdown.loading_unloading_charge,
        waitingCharge: feeBreakdown.waiting_charge,
        roadDistanceKm: distanceKm,
        allocatedVehicleType: vType,
        estimated_transit_minutes: durationMinutes,
      },
    });
    createdReqs.push(req);
  }

  return createdReqs;
}

export async function findEligibleTransporter(
  cargoWeightKg: number,
  deliveryDistrict: string,
  pickupLat?: number | null,
  pickupLon?: number | null
) {
  const cargoKg = Math.round(Number(cargoWeightKg) * 100) / 100;

  const transporters = await prisma.transporterProfile.findMany({
    where: {
      isAvailable: true,
      user: { isActive: true },
      vehicle: {
        isActive: true,
      },
    },
    include: {
      vehicle: true,
      user: true,
    },
  });

  const eligible: { transporter: any; vehicle: any }[] = [];
  for (const t of transporters) {
    const v = t.vehicle;
    if (!v || !v.isActive) continue;
    const readiness = evaluateDispatchReadiness(cargoKg, Number(v.capacityKg), v.vehicleType || undefined);
    if (readiness.is_eligible) {
      eligible.push({ transporter: t, vehicle: v });
    }
  }

  if (eligible.length === 0) return { transporter: null, vehicle: null };

  const districtMatches = eligible.filter(
    (e) => e.transporter.district && e.transporter.district.toLowerCase() === deliveryDistrict.toLowerCase()
  );
  const pool = districtMatches.length > 0 ? districtMatches : eligible;

  if (pickupLat != null && pickupLon != null) {
    pool.sort((a, b) => {
      const latA = Number(a.vehicle.currentLatitude || a.transporter.baseLatitude || 0);
      const lonA = Number(a.vehicle.currentLongitude || a.transporter.baseLongitude || 0);
      const latB = Number(b.vehicle.currentLatitude || b.transporter.baseLatitude || 0);
      const lonB = Number(b.vehicle.currentLongitude || b.transporter.baseLongitude || 0);
      return haversineKm(pickupLat, pickupLon, latA, lonA) - haversineKm(pickupLat, pickupLon, latB, lonB);
    });
  } else {
    pool.sort((a, b) => Number(a.vehicle.capacityKg) - Number(b.vehicle.capacityKg));
  }

  return pool[0];
}

export async function createDeliveryBatches(deliveryDistrict?: string | null) {
  // 0. Reclaim unaccepted draft batches so new incoming orders consolidate together
  const draftBatches = await prisma.deliveryBatch.findMany({
    where: {
      status: { in: ['BATCH_CREATED', 'TRANSPORTER_ASSIGNED'] },
      ...(deliveryDistrict ? { deliveryArea: deliveryDistrict } : {}),
    },
    include: {
      fulfillmentItems: true,
      transportRequests: true,
    },
  });

  for (const dbatch of draftBatches) {
    await prisma.orderFulfillmentItem.updateMany({
      where: { batchId: dbatch.id },
      data: { batchId: null, status: 'PENDING' },
    });
    await prisma.transportRequest.updateMany({
      where: { batchId: dbatch.id },
      data: { batchId: null },
    });
    await prisma.batchStop.deleteMany({
      where: { batchId: dbatch.id },
    });
    await prisma.deliveryBatch.delete({
      where: { id: dbatch.id },
    });
  }

  // 1. Fetch pending unbatched fulfillment items
  const items = await prisma.orderFulfillmentItem.findMany({
    where: {
      status: 'PENDING',
      batchId: null,
      order: {
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
    },
    include: {
      order: {
        include: {
          buyer: true,
        },
      },
      orderItem: {
        include: {
          listing: true,
        },
      },
    },
  });

  if (items.length === 0) return [];

  // 2. Group items by delivery district
  const districtGroups: Record<string, typeof items> = {};
  for (const item of items) {
    const dist = resolveOrderDistrict(item.order);
    if (deliveryDistrict && dist.toLowerCase() !== deliveryDistrict.toLowerCase()) continue;
    if (!districtGroups[dist]) districtGroups[dist] = [];
    districtGroups[dist].push(item);
  }

  const createdBatches = [];

  for (const [distName, distItems] of Object.entries(districtGroups)) {
    if (distItems.length === 0) continue;

    const orderToItems: Record<number, typeof distItems> = {};
    for (const it of distItems) {
      if (!orderToItems[it.orderId]) orderToItems[it.orderId] = [];
      orderToItems[it.orderId].push(it);
    }

    const includedOrders = Array.from(new Set(distItems.map((i) => i.order)));
    const totalCargo = distItems.reduce((acc, i) => acc + Number(i.quantity), 0);
    const totalOrdersCount = includedOrders.length;
    const totalCustomersCount = new Set(includedOrders.map((o) => o.buyerId)).size;

    const distPrefix = distName.slice(0, 3).toUpperCase();
    const timestampStr = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(2, 12);
    const randomSuffix = crypto.randomBytes(2).toString('hex').toUpperCase();
    const batchCode = `BATCH-${distPrefix}-${timestampStr}-${randomSuffix}`;

    const now = new Date();
    const pickupDeadline = new Date(now.getTime() + 24 * 3600 * 1000);
    const deliveryDeadline = new Date(now.getTime() + 48 * 3600 * 1000);

    const batch = await prisma.deliveryBatch.create({
      data: {
        batchCode,
        deliveryArea: distName,
        totalQuantityKg: totalCargo,
        totalOrdersCount,
        totalCustomersCount,
        requiredVehicleCapacityKg: totalCargo,
        status: 'BATCH_CREATED',
        pickup_deadline: pickupDeadline,
        delivery_deadline: deliveryDeadline,
        createdAt: now,
      },
    });

    await prisma.orderFulfillmentItem.updateMany({
      where: {
        id: { in: distItems.map((i) => i.id) },
      },
      data: {
        batchId: batch.id,
        status: 'BATCHED',
      },
    });

    // Warehouses sorting
    const whItemsMap: Record<string, typeof distItems> = {};
    for (const it of distItems) {
      if (!whItemsMap[it.warehouseCode]) whItemsMap[it.warehouseCode] = [];
      whItemsMap[it.warehouseCode].push(it);
    }

    const sortedWhCodes = Object.keys(whItemsMap).sort((a, b) => {
      const idxA = WAREHOUSE_SEQUENCE.indexOf(a);
      const idxB = WAREHOUSE_SEQUENCE.indexOf(b);
      return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
    });

    let seq = 1;
    const batchStops = [];

    // PICKUP STOPS
    for (const whCode of sortedWhCodes) {
      const whItems = whItemsMap[whCode];
      const whWeight = whItems.reduce((acc, i) => acc + Number(i.quantity), 0);
      const sample = whItems[0];
      const stop = await prisma.batchStop.create({
        data: {
          batchId: batch.id,
          stopType: 'PICKUP',
          sequence: seq,
          locationName: sample.warehouseName,
          latitude: sample.warehouseLatitude,
          longitude: sample.warehouseLongitude,
          cargoKg: whWeight,
          notes: `Pickup ${sample.warehouseName} (${whWeight} kg cargo for ${whItems.length} item(s))`,
          status: 'PENDING',
        },
      });
      batchStops.push(stop);
      seq++;
    }

    // DELIVERY STOPS
    for (const ord of includedOrders) {
      const ordItems = distItems.filter((i) => i.orderId === ord.id);
      const ordWeight = ordItems.reduce((acc, i) => acc + Number(i.quantity), 0);
      const customerName = ord.buyer?.fullName || 'Customer';
      const destLoc = ord.deliveryLocation || `${distName} Destination`;

      const stop = await prisma.batchStop.create({
        data: {
          batchId: batch.id,
          stopType: 'DELIVERY',
          sequence: seq,
          locationName: destLoc,
          latitude: ord.deliveryLatitude,
          longitude: ord.deliveryLongitude,
          cargoKg: ordWeight,
          orderId: ord.id,
          customerName,
          notes: `Deliver Order #${ord.id} to ${customerName} (${ordWeight} kg)`,
          status: 'PENDING',
        },
      });
      batchStops.push(stop);
      seq++;
    }

    // Calculate road distance and fees
    let totalKm = 0;
    for (let i = 0; i < batchStops.length - 1; i++) {
      const s1 = batchStops[i];
      const s2 = batchStops[i + 1];
      const { distanceKm } = await getRoadDistanceAndDuration(
        s1.latitude ? Number(s1.latitude) : 8.7139,
        s1.longitude ? Number(s1.longitude) : 77.7567,
        s2.latitude ? Number(s2.latitude) : 8.7139,
        s2.longitude ? Number(s2.longitude) : 77.7567
      );
      totalKm += distanceKm;
    }

    totalKm = Math.round(totalKm * 100) / 100;
    const vType = selectVehicleType(totalCargo);
    const feeBreakdown = await calculateTransportFee(totalKm, vType);

    // Find eligible transporter
    const firstPickup = batchStops[0];
    const { transporter, vehicle } = await findEligibleTransporter(
      totalCargo,
      distName,
      firstPickup?.latitude ? Number(firstPickup.latitude) : null,
      firstPickup?.longitude ? Number(firstPickup.longitude) : null
    );

    let batchStatus = 'BATCH_CREATED';
    if (transporter && vehicle) {
      const readiness = evaluateDispatchReadiness(
        totalCargo,
        Number(vehicle.capacityKg),
        vehicle.vehicleType
      );
      batchStatus =
        readiness.dispatch_status === 'HOLD_FOR_CONSOLIDATION'
          ? 'HOLD_FOR_CONSOLIDATION'
          : 'TRANSPORTER_ASSIGNED';

      await createNotification(
        transporter.userId,
        `New Delivery Batch Assigned: ${batchCode}`,
        `Batch ${batchCode} allocated to your vehicle. Cargo: ${totalCargo} kg across ${totalOrdersCount} customer orders. Delivery Area: ${distName}. Payout: ₹${feeBreakdown.total_fee}.`,
        'TRANSPORT',
        '/transporter/dashboard'
      );
    }

    const updatedBatch = await prisma.deliveryBatch.update({
      where: { id: batch.id },
      data: {
        estimatedDistanceKm: totalKm,
        estimatedLogisticsCost: feeBreakdown.total_fee,
        base_fare: feeBreakdown.base_fare,
        distance_fare: feeBreakdown.distance_fare,
        toll_charges: feeBreakdown.toll_charges,
        loading_unloading_charge: feeBreakdown.loading_unloading_charge,
        waiting_charge: feeBreakdown.waiting_charge,
        allocated_vehicle_type: feeBreakdown.vehicle_type,
        assignedTransporterId: transporter?.id || null,
        assignedVehicleId: vehicle?.id || null,
        status: batchStatus as any,
      },
    });

    // Multi-customer route cost allocation & TransportRequest linkage
    const shipmentItems = [];
    for (const ord of includedOrders) {
      const ordCargo = distItems.filter((i) => i.orderId === ord.id).reduce((acc, i) => acc + Number(i.quantity), 0);
      const { distanceKm } = await getRoadDistanceAndDuration(
        firstPickup?.latitude ? Number(firstPickup.latitude) : 8.7139,
        firstPickup?.longitude ? Number(firstPickup.longitude) : 77.7567,
        ord.deliveryLatitude ? Number(ord.deliveryLatitude) : 8.7139,
        ord.deliveryLongitude ? Number(ord.deliveryLongitude) : 77.7567
      );
      shipmentItems.push({
        order_id: ord.id,
        weight_kg: ordCargo,
        direct_road_distance_km: distanceKm,
      });
    }

    const allocatedShipments = allocateMultiCustomerRouteCosts(
      feeBreakdown.total_fee,
      shipmentItems
    );
    const allocMap = new Map<number, number>();
    for (const s of allocatedShipments) {
      allocMap.set((s as any).order_id, Number(s.allocated_fee));
    }

    for (const ord of includedOrders) {
      const allocatedCost = allocMap.get(ord.id) || feeBreakdown.total_fee;
      await prisma.transportRequest.updateMany({
        where: { orderId: ord.id },
        data: {
          batchId: batch.id,
          logisticsCost: allocatedCost,
          assignedVehicleId: vehicle?.id || null,
          vehicleCapacityKg: vehicle?.capacityKg || null,
        },
      });
    }

    createdBatches.push(updatedBatch);
  }

  return createdBatches;
}

export async function dispatchOrderFulfillment(orderId: number) {
  try {
    await createFulfillmentItemsForOrder(orderId);
  } catch (err) {
    console.error('Error creating fulfillment items for order:', err);
  }

  try {
    await createTransportRequestsForOrder(orderId);
  } catch (err) {
    console.error('Error creating transport requests for order:', err);
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { buyer: true },
    });
    if (order) {
      const dist = resolveOrderDistrict(order);
      await createDeliveryBatches(dist);
    }
  } catch (err) {
    console.error('Error creating delivery batches for order:', err);
  }

  try {
    await notifyOrderPlaced(orderId);
  } catch (err) {
    console.error('Error sending order placed notifications:', err);
  }
}

export async function acceptDeliveryBatch(batchId: number, transporterId: number) {
  const batch = await prisma.deliveryBatch.findUnique({
    where: { id: batchId },
    include: {
      stops: true,
      fulfillmentItems: true,
    },
  });

  if (!batch) {
    throw new Error('Delivery batch not found');
  }

  if (batch.status !== 'BATCH_CREATED' && batch.status !== 'TRANSPORTER_ASSIGNED') {
    throw new Error(`Cannot accept delivery batch with status '${batch.status}'. Already claimed or in transit.`);
  }

  if (batch.assignedTransporterId && batch.assignedTransporterId !== transporterId) {
    throw new Error('This delivery batch has been assigned to another carrier.');
  }

  const transporter = await prisma.transporterProfile.findUnique({
    where: { id: transporterId },
    include: { vehicle: true },
  });

  if (!transporter || !transporter.vehicle || !transporter.vehicle.isActive) {
    throw new Error('No active vehicle registered for this transporter');
  }

  const vehicle = transporter.vehicle;
  const readiness = evaluateDispatchReadiness(
    Number(batch.totalQuantityKg),
    Number(vehicle.capacityKg),
    vehicle.vehicleType || undefined
  );

  if (!readiness.is_eligible) {
    throw new Error(readiness.reason);
  }

  const updatedBatch = await prisma.deliveryBatch.update({
    where: { id: batchId },
    data: {
      assignedTransporterId: transporter.id,
      assignedVehicleId: vehicle.id,
      status: 'ACCEPTED',
    },
  });

  await prisma.transportRequest.updateMany({
    where: { batchId: batch.id },
    data: {
      assignedVehicleId: vehicle.id,
      vehicleCapacityKg: vehicle.capacityKg,
      status: 'ACCEPTED',
    },
  });

  const orderIds = Array.from(new Set(batch.fulfillmentItems.map((fi) => fi.orderId)));
  for (const oid of orderIds) {
    const ord = await prisma.order.findUnique({
      where: { id: oid },
      include: { buyer: true },
    });
    if (ord?.buyer?.userId) {
      await createNotification(
        ord.buyer.userId,
        `Carrier Assigned: Order #${ord.id}`,
        `Transporter ${transporter.fullName} accepted consignment batch ${batch.batchCode}. Preparing for warehouse pickup.`,
        'TRANSPORT',
        '/buyer/orders'
      );
    }
  }

  return updatedBatch;
}

export async function updateBatchStatus(
  batchId: number,
  newStatus: string,
  transporterId?: number | null,
  isAdmin = false,
  otp?: string | null
) {
  const batch = await prisma.deliveryBatch.findUnique({
    where: { id: batchId },
    include: {
      stops: true,
      fulfillmentItems: true,
      transporter: { include: { user: true } },
    },
  });

  if (!batch) {
    throw new Error('Delivery batch not found');
  }

  const orderIds = Array.from(new Set(batch.fulfillmentItems.map((i) => i.orderId)));

  if (newStatus === 'DELIVERED') {
    const ordersInBatch = await prisma.order.findMany({
      where: { id: { in: orderIds } },
      include: { buyer: true },
    });

    const submittedOtps = new Set(
      (otp || '')
        .replace(/,/g, ' ')
        .split(/\s+/)
        .map((s) => s.trim())
        .filter(Boolean)
    );

    for (const ord of ordersInBatch) {
      if (ord.deliveryOtp && !isAdmin) {
        if (!submittedOtps.has(ord.deliveryOtp.trim())) {
          const buyerName = ord.buyer?.fullName || `Buyer #${ord.buyerId}`;
          throw new Error(
            `Invalid Delivery Verification OTP for Order #${ord.id} (${buyerName}). Please enter the buyer's 6-digit OTP to confirm delivery.`
          );
        }
      }
    }
  }

  const updatedBatch = await prisma.deliveryBatch.update({
    where: { id: batchId },
    data: {
      status: newStatus as any,
      ...(newStatus === 'IN_TRANSIT' ? { in_transit_at: new Date() } : {}),
    },
  });

  if (newStatus === 'PICKED_UP') {
    await prisma.batchStop.updateMany({
      where: { batchId: batch.id, stopType: 'PICKUP' },
      data: { status: 'COMPLETED' },
    });
    await prisma.orderFulfillmentItem.updateMany({
      where: { batchId: batch.id },
      data: { status: 'PICKED_UP' },
    });
    await prisma.transportRequest.updateMany({
      where: { batchId: batch.id },
      data: { status: 'PICKUP' },
    });

    for (const oid of orderIds) {
      const ord = await prisma.order.findUnique({ where: { id: oid }, include: { buyer: true } });
      if (ord?.buyer?.userId) {
        await createNotification(
          ord.buyer.userId,
          `Order #${ord.id} Picked Up`,
          `Consignment has been picked up from the district warehouse for batch ${batch.batchCode}.`,
          'DELIVERY',
          '/buyer/orders'
        );
      }
    }
  } else if (newStatus === 'IN_TRANSIT') {
    const dist = Number(batch.estimatedDistanceKm || 0);
    const estMins = dist > 0 ? Math.max(1, Math.round((dist / 40.0) * 60)) : 0;
    await prisma.deliveryBatch.update({
      where: { id: batchId },
      data: { estimated_transit_minutes: estMins },
    });
    await prisma.transportRequest.updateMany({
      where: { batchId: batch.id },
      data: {
        status: 'IN_TRANSIT',
        in_transit_at: new Date(),
        estimated_transit_minutes: estMins,
      },
    });

    for (const oid of orderIds) {
      const ord = await prisma.order.findUnique({ where: { id: oid }, include: { buyer: true } });
      if (ord?.buyer?.userId) {
        await createNotification(
          ord.buyer.userId,
          `Order #${ord.id} In Transit`,
          `Batch ${batch.batchCode} is on the road to ${batch.deliveryArea}.`,
          'DELIVERY',
          '/buyer/orders'
        );
      }
    }
  } else if (newStatus === 'OUT_FOR_DELIVERY') {
    for (const oid of orderIds) {
      const ord = await prisma.order.findUnique({ where: { id: oid }, include: { buyer: true } });
      if (ord?.buyer?.userId) {
        const otpTxt = ord.deliveryOtp ? ` Your Delivery OTP is ${ord.deliveryOtp}. Share this with the delivery driver upon arrival.` : '';
        await createNotification(
          ord.buyer.userId,
          ord.deliveryOtp ? `Order #${ord.id} Out For Delivery - OTP: ${ord.deliveryOtp}` : `Order #${ord.id} Out For Delivery`,
          `Your delivery is arriving today from batch ${batch.batchCode}.${otpTxt}`,
          'DELIVERY',
          '/buyer/orders'
        );
      }
    }
  } else if (newStatus === 'DELIVERED') {
    await prisma.batchStop.updateMany({
      where: { batchId: batch.id },
      data: { status: 'COMPLETED' },
    });
    await prisma.orderFulfillmentItem.updateMany({
      where: { batchId: batch.id },
      data: { status: 'DELIVERED' },
    });
    await prisma.transportRequest.updateMany({
      where: { batchId: batch.id },
      data: { status: 'DELIVERED' },
    });

    for (const oid of orderIds) {
      const ord = await prisma.order.findUnique({
        where: { id: oid },
        include: { buyer: true, payment: true },
      });
      if (ord) {
        const isPod = ord.paymentMethod === 'PAY_ON_DELIVERY' && ord.paymentStatus === 'PENDING';
        await prisma.order.update({
          where: { id: oid },
          data: {
            status: 'DELIVERED',
            ...(isPod ? { paymentStatus: 'PAID', paidAt: new Date() } : {}),
          },
        });
        if (isPod) {
          await prisma.payment.updateMany({
            where: { orderId: oid },
            data: { paymentStatus: 'PAID', paidAt: new Date() },
          });
        }
        if (ord.buyer?.userId) {
          await createNotification(
            ord.buyer.userId,
            `Order #${ord.id} Delivered!`,
            `Your produce has been delivered successfully. Thank you for using AgriDirect!`,
            'DELIVERY',
            '/buyer/orders'
          );
        }
      }
    }

    if (batch.transporter?.user) {
      await createNotification(
        batch.transporter.user.id,
        `Batch ${batch.batchCode} Completed`,
        `All ${orderIds.length} customer deliveries completed. Payout of ₹${batch.estimatedLogisticsCost} credited.`,
        'TRANSPORT',
        '/transporter/dashboard'
      );
    }
  }

  return updatedBatch;
}

export async function getBatchAdminStats() {
  const batches = await prisma.deliveryBatch.findMany();
  const pending = batches.filter((b) => b.status === 'BATCH_CREATED' || b.status === 'TRANSPORTER_ASSIGNED');
  const active = batches.filter((b) =>
    ['ACCEPTED', 'READY_FOR_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(b.status)
  );
  const completed = batches.filter((b) => b.status === 'DELIVERED');
  const unassigned = batches.filter((b) => !b.assignedTransporterId);
  const failed = batches.filter((b) => b.status === 'CANCELLED');

  const totalCargo = batches.reduce((acc, b) => acc + Number(b.totalQuantityKg || 0), 0);
  const totalOrders = batches.reduce((acc, b) => acc + (b.totalOrdersCount || 0), 0);
  const warehouses = Object.values(DISTRICT_WAREHOUSES).map((w) => w.warehouse_name);
  const deliveryAreas = Array.from(SUPPORTED_DISTRICTS).sort();

  return {
    total_batches: batches.length,
    delivered_batches: completed.length,
    total_weight_kg: Math.round(totalCargo * 100) / 100,
    total_customers_served: completed.reduce((acc, b) => acc + (b.totalCustomersCount || 0), 0),
    pending_batches: pending.length,
    transporter_assignments: batches.length - unassigned.length,
    active_transport_jobs: active.length,
    completed_deliveries: completed.length,
    unassigned_batches: unassigned.length,
    failed_deliveries: failed.length,
    warehouse_pickup_locations: warehouses,
    delivery_areas: deliveryAreas,
    total_orders_in_batches: totalOrders,
    total_cargo_transported_kg: Math.round(totalCargo * 100) / 100,
  };
}
