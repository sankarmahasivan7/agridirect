import { NextRequest } from 'next/server';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { fetchLiveMandiPrices } from '@/lib/mandi';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const state = searchParams.get('state') || 'Tamil Nadu';
    const district = searchParams.get('district');
    const commodity = searchParams.get('commodity');
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 100;
    const refresh = searchParams.get('refresh') === 'true';

    const prices = await fetchLiveMandiPrices({
      state,
      district,
      commodity,
      limit,
      forceRefresh: refresh,
    });

    return jsonResponse(prices);
  } catch (err: any) {
    console.error('Live mandi prices error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

