import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { getAuthUser } from '@/lib/auth';

export async function OPTIONS() {
  return handleOptions();
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const notifId = parseInt(params.id, 10);
    if (isNaN(notifId)) return errorResponse('Invalid notification ID', 400);

    const authUser = await getAuthUser(req);
    if (!authUser) return errorResponse('Not authenticated', 401);

    const notif = await prisma.notification.findFirst({
      where: { id: notifId, userId: authUser.userId },
    });
    if (!notif) return errorResponse('Notification not found', 404);

    const updated = await prisma.notification.update({
      where: { id: notifId },
      data: { isRead: true },
    });

    return jsonResponse({
      id: updated.id,
      user_id: updated.userId,
      title: updated.title,
      message: updated.message,
      notification_type: updated.notificationType,
      link: updated.link,
      is_read: updated.isRead,
      created_at: updated.createdAt,
    });
  } catch (err: any) {
    console.error('Mark notification read error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

