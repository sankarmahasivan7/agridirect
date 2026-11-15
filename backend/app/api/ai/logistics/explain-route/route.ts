import { NextRequest } from 'next/server';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { explainRouteDecision } from '@/lib/ai';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = explainRouteDecision(body);
    return jsonResponse(result);
  } catch (err: any) {
    console.error('Explain route error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

