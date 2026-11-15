export function haversineKm(
  lat1: number | string | null | undefined,
  lon1: number | string | null | undefined,
  lat2: number | string | null | undefined,
  lon2: number | string | null | undefined
): number {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) {
    return 0;
  }
  const l1 = Number(lat1);
  const lo1 = Number(lon1);
  const l2 = Number(lat2);
  const lo2 = Number(lon2);

  if (isNaN(l1) || isNaN(lo1) || isNaN(l2) || isNaN(lo2)) {
    return 0;
  }

  const R = 6371; // Earth's radius in km
  const dLat = ((l2 - l1) * Math.PI) / 180;
  const dLon = ((lo2 - lo1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((l1 * Math.PI) / 180) *
      Math.cos((l2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

