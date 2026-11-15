import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { getAuthUser } from '@/lib/auth';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return errorResponse('Not authenticated', 401);

    const count = await prisma.notification.count({
      where: {
        userId: authUser.userId,
        isRead: false,
      },
    });

    return jsonResponse({ unread_count: count });
  } catch (err: any) {
    console.error('Get unread count error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

