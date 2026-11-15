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
      license_number,
      base_location,
      district: rawDistrict,
      base_latitude,
      base_longitude,
      vehicle_name,
      vehicle_number,
      vehicle_type,
      capacity_kg,
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
      district = normalizeDistrict(rawDistrict || base_location);
    } catch (e: any) {
      return errorResponse(e.message || 'Invalid district', 400);
    }

    const vType = vehicle_type || 'Mini Truck';
    let capKg = Number(capacity_kg || 500);
    const vTypeLower = vType.toLowerCase();
    const vNameLower = (vehicle_name || '').toLowerCase();
    if (
      vTypeLower.includes('bike') ||
      vTypeLower.includes('two') ||
      vTypeLower.includes('scooter') ||
      vNameLower.includes('bike')
    ) {
      capKg = Math.min(capKg, 50.0);
    }

    const hashedPassword = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email,
        phone: phone || null,
        hashedPassword,
        role: 'transporter',
        isActive: true,
        isVerified: true,
        transporterProfile: {
          create: {
            fullName: full_name,
            licenseNumber: license_number || null,
            baseLocation: base_location || district,
            district,
            baseLatitude: base_latitude ? Number(base_latitude) : null,
            baseLongitude: base_longitude ? Number(base_longitude) : null,
            isAvailable: true,
            vehicle: {
              create: {
                name: vehicle_name || 'Primary Delivery Vehicle',
                vehicleNumber: vehicle_number || 'TN-XX-XXXX',
                vehicleType: vType,
                capacityKg: capKg,
                currentLatitude: base_latitude ? Number(base_latitude) : null,
                currentLongitude: base_longitude ? Number(base_longitude) : null,
                locationLabel: base_location || district,
                isActive: true,
              },
            },
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
    console.error('Transporter registration error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}
