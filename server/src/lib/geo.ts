export const SAME_AREA_KM = 50;

/** Default Leaflet view — Qatar. */
export const QATAR_MAP_CENTER = { latitude: 25.3, longitude: 51.5 } as const;
export const QATAR_MAP_ZOOM = 8;

export type GeoPoint = {
  latitude?: number | null;
  longitude?: number | null;
  location?: string | null;
};

export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function normalizeLocation(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  return (
    trimmed
      .replace(/,?\s*(qatar|qat|usa|u\.s\.a\.|united states|us)$/i, '')
      .split(',')[0]
      .trim() || null
  );
}

export function resolveCoords(primary: GeoPoint, fallback?: GeoPoint | null): { lat: number; lng: number } | null {
  const lat = primary.latitude ?? fallback?.latitude;
  const lng = primary.longitude ?? fallback?.longitude;
  if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng };
  }
  // Fall back to known Qatar place-name lookup when lat/lng were never stored.
  const sample =
    geocodeSampleLocation(primary.location) ?? geocodeSampleLocation(fallback?.location ?? null);
  if (sample) return { lat: sample.latitude, lng: sample.longitude };
  return null;
}

export function resolveLocationString(primary: GeoPoint, fallback?: GeoPoint | null): string | null {
  return normalizeLocation(primary.location) ?? normalizeLocation(fallback?.location ?? null);
}

/** Same area: within ~50km when coords exist, else matching city/location string. */
export function isSameArea(a: GeoPoint, aFallback: GeoPoint | null | undefined, b: GeoPoint, bFallback: GeoPoint | null | undefined): boolean {
  const aCoords = resolveCoords(a, aFallback);
  const bCoords = resolveCoords(b, bFallback);
  if (aCoords && bCoords) {
    return haversineKm(aCoords.lat, aCoords.lng, bCoords.lat, bCoords.lng) <= SAME_AREA_KM;
  }
  const aLoc = resolveLocationString(a, aFallback);
  const bLoc = resolveLocationString(b, bFallback);
  return Boolean(aLoc && bLoc && aLoc === bLoc);
}

/** Plausible sample coordinates for known demo location strings (Qatar). */
export const SAMPLE_GEOCODES: Record<string, { latitude: number; longitude: number }> = {
  doha: { latitude: 25.2854, longitude: 51.531 },
  'doha industrial area': { latitude: 25.1745, longitude: 51.4392 },
  'industrial area': { latitude: 25.1745, longitude: 51.4392 },
  'ras laffan': { latitude: 25.9128, longitude: 51.5431 },
  raslaffan: { latitude: 25.9128, longitude: 51.5431 },
  birkat: { latitude: 25.85, longitude: 51.52 },
  'jerry al samour': { latitude: 25.2, longitude: 51.45 },
  mesaieed: { latitude: 24.9917, longitude: 51.5492 },
  'al khor': { latitude: 25.6804, longitude: 51.4969 },
  alkhor: { latitude: 25.6804, longitude: 51.4969 },
  dukhan: { latitude: 25.4244, longitude: 50.7822 },
  // Legacy US demo keys → remap to Qatar counterparts when resolving old rows
  houston: { latitude: 25.2854, longitude: 51.531 },
  phoenix: { latitude: 25.9128, longitude: 51.5431 },
  'corpus christi': { latitude: 24.9917, longitude: 51.5492 },
  'long beach': { latitude: 25.6804, longitude: 51.4969 },
  tucson: { latitude: 25.4244, longitude: 50.7822 },
};

/** Map old US sample city names to Qatar display locations. */
export const LEGACY_US_LOCATION_TO_QATAR: Record<string, string> = {
  houston: 'Doha',
  phoenix: 'Ras Laffan',
  'corpus christi': 'Mesaieed',
  'long beach': 'Al Khor',
  tucson: 'Dukhan',
};

export function geocodeSampleLocation(location?: string | null) {
  const key = normalizeLocation(location);
  if (!key) return null;
  return SAMPLE_GEOCODES[key] ?? null;
}

export function qatarLocationForLegacy(location?: string | null): string | null {
  const key = normalizeLocation(location);
  if (!key) return null;
  return LEGACY_US_LOCATION_TO_QATAR[key] ?? null;
}
