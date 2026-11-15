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
      village_town,
      district: rawDistrict,
      state,
      farm_location,
      farm_size_acres,
      farm_latitude,
      farm_longitude,
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
      district = normalizeDistrict(rawDistrict);
    } catch (e: any) {
      return errorResponse(e.message || 'Invalid district', 400);
    }

    const hashedPassword = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email,
        phone: phone || null,
        hashedPassword,
        role: 'farmer',
        isActive: true,
        isVerified: true,
        farmerProfile: {
          create: {
            fullName: full_name,
            villageTown: village_town || null,
            district,
            state: state || 'Tamil Nadu',
            farmLocation: farm_location || null,
            farmSizeAcres: farm_size_acres ? Number(farm_size_acres) : null,
            farmLatitude: farm_latitude ? Number(farm_latitude) : null,
            farmLongitude: farm_longitude ? Number(farm_longitude) : null,
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
    console.error('Farmer registration error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

