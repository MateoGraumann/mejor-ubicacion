export type LatLng = { lat: number; lng: number };

export type BBox = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

const EARTH_RADIUS_M = 6371000;

export function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function isInsideBBox(point: LatLng, bbox: BBox): boolean {
  return (
    point.lat >= bbox.minLat &&
    point.lat <= bbox.maxLat &&
    point.lng >= bbox.minLng &&
    point.lng <= bbox.maxLng
  );
}

/** Ray-casting point-in-polygon. coordinates: [lng, lat][] ring. */
export function pointInPolygon(
  point: LatLng,
  ring: number[][],
): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect =
      yi > point.lat !== yj > point.lat &&
      point.lng <
        ((xj - xi) * (point.lat - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** ~300m grid cell key for caching. */
export function gridCellKey(point: LatLng, cellSizeM = 300): string {
  const latDeg = cellSizeM / 111_320;
  const lngDeg = cellSizeM / (111_320 * Math.cos((point.lat * Math.PI) / 180));
  const latCell = Math.floor(point.lat / latDeg);
  const lngCell = Math.floor(point.lng / lngDeg);
  return `${latCell}:${lngCell}`;
}

export function normalizeAddress(address: string): string {
  return address
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const w = idx - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}

export function sampleVariance(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return (
    values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (values.length - 1)
  );
}
