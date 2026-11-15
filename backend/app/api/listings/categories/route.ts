import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import prisma from '@/lib/prisma';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      include: {
        _count: {
          select: { products: true },
        },
      },
      orderBy: { name: 'asc' },
    });
    return jsonResponse(categories);
  } catch (err: any) {
    console.error('Get categories error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

