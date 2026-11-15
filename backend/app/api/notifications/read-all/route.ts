import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { getAuthUser } from '@/lib/auth';

export async function OPTIONS() {
  return handleOptions();
}

export async function PUT(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return errorResponse('Not authenticated', 401);

    const result = await prisma.notification.updateMany({
      where: {
        userId: authUser.userId,
        isRead: false,
      },
      data: { isRead: true },
    });

    return jsonResponse({ marked_read: result.count });
  } catch (err: any) {
    console.error('Mark all read error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

