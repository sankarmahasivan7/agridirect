import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import prisma from '@/lib/prisma';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET() {
  try {
    const rates = await prisma.vehicle_rates.findMany({
      orderBy: { id: 'asc' },
    });
    return jsonResponse(
      rates.map((r) => ({
        id: r.id,
        vehicle_type: r.vehicle_type,
        base_fare: Number(r.base_fare),
        rate_per_km: Number(r.rate_per_km),
        minimum_fare: Number(r.minimum_fare),
        loading_unloading_charge: Number(r.loading_unloading_charge),
        waiting_charge_per_hour: Number(r.waiting_charge_per_hour),
        active: r.active,
        updated_at: r.updated_at,
      }))
    );
  } catch (err: any) {
    console.error('Get vehicle rates error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}
