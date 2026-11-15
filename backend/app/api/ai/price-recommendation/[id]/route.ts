import { NextRequest } from 'next/server';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { getPriceRecommendation } from '@/lib/ai';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const listingId = parseInt(params.id, 10);
    if (isNaN(listingId)) return errorResponse('Invalid listing ID', 400);

    const recommendation = await getPriceRecommendation(listingId);
    return jsonResponse(recommendation);
  } catch (err: any) {
    console.error('Price recommendation error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

