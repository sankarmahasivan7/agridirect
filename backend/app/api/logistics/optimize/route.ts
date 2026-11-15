import { NextRequest } from 'next/server';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { optimizeTransportRoutes } from '@/lib/routeOptimizer';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const capacityParam = searchParams.get('vehicle_capacity_kg');
    let capacity = capacityParam ? parseFloat(capacityParam) : 1000.0;

    const result = await optimizeTransportRoutes(capacity);
    return jsonResponse(result);
  } catch (err: any) {
    console.error('Optimize logistics error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

