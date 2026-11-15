import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { getAuthUser } from '@/lib/auth';

export async function OPTIONS() {
  return handleOptions();
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { key: string } }
) {
  try {
    const settingKey = decodeURIComponent(params.key);
    const authUser = await getAuthUser(req);
    if (!authUser || authUser.role !== 'admin') {
      return errorResponse('Forbidden: only admins can update logistics settings', 403);
    }

    const body = await req.json();
    const { setting_value, description } = body;

    const existing = await prisma.logistics_settings.findFirst({
      where: { setting_key: settingKey },
    });

    let setting: any;
    if (existing) {
      setting = await prisma.logistics_settings.update({
        where: { id: existing.id },
        data: {
          setting_value: String(setting_value),
          description: description || undefined,
        },
      });
    } else {
      setting = await prisma.logistics_settings.create({
        data: {
          setting_key: settingKey,
          setting_value: String(setting_value),
          description: description || `Configuration for ${settingKey}`,
        },
      });
    }

    return jsonResponse({
      id: setting.id,
      setting_key: setting.setting_key,
      setting_value: setting.setting_value,
      description: setting.description,
      updated_at: setting.updated_at,
    });
  } catch (err: any) {
    console.error('Update logistics setting error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}
