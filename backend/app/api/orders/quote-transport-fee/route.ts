import { NextRequest } from 'next/server';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import {
  calculateOrderTransportFee,
  calculateMultiWarehouseOrderFee,
} from '@/lib/logistics';
import { getDistrictWarehouse } from '@/lib/constants';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      pickup_latitude,
      pickup_longitude,
      delivery_latitude,
      delivery_longitude,
      cargo_weight_kg,
      warehouse_coords,
      delivery_label,
    } = body;

    const delLat = delivery_latitude != null ? Number(delivery_latitude) : 8.7139;
    const delLon = delivery_longitude != null ? Number(delivery_longitude) : 77.7567;
    const weight = cargo_weight_kg != null ? Number(cargo_weight_kg) : 10.0;

    let feeBreakdown: any;
    if (warehouse_coords && Array.isArray(warehouse_coords) && warehouse_coords.length > 1) {
      feeBreakdown = await calculateMultiWarehouseOrderFee(
        warehouse_coords,
        delLat,
        delLon,
        weight,
        delivery_label || 'Customer Delivery'
      );
    } else {
      let pLat = pickup_latitude != null ? Number(pickup_latitude) : null;
      let pLon = pickup_longitude != null ? Number(pickup_longitude) : null;

      if (pLat == null || pLon == null) {
        const wh = getDistrictWarehouse('Tirunelveli');
        pLat = wh.latitude;
        pLon = wh.longitude;
      }

      feeBreakdown = await calculateOrderTransportFee(
        pLat,
        pLon,
        delLat,
        delLon,
        weight
      );
    }

    return jsonResponse(feeBreakdown);
  } catch (err: any) {
    console.error('Quote transport fee error:', err);
    return errorResponse(err.message || 'Internal server error', 400);
  }
}

