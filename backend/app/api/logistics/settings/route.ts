import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import prisma from '@/lib/prisma';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET() {
  try {
    const settings = await prisma.logistics_settings.findMany({
      orderBy: { id: 'asc' },
    });
    return jsonResponse(
      settings.map((s) => ({
        id: s.id,
        setting_key: s.setting_key,
        setting_value: s.setting_value,
        description: s.description,
        updated_at: s.updated_at,
      }))
    );
  } catch (err: any) {
    console.error('Get logistics settings error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}
