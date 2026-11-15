import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { getBatchAdminStats } from '@/lib/fulfillment';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET() {
  try {
    const stats = await getBatchAdminStats();
    return jsonResponse(stats);
  } catch (err: any) {
    console.error('Batch admin stats error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

