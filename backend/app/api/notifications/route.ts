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

    const { searchParams } = new URL(req.url);
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 50;

    const notifs = await prisma.notification.findMany({
      where: { userId: authUser.userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return jsonResponse(
      notifs.map((n) => ({
        id: n.id,
        user_id: n.userId,
        title: n.title,
        message: n.message,
        notification_type: n.notificationType,
        link: n.link,
        is_read: n.isRead,
        created_at: n.createdAt,
      }))
    );
  } catch (err: any) {
    console.error('Get notifications error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

