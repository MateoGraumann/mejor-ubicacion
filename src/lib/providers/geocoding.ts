import { prisma } from "@/lib/db";
import { isInsideBBox, normalizeAddress, type LatLng } from "@/lib/geo";
import { recordGeocodeCalls } from "@/lib/cache/budget";
import { CDU_BBOX } from "@/lib/data/cdu-seed";

export type GeocodeResult = {
  lat: number;
  lng: number;
  formattedAddress: string;
  fromCache: boolean;
  provider: "google" | "nominatim" | "cache";
};

const CITY_SUFFIX = "Concepción del Uruguay, Entre Ríos, Argentina";

/** Ensure the query is scoped to CdU even if the user only types the street. */
export function enrichAddress(address: string): string {
  const trimmed = address.trim();
  const normalized = normalizeAddress(trimmed);
  if (
    normalized.includes("concepcion del uruguay") ||
    normalized.includes("concepcion d uruguay")
  ) {
    return trimmed;
  }
  return `${trimmed}, ${CITY_SUFFIX}`;
}

type NominatimHit = {
  lat: string;
  lon: string;
  display_name: string;
  class?: string;
  type?: string;
  importance?: number;
  address?: {
    house_number?: string;
    road?: string;
    town?: string;
    city?: string;
    state?: string;
  };
};

function parseStreetAndNumber(address: string): {
  street: string;
  number: string | null;
} {
  const cleaned = address
    .replace(/,?\s*Concepci[oó]n del Uruguay.*/i, "")
    .replace(/,?\s*Entre R[ií]os.*/i, "")
    .replace(/,?\s*Argentina.*/i, "")
    .trim();

  const match = cleaned.match(
    /^(.+?)\s+(\d+[a-zA-Z]?)\s*$/,
  );
  if (match) {
    return { street: match[1].trim(), number: match[2] };
  }
  return { street: cleaned, number: null };
}

async function nominatimSearch(
  params: Record<string, string>,
): Promise<NominatimHit[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "5");
  url.searchParams.set("countrycodes", "ar");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": "mejor-ubicacion-mvp/0.1 (concepcion-del-uruguay)",
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
  return (await res.json()) as NominatimHit[];
}

function pickBestHit(hits: NominatimHit[]): NominatimHit | null {
  if (!hits.length) return null;

  const inCity = hits.filter((h) => {
    const lat = Number(h.lat);
    const lng = Number(h.lon);
    return isInsideBBox({ lat, lng }, CDU_BBOX);
  });
  const pool = inCity.length ? inCity : hits;

  // Prefer hits with house_number, then road, then higher importance
  return [...pool].sort((a, b) => {
    const aHouse = a.address?.house_number ? 2 : 0;
    const bHouse = b.address?.house_number ? 2 : 0;
    const aRoad = a.class === "highway" || a.address?.road ? 1 : 0;
    const bRoad = b.class === "highway" || b.address?.road ? 1 : 0;
    const scoreA = aHouse + aRoad + (a.importance ?? 0);
    const scoreB = bHouse + bRoad + (b.importance ?? 0);
    return scoreB - scoreA;
  })[0];
}

async function nominatimGeocode(address: string): Promise<GeocodeResult> {
  const enriched = enrichAddress(address);
  const { street, number } = parseStreetAndNumber(address);

  // 1) Structured search (better for "Calle Nro")
  let hits = await nominatimSearch({
    street: number ? `${street} ${number}` : street,
    city: "Concepción del Uruguay",
    state: "Entre Ríos",
    country: "Argentina",
  });

  // 2) Free-text fallback
  if (!hits.length) {
    hits = await nominatimSearch({ q: enriched });
  }

  // 3) Street-only if number wasn't found
  if (!hits.length && number) {
    hits = await nominatimSearch({
      street,
      city: "Concepción del Uruguay",
      state: "Entre Ríos",
      country: "Argentina",
    });
  }

  const best = pickBestHit(hits);
  if (!best) {
    throw new Error(
      `No se encontró "${address}" en Concepción del Uruguay. Probá con calle y altura (ej: Galarza 754).`,
    );
  }

  await recordGeocodeCalls(1);

  const lat = Number(best.lat);
  const lng = Number(best.lon);
  const houseNote =
    number && !best.address?.house_number
      ? ` (aprox. calle ${street}; OSM no tiene la altura ${number})`
      : "";

  return {
    lat,
    lng,
    formattedAddress: `${best.display_name}${houseNote}`,
    fromCache: false,
    provider: "nominatim",
  };
}

async function googleGeocode(address: string): Promise<GeocodeResult> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error("GOOGLE_MAPS_API_KEY missing");

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", enrichAddress(address));
  url.searchParams.set(
    "components",
    "locality:Concepción del Uruguay|administrative_area:Entre Ríos|country:AR",
  );
  url.searchParams.set("key", key);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Geocoding HTTP ${res.status}`);
  const data = (await res.json()) as {
    status: string;
    results: Array<{
      formatted_address: string;
      geometry: { location: { lat: number; lng: number } };
    }>;
  };

  if (data.status !== "OK" || !data.results[0]) {
    throw new Error(`Geocoding failed: ${data.status}`);
  }

  await recordGeocodeCalls(1);
  const r = data.results[0];
  return {
    lat: r.geometry.location.lat,
    lng: r.geometry.location.lng,
    formattedAddress: r.formatted_address,
    fromCache: false,
    provider: "google",
  };
}

export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  const normalized = normalizeAddress(enrichAddress(address));
  const ttlDays = Number(process.env.GEOCODE_CACHE_TTL_DAYS ?? 30);
  const now = new Date();

  const cached = await prisma.geocodeCache.findUnique({
    where: { addressNormalized: normalized },
  });

  if (cached && cached.expiresAt > now) {
    return {
      lat: cached.lat,
      lng: cached.lng,
      formattedAddress: cached.formattedAddress,
      fromCache: true,
      provider: "cache",
    };
  }

  // Prefer Google if configured; otherwise Nominatim (real OSM geocoding).
  // Mock landmarks are no longer used for user-facing geocoding.
  let result: GeocodeResult;
  if (process.env.GOOGLE_MAPS_API_KEY) {
    try {
      result = await googleGeocode(address);
    } catch {
      result = await nominatimGeocode(address);
    }
  } else {
    result = await nominatimGeocode(address);
  }

  const expiresAt = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);
  await prisma.geocodeCache.upsert({
    where: { addressNormalized: normalized },
    create: {
      addressNormalized: normalized,
      formattedAddress: result.formattedAddress,
      lat: result.lat,
      lng: result.lng,
      expiresAt,
    },
    update: {
      formattedAddress: result.formattedAddress,
      lat: result.lat,
      lng: result.lng,
      fetchedAt: now,
      expiresAt,
    },
  });

  return result;
}

export function toLatLng(result: GeocodeResult): LatLng {
  return { lat: result.lat, lng: result.lng };
}
