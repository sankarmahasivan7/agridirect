import { handleOptions, jsonResponse } from '@/lib/cors';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET() {
  return jsonResponse({ status: 'ok' });
}

