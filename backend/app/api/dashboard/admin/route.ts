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
    if (!authUser || authUser.role !== 'admin') {
      return errorResponse('Forbidden: only admins can access admin dashboard', 403);
    }

    const totalUsers = await prisma.user.count();
    const farmers = await prisma.user.count({ where: { role: 'farmer' } });
    const buyers = await prisma.user.count({ where: { role: 'buyer' } });
    const transporters = await prisma.user.count({ where: { role: 'transporter' } });

    const activeListings = await prisma.productListing.count({ where: { isActive: true } });

    const orders = await prisma.order.findMany();
    const gmv = orders.reduce((acc, o) => acc + Number(o.totalAmount), 0);
    const platformFeeRevenue = orders.reduce((acc, o) => acc + Number(o.platformFee), 0);
    const logisticsRevenue = orders.reduce((acc, o) => acc + Number(o.logisticsCost), 0);

    return jsonResponse({
      total_users: totalUsers,
      farmers,
      buyers,
      transporters,
      active_listings: activeListings,
      total_orders: orders.length,
      gmv: gmv.toFixed(2),
      platform_fee_revenue: platformFeeRevenue.toFixed(2),
      logistics_revenue: logisticsRevenue.toFixed(2),
      note: orders.length === 0 ? 'GMV and revenue are Rs.0 until real orders exist.' : null,
    });
  } catch (err: any) {
    console.error('Admin dashboard error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

