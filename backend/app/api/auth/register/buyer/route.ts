import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { hashPassword, createAccessToken } from '@/lib/auth';
import { normalizeDistrict, getDistrictWarehouse } from '@/lib/constants';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      email,
      phone,
      password,
      full_name,
      business_name,
      buyer_type,
      location,
      district: rawDistrict,
      default_latitude,
      default_longitude,
    } = body;

    if (!email || !password || !full_name) {
      return errorResponse('Email, password, and full name are required', 400);
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return errorResponse('Email already registered', 400);
    }

    let district = 'Tenkasi';
    try {
      district = normalizeDistrict(rawDistrict || location);
    } catch (e: any) {
      return errorResponse(e.message || 'Invalid district', 400);
    }

    const hashedPassword = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email,
        phone: phone || null,
        hashedPassword,
        role: 'buyer',
        isActive: true,
        isVerified: true,
        buyerProfile: {
          create: {
            fullName: full_name,
            businessName: business_name || null,
            buyerType: buyer_type || 'consumer',
            location: location || district,
            district,
            defaultLatitude: default_latitude ? Number(default_latitude) : null,
            defaultLongitude: default_longitude ? Number(default_longitude) : null,
          },
        },
      },
    });

    const wh = getDistrictWarehouse(district);
    const token = createAccessToken(user.id, user.role);

    return jsonResponse(
      {
        access_token: token,
        role: user.role,
        user_id: user.id,
        district,
        warehouse_name: wh.warehouse_name,
      },
      201
    );
  } catch (err: any) {
    console.error('Buyer registration error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

