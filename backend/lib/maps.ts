import { haversineKm } from './geo';

const ROAD_CIRCUITY_FACTOR = 1.25;
const ASSUMED_SPEED_KMPH = 35.0;
const HTTP_TIMEOUT_MS = 4000;

interface DistanceResult {
  distanceKm: number;
  durationMinutes: number;
}

const distanceCache = new Map<string, DistanceResult>();

function makeCacheKey(lat1: number, lon1: number, lat2: number, lon2: number): string {
  return `${lat1.toFixed(4)},${lon1.toFixed(4)},${lat2.toFixed(4)},${lon2.toFixed(4)}`;
}

async function fetchGoogleDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  apiKey: string
): Promise<DistanceResult | null> {
  try {
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${lat1},${lon1}&destinations=${lat2},${lon2}&mode=driving&key=${apiKey}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      if (data.status === 'OK' && data.rows?.[0]?.elements?.[0]?.status === 'OK') {
        const elem = data.rows[0].elements[0];
        const distKm = Math.round((elem.distance.value / 1000) * 100) / 100;
        const durMins = Math.max(5, Math.round(elem.duration.value / 60));
        return { distanceKm: distKm, durationMinutes: durMins };
      }
    }
  } catch {
    // Continue to fallback
  }
  return null;
}

async function fetchOsrmDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): Promise<DistanceResult | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=false`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      if (data.code === 'Ok' && data.routes?.[0]) {
        const route = data.routes[0];
        const distKm = Math.round((route.distance / 1000) * 100) / 100;
        const durMins = Math.max(5, Math.round(route.duration / 60));
        return { distanceKm: distKm, durationMinutes: durMins };
      }
    }
  } catch {
    // Continue to fallback
  }
  return null;
}

export async function getRoadDistanceAndDuration(
  lat1: number | null | undefined,
  lon1: number | null | undefined,
  lat2: number | null | undefined,
  lon2: number | null | undefined,
  strict = false
): Promise<DistanceResult> {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) {
    if (strict) {
      throw new Error('Coordinates (latitude and longitude) are required for road distance calculation');
    }
    return { distanceKm: 15.0, durationMinutes: 30 };
  }

  const fLat1 = Number(lat1);
  const fLon1 = Number(lon1);
  const fLat2 = Number(lat2);
  const fLon2 = Number(lon2);

  if (isNaN(fLat1) || isNaN(fLon1) || isNaN(fLat2) || isNaN(fLon2)) {
    if (strict) {
      throw new Error('Coordinates must be valid numeric latitude and longitude values');
    }
    return { distanceKm: 15.0, durationMinutes: 30 };
  }

  if (Math.abs(fLat1 - fLat2) < 0.0001 && Math.abs(fLon1 - fLon2) < 0.0001) {
    return { distanceKm: 0.0, durationMinutes: 0 };
  }

  const key = makeCacheKey(fLat1, fLon1, fLat2, fLon2);
  const cached = distanceCache.get(key);
  if (cached) {
    return cached;
  }

  const googleKey = process.env.GOOGLE_MAPS_API_KEY;
  if (googleKey) {
    const res = await fetchGoogleDistance(fLat1, fLon1, fLat2, fLon2, googleKey);
    if (res) {
      distanceCache.set(key, res);
      return res;
    }
  }

  const osrmRes = await fetchOsrmDistance(fLat1, fLon1, fLat2, fLon2);
  if (osrmRes) {
    distanceCache.set(key, osrmRes);
    return osrmRes;
  }

  const crowFly = haversineKm(fLat1, fLon1, fLat2, fLon2);
  const distKm = Math.round(crowFly * ROAD_CIRCUITY_FACTOR * 100) / 100;
  const durMins = Math.max(10, Math.round((distKm / ASSUMED_SPEED_KMPH) * 60));
  const fallbackResult = { distanceKm: distKm, durationMinutes: durMins };
  distanceCache.set(key, fallbackResult);
  return fallbackResult;
}

export async function getRouteTollCharges(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): Promise<number> {
  const googleKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!googleKey) return 0.0;
  try {
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${lat1},${lon1}&destination=${lat2},${lon2}&key=${googleKey}&mode=driving`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      if (data.status === 'OK' && data.routes?.[0]?.fare?.value) {
        return Math.round(Number(data.routes[0].fare.value) * 100) / 100;
      }
    }
  } catch {
    // Toll check error fallback
  }
  return 0.0;
}

function permute<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr];
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const sub of permute(rest)) {
      result.push([arr[i], ...sub]);
    }
  }
  return result;
}

export interface RouteStop {
  latitude: number;
  longitude: number;
  name: string;
  type: string;
  [key: string]: any;
}

export async function optimizeMultiPickupDeliveryOrder(
  pickupStops: RouteStop[],
  deliveryStops: RouteStop[]
): Promise<{ route: RouteStop[]; totalKm: number }> {
  if (pickupStops.length <= 1 && deliveryStops.length <= 1) {
    const combined = [...pickupStops, ...deliveryStops];
    return { route: combined, totalKm: 0.0 };
  }

  const pPerms = permute(pickupStops);
  const dPerms = permute(deliveryStops);

  let bestRoute: RouteStop[] = [...pickupStops, ...deliveryStops];
  let minKm = Infinity;

  for (const p of pPerms) {
    for (const d of dPerms) {
      const candidate = [...p, ...d];
      let currentKm = 0;
      for (let i = 0; i < candidate.length - 1; i++) {
        const { distanceKm } = await getRoadDistanceAndDuration(
          candidate[i].latitude,
          candidate[i].longitude,
          candidate[i + 1].latitude,
          candidate[i + 1].longitude
        );
        currentKm += distanceKm;
      }
      if (currentKm < minKm) {
        minKm = currentKm;
        bestRoute = candidate;
      }
    }
  }

  return { route: bestRoute, totalKm: Math.round(minKm * 100) / 100 };
}

