import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { getAuthUser } from '@/lib/auth';
import { getDistrictWarehouse } from '@/lib/constants';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return errorResponse('Not authenticated', 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: authUser.userId },
      include: {
        farmerProfile: true,
        buyerProfile: true,
        fpoProfile: true,
        transporterProfile: true,
      },
    });

    if (!user) {
      return errorResponse('User not found', 404);
    }

    const data: any = {
      id: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      district: null,
      warehouse_name: null,
      location: null,
      default_latitude: null,
      default_longitude: null,
      full_name: null,
    };

    if (user.buyerProfile) {
      const bp = user.buyerProfile;
      const wh = getDistrictWarehouse(bp.district, bp.location);
      data.district = bp.district;
      data.warehouse_name = wh?.warehouse_name || null;
      data.location = bp.location;
      data.default_latitude = bp.defaultLatitude != null ? Number(bp.defaultLatitude) : null;
      data.default_longitude = bp.defaultLongitude != null ? Number(bp.defaultLongitude) : null;
      data.full_name = bp.fullName;
      data.buyer_type = bp.buyerType;
    } else if (user.farmerProfile) {
      const fp = user.farmerProfile;
      const wh = getDistrictWarehouse(fp.district, fp.farmLocation);
      data.district = fp.district;
      data.warehouse_name = wh?.warehouse_name || null;
      data.location = fp.farmLocation || fp.villageTown;
      data.default_latitude = fp.farmLatitude != null ? Number(fp.farmLatitude) : null;
      data.default_longitude = fp.farmLongitude != null ? Number(fp.farmLongitude) : null;
      data.full_name = fp.fullName;
    } else if (user.transporterProfile) {
      const tp = user.transporterProfile;
      const wh = getDistrictWarehouse(tp.district, tp.baseLocation);
      data.district = tp.district;
      data.warehouse_name = wh?.warehouse_name || null;
      data.location = tp.baseLocation;
      data.default_latitude = tp.baseLatitude != null ? Number(tp.baseLatitude) : null;
      data.default_longitude = tp.baseLongitude != null ? Number(tp.baseLongitude) : null;
      data.full_name = tp.fullName;
    } else if (user.fpoProfile) {
      const fpo = user.fpoProfile;
      const wh = getDistrictWarehouse(fpo.district, fpo.location);
      data.district = fpo.district;
      data.warehouse_name = wh?.warehouse_name || null;
      data.location = fpo.location;
      data.full_name = fpo.organizationName;
    }

    return jsonResponse(data);
  } catch (err: any) {
    console.error('/me error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

