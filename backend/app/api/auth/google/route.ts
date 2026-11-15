import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { hashPassword, createAccessToken } from '@/lib/auth';
import { getDistrictWarehouse } from '@/lib/constants';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { credential, email: rawEmail, full_name: rawName, role: rawRole } = body;

    let resolvedEmail = rawEmail;
    let resolvedName = rawName;

    if (credential) {
      try {
        const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
        if (res.ok) {
          const tokenData = await res.json();
          resolvedEmail = tokenData.email || resolvedEmail;
          resolvedName = tokenData.name || tokenData.given_name || resolvedName;
        }
      } catch {
        // Fallback: decode JWT payload
        try {
          const parts = credential.split('.');
          if (parts.length >= 2) {
            const padded = parts[1] + '='.repeat((4 - (parts[1].length % 4)) % 4);
            const decoded = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
            resolvedEmail = decoded.email || resolvedEmail;
            resolvedName = decoded.name || decoded.given_name || resolvedName;
          }
        } catch {
          // ignore
        }
      }
    }

    if (!resolvedEmail) {
      return errorResponse('Could not verify Google account or email.', 400);
    }

    const targetRole = rawRole || 'buyer';
    let user = await prisma.user.findUnique({
      where: { email: resolvedEmail },
      include: {
        farmerProfile: true,
        buyerProfile: true,
        fpoProfile: true,
        transporterProfile: true,
      },
    });

    if (!user) {
      const dummyHashedPassword = await hashPassword(`GoogleAuth_${resolvedEmail}_Secured`);
      const createData: any = {
        email: resolvedEmail,
        hashedPassword: dummyHashedPassword,
        role: targetRole,
        isActive: true,
        isVerified: true,
      };

      if (targetRole === 'buyer') {
        createData.buyerProfile = {
          create: {
            fullName: resolvedName || 'Google Buyer',
            buyerType: 'consumer',
            district: 'Tenkasi',
            location: 'Tenkasi',
            defaultLatitude: 8.9594,
            defaultLongitude: 77.3167,
          },
        };
      } else if (targetRole === 'farmer') {
        createData.farmerProfile = {
          create: {
            fullName: resolvedName || 'Google Farmer',
            district: 'Tenkasi',
            state: 'Tamil Nadu',
            farmLocation: 'Tenkasi',
            farmSizeAcres: 3.5,
            farmLatitude: 8.9594,
            farmLongitude: 77.3167,
          },
        };
      } else if (targetRole === 'transporter') {
        createData.transporterProfile = {
          create: {
            fullName: resolvedName || 'Google Transporter',
            district: 'Tenkasi',
            baseLocation: 'Tenkasi',
            baseLatitude: 8.9594,
            baseLongitude: 77.3167,
            vehicles: {
              create: {
                name: 'Quick Vehicle',
                vehicleType: 'BIKE',
                capacityKg: 100.0,
                currentLatitude: 8.9594,
                currentLongitude: 77.3167,
                locationLabel: 'Tenkasi',
              },
            },
          },
        };
      }

      user = await prisma.user.create({
        data: createData,
        include: {
          farmerProfile: true,
          buyerProfile: true,
          fpoProfile: true,
          transporterProfile: true,
        },
      });
    }

    if (!user.isActive) {
      return errorResponse('Account has been deactivated.', 403);
    }

    let userDistrict: string | null = null;
    if (user.farmerProfile?.district) userDistrict = user.farmerProfile.district;
    else if (user.buyerProfile?.district) userDistrict = user.buyerProfile.district;
    else if (user.transporterProfile?.district) userDistrict = user.transporterProfile.district;
    else if (user.fpoProfile?.district) userDistrict = user.fpoProfile.district;

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
    console.error('Google login error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

