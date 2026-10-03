import { prisma } from "@/lib/db";
import { gridCellKey, haversineMeters, type LatLng } from "@/lib/geo";
import { canCallPlaces, recordPlacesCalls } from "@/lib/cache/budget";
import type { CompetitorPlace } from "@/lib/scoring/types";

type NearbyOptions = {
  cityId: string;
  categorySlug: string;
  googleTypes: string[];
  center: LatLng;
  radiusM: number;
};

type SerpLocalResult = {
  place_id?: string;
  data_id?: string;
  data_cid?: string;
  title?: string;
  rating?: number;
  reviews?: number;
  type?: string;
  types?: string[];
  type_id?: string;
  type_ids?: string[];
  gps_coordinates?: {
    latitude: number;
    longitude: number;
  };
};

const DIRECT_TYPE_IDS = new Set([
  "coffee_shop",
  "cafe",
  "bakery",
  "coffee",
  "cafeteria",
]);

const DIRECT_TYPE_KEYWORDS = [
  "coffee",
  "cafe",
  "café",
  "cafeteria",
  "cafetería",
  "bakery",
  "panader",
  "confiter",
];

function classifyCompetition(
  typeIds: string[],
  types: string[],
): "direct" | "indirect" {
  if (typeIds.some((t) => DIRECT_TYPE_IDS.has(t.toLowerCase()))) {
    return "direct";
  }
  const joined = types.join(" ").toLowerCase();
  if (DIRECT_TYPE_KEYWORDS.some((k) => joined.includes(k))) {
    return "direct";
  }
  return "indirect";
}

function placeCacheId(result: SerpLocalResult): string {
  return (
    result.place_id ||
    result.data_cid ||
    result.data_id ||
    `serp-${result.title ?? "unknown"}-${result.gps_coordinates?.latitude}-${result.gps_coordinates?.longitude}`
  );
}

async function fetchSerpMapsSearch(
  center: LatLng,
  radiusM: number,
  query: string,
): Promise<SerpLocalResult[]> {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) {
    throw new Error("SERPAPI_API_KEY missing");
  }

  const mapHeightM = Math.max(radiusM * 2, 800);
  const url = new URL("https://serpapi.com/search");
  url.searchParams.set("engine", "google_maps");
  url.searchParams.set("type", "search");
  url.searchParams.set("q", query);
  url.searchParams.set("ll", `@${center.lat},${center.lng},${mapHeightM}m`);
  url.searchParams.set("nearby", "true");
  url.searchParams.set("hl", "es");
  url.searchParams.set("gl", "ar");
  url.searchParams.set("google_domain", "google.com.ar");
  url.searchParams.set("api_key", apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`SerpAPI Google Maps HTTP ${res.status}`);
  }

  const data = (await res.json()) as {
    error?: string;
    local_results?: SerpLocalResult[];
  };

  if (data.error) {
    throw new Error(`SerpAPI error: ${data.error}`);
  }

  await recordPlacesCalls(1);
  return data.local_results ?? [];
}

async function upsertPlaceCache(params: {
  cityId: string;
  categorySlug: string;
  gridCell: string;
  googlePlaceId: string;
  name: string;
  lat: number;
  lng: number;
  rating: number | null;
  reviewCount: number;
  types: string[];
  competitionType: "direct" | "indirect";
}) {
  const ttlDays = Number(process.env.PLACES_CACHE_TTL_DAYS ?? 14);
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
  await prisma.placeCache.upsert({
    where: { googlePlaceId: params.googlePlaceId },
    create: {
      googlePlaceId: params.googlePlaceId,
      cityId: params.cityId,
      categorySlug: params.categorySlug,
      gridCell: params.gridCell,
      name: params.name,
      lat: params.lat,
      lng: params.lng,
      rating: params.rating,
      reviewCount: params.reviewCount,
      types: params.types,
      competitionType: params.competitionType,
      expiresAt,
    },
    update: {
      name: params.name,
      lat: params.lat,
      lng: params.lng,
      rating: params.rating,
      reviewCount: params.reviewCount,
      types: params.types,
      competitionType: params.competitionType,
      gridCell: params.gridCell,
      fetchedAt: new Date(),
      expiresAt,
    },
  });
}

