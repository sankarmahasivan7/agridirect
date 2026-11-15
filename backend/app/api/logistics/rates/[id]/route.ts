import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { getAuthUser } from '@/lib/auth';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const rateId = parseInt(params.id, 10);
    if (isNaN(rateId)) return errorResponse('Invalid rate ID', 400);

    const rate = await prisma.vehicle_rates.findUnique({
      where: { id: rateId },
    });
    if (!rate) return errorResponse('Vehicle rate not found', 404);

    return jsonResponse({
      id: rate.id,
      vehicle_type: rate.vehicle_type,
      base_fare: Number(rate.base_fare),
      rate_per_km: Number(rate.rate_per_km),
      minimum_fare: Number(rate.minimum_fare),
      loading_unloading_charge: Number(rate.loading_unloading_charge),
      waiting_charge_per_hour: Number(rate.waiting_charge_per_hour),
      active: rate.active,
      updated_at: rate.updated_at,
    });
  } catch (err: any) {
    console.error('Get rate error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const rateId = parseInt(params.id, 10);
    if (isNaN(rateId)) return errorResponse('Invalid rate ID', 400);

    const authUser = await getAuthUser(req);
    if (!authUser || authUser.role !== 'admin') {
      return errorResponse('Forbidden: only admins can update vehicle rates', 403);
    }

    const body = await req.json();
    const updateData: any = {};
    if (body.base_fare !== undefined) updateData.base_fare = Number(body.base_fare);
    if (body.rate_per_km !== undefined) updateData.rate_per_km = Number(body.rate_per_km);
    if (body.minimum_fare !== undefined) updateData.minimum_fare = Number(body.minimum_fare);
    if (body.loading_unloading_charge !== undefined) updateData.loading_unloading_charge = Number(body.loading_unloading_charge);
    if (body.waiting_charge_per_hour !== undefined) updateData.waiting_charge_per_hour = Number(body.waiting_charge_per_hour);
    if (body.active !== undefined) updateData.active = Boolean(body.active);

    const updated = await prisma.vehicle_rates.update({
      where: { id: rateId },
      data: updateData,
    });

    return jsonResponse({
      id: updated.id,
      vehicle_type: updated.vehicle_type,
      base_fare: Number(updated.base_fare),
      rate_per_km: Number(updated.rate_per_km),
      minimum_fare: Number(updated.minimum_fare),
      loading_unloading_charge: Number(updated.loading_unloading_charge),
      waiting_charge_per_hour: Number(updated.waiting_charge_per_hour),
      active: updated.active,
      updated_at: updated.updated_at,
    });
  } catch (err: any) {
    console.error('Update vehicle rate error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}
