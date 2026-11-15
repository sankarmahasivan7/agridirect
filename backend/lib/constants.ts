export const SUPPORTED_DISTRICTS = ['Tenkasi', 'Tirunelveli', 'Thoothukudi'];

export const DISTRICT_ALIASES: Record<string, string> = {
  tenkasi: 'Tenkasi',
  tirunelveli: 'Tirunelveli',
  nellai: 'Tirunelveli',
  thoothukudi: 'Thoothukudi',
  thothukudi: 'Thoothukudi',
  tuticorin: 'Thoothukudi',
};

export interface WarehouseInfo {
  district: string;
  warehouse_name: string;
  code: string;
  address: string;
  latitude: number;
  longitude: number;
  contact_phone: string;
  operating_hours: string;
}

export const DISTRICT_WAREHOUSES: Record<string, WarehouseInfo> = {
  Tenkasi: {
    district: 'Tenkasi',
    warehouse_name: 'Tenkasi Central Agri-Warehouse',
    code: 'WH-TKS-01',
    address: 'Tenkasi Regulated Market Complex, Old Bus Stand Road, Tenkasi - 627811',
    latitude: 8.9594,
    longitude: 77.3167,
    contact_phone: '+91 4633 222100',
    operating_hours: '06:00 AM - 08:00 PM',
  },
  Tirunelveli: {
    district: 'Tirunelveli',
    warehouse_name: 'Tirunelveli Central Agri-Warehouse',
    code: 'WH-TNV-01',
    address: 'Tirunelveli Agro-Logistics Hub, Bypass Road, Tirunelveli - 627005',
    latitude: 8.7139,
    longitude: 77.7567,
    contact_phone: '+91 462 2334100',
    operating_hours: '06:00 AM - 08:00 PM',
  },
  Thoothukudi: {
    district: 'Thoothukudi',
    warehouse_name: 'Thoothukudi Central Agri-Warehouse',
    code: 'WH-TUT-01',
    address: 'Thoothukudi Port-Agri Warehousing Center, Harbour Express Highway, Thoothukudi - 628004',
    latitude: 8.7642,
    longitude: 78.1348,
    contact_phone: '+91 461 2352100',
    operating_hours: '06:00 AM - 08:00 PM',
  },
};

export const DEFAULT_DISTRICT = 'Tirunelveli';

export function normalizeDistrict(rawDistrict?: string | null): string {
  if (!rawDistrict) return DEFAULT_DISTRICT;
  const clean = rawDistrict.trim().toLowerCase();
  return DISTRICT_ALIASES[clean] || DEFAULT_DISTRICT;
}

export function getDistrictWarehouse(district?: string | null, fallbackText?: string | null): WarehouseInfo {
  if (district) {
    const normalized = normalizeDistrict(district);
    if (DISTRICT_WAREHOUSES[normalized]) return DISTRICT_WAREHOUSES[normalized];
  }
  if (fallbackText) {
    const lower = fallbackText.toLowerCase();
    for (const [alias, canonical] of Object.entries(DISTRICT_ALIASES)) {
      if (lower.includes(alias)) {
        return DISTRICT_WAREHOUSES[canonical];
      }
    }
  }
  return DISTRICT_WAREHOUSES[DEFAULT_DISTRICT];
}

