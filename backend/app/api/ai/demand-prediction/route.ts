import { NextRequest } from 'next/server';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { getDemandPrediction } from '@/lib/ai';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const productName = searchParams.get('product_name') || searchParams.get('product');
    const location = searchParams.get('location');

    if (!productName) {
      return errorResponse('product_name is required', 400);
    }

    const prediction = await getDemandPrediction(productName, location);
    return jsonResponse(prediction);
  } catch (err: any) {
    console.error('Demand prediction error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

