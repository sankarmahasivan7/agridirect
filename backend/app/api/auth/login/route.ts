import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { verifyPassword, createAccessToken } from '@/lib/auth';
import { getDistrictWarehouse } from '@/lib/constants';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, role } = body;

    if (!email || !password) {
      return errorResponse('Email and password are required', 400);
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        farmerProfile: true,
        buyerProfile: true,
        fpoProfile: true,
        transporterProfile: true,
      },
    });

    if (!user) {
      return errorResponse('Invalid email or password', 401);
    }

    const isMatch = await verifyPassword(password, user.hashedPassword);
    if (!isMatch) {
      return errorResponse('Invalid email or password', 401);
    }

    if (role && user.role !== role) {
      return errorResponse(`This account is not registered as a ${role}`, 403);
    }

    if (!user.isActive) {
      return errorResponse('This account has been deactivated', 403);
    }

    let userDistrict: string | null = null;
    if (user.farmerProfile?.district) userDistrict = user.farmerProfile.district;
    else if (user.buyerProfile?.district) userDistrict = user.buyerProfile.district;
    else if (user.fpoProfile?.district) userDistrict = user.fpoProfile.district;
    else if (user.transporterProfile?.district) userDistrict = user.transporterProfile.district;

    const wh = userDistrict ? getDistrictWarehouse(userDistrict) : null;
    const token = createAccessToken(user.id, user.role);

    return jsonResponse({
      access_token: token,
      role: user.role,
      user_id: user.id,
      district: userDistrict,
      warehouse_name: wh?.warehouse_name || null,
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