async function cacheSerpResults(
  options: NearbyOptions,
  results: SerpLocalResult[],
  forceType?: "direct" | "indirect",
) {
  for (const r of results) {
    const coords = r.gps_coordinates;
    if (!coords || !r.title) continue;

    const types = r.types?.length
      ? r.types
      : r.type
        ? [r.type]
        : [];
    const typeIds = r.type_ids?.length
      ? r.type_ids
      : r.type_id
        ? [r.type_id]
        : [];

    const competitionType =
      forceType ?? classifyCompetition(typeIds, types);

    await upsertPlaceCache({
      cityId: options.cityId,
      categorySlug: options.categorySlug,
      gridCell: gridCellKey({
        lat: coords.latitude,
        lng: coords.longitude,
      }),
      googlePlaceId: placeCacheId(r),
      name: r.title,
      lat: coords.latitude,
      lng: coords.longitude,
      rating: r.rating ?? null,
      reviewCount: r.reviews ?? 0,
      types: [...types, ...typeIds],
      competitionType,
    });
  }
}

export type PlacesLookupResult = {
  places: CompetitorPlace[];
  fromCacheOnly: boolean;
  budgetExhausted: boolean;
  warnings: string[];
};

export async function findCompetitors(
  options: NearbyOptions,
): Promise<PlacesLookupResult> {
  const warnings: string[] = [];
  const cell = gridCellKey(options.center);
  const now = new Date();

  const cached = await prisma.placeCache.findMany({
    where: {
      cityId: options.cityId,
      categorySlug: options.categorySlug,
      expiresAt: { gt: now },
    },
  });

  const freshInCell = cached.filter((p) => p.gridCell === cell);
  let budgetExhausted = false;
  let fromCacheOnly = false;

  // Direct + indirect search = up to 2 SerpAPI calls when cache miss
  if (freshInCell.length === 0) {
    const allowed = await canCallPlaces(2);

    if (!allowed) {
      budgetExhausted = true;
      fromCacheOnly = true;
      warnings.push(
        "Presupuesto diario de SerpAPI agotado; se usa solo cache.",
      );
    } else {
      try {
        const directQuery =
          options.categorySlug === "cafeteria"
            ? "cafetería"
            : options.googleTypes[0] ?? options.categorySlug;

        const direct = await fetchSerpMapsSearch(
          options.center,
          Math.max(options.radiusM, 500),
          directQuery,
        );
        await cacheSerpResults(options, direct, "direct");

        if (await canCallPlaces(1)) {
          const indirect = await fetchSerpMapsSearch(
            options.center,
            options.radiusM,
            "restaurant",
          );
          // Skip places already classified as direct cafes
          const filtered = indirect.filter((r) => {
            const types = r.types ?? (r.type ? [r.type] : []);
            const typeIds = r.type_ids ?? (r.type_id ? [r.type_id] : []);
            return classifyCompetition(typeIds, types) === "indirect";
          });
          await cacheSerpResults(options, filtered.slice(0, 20), "indirect");
        }
      } catch (e) {
        warnings.push(
          `SerpAPI error: ${e instanceof Error ? e.message : "unknown"}`,
        );
        fromCacheOnly = true;
      }
    }
  }

  const all = await prisma.placeCache.findMany({
    where: {
      cityId: options.cityId,
      categorySlug: options.categorySlug,
      expiresAt: { gt: now },
    },
  });

  const places: CompetitorPlace[] = all
    .map((p) => {
      const distanceM = haversineMeters(options.center, {
        lat: p.lat,
        lng: p.lng,
      });
      return {
        id: p.googlePlaceId,
        name: p.name,
        lat: p.lat,
        lng: p.lng,
        rating: p.rating,
        reviewCount: p.reviewCount,
        competitionType: (p.competitionType === "indirect"
          ? "indirect"
          : "direct") as "direct" | "indirect",
        distanceM,
      };
    })
    .filter((p) => p.distanceM <= options.radiusM)
    .sort((a, b) => a.distanceM - b.distanceM);

  return { places, fromCacheOnly, budgetExhausted, warnings };
}
