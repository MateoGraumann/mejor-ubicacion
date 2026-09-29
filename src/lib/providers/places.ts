import { prisma } from "@/lib/db";
import { gridCellKey, haversineMeters, type LatLng } from "@/lib/geo";
import {
  canCallPlaces,
  recordPlacesCalls,
  useMockProviders,
} from "@/lib/cache/budget";
import type { CompetitorPlace } from "@/lib/scoring/types";

type NearbyOptions = {
  cityId: string;
  categorySlug: string;
  googleTypes: string[];
  center: LatLng;
  radiusM: number;
};

const MOCK_CAFES: Array<{
  id: string;
  name: string;
  lat: number;
  lng: number;
  rating: number;
  reviewCount: number;
  competitionType: "direct" | "indirect";
  types: string[];
}> = [
  {
    id: "mock-cafe-1",
    name: "Café del Puerto",
    lat: -32.4825,
    lng: -58.228,
    rating: 4.5,
    reviewCount: 120,
    competitionType: "direct",
    types: ["cafe"],
  },
  {
    id: "mock-cafe-2",
    name: "Panadería Urquiza",
    lat: -32.484,
    lng: -58.234,
    rating: 4.1,
    reviewCount: 85,
    competitionType: "direct",
    types: ["bakery", "cafe"],
  },
  {
    id: "mock-cafe-3",
    name: "Confitería Central",
    lat: -32.483,
    lng: -58.231,
    rating: 4.3,
    reviewCount: 210,
    competitionType: "direct",
    types: ["cafe"],
  },
  {
    id: "mock-rest-1",
    name: "Bar 9 de Julio",
    lat: -32.485,
    lng: -58.229,
    rating: 3.9,
    reviewCount: 60,
    competitionType: "indirect",
    types: ["restaurant", "bar"],
  },
  {
    id: "mock-cafe-4",
    name: "Espresso Norte",
    lat: -32.462,
    lng: -58.232,
    rating: 4.0,
    reviewCount: 40,
    competitionType: "direct",
    types: ["cafe"],
  },
  {
    id: "mock-cafe-5",
    name: "Café Costanera",
    lat: -32.481,
    lng: -58.198,
    rating: 4.6,
    reviewCount: 95,
    competitionType: "direct",
    types: ["cafe"],
  },
];

function classifyCompetition(
  types: string[],
  googleTypes: string[],
): "direct" | "indirect" {
  if (types.some((t) => googleTypes.includes(t))) return "direct";
  return "indirect";
}

async function fetchGoogleNearby(
  center: LatLng,
  radiusM: number,
  type: string,
): Promise<
  Array<{
    place_id: string;
    name: string;
    geometry: { location: { lat: number; lng: number } };
    rating?: number;
    user_ratings_total?: number;
    types?: string[];
  }>
> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error("GOOGLE_MAPS_API_KEY missing");

  const url = new URL(
    "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
  );
  url.searchParams.set("location", `${center.lat},${center.lng}`);
  url.searchParams.set("radius", String(radiusM));
  url.searchParams.set("type", type);
  url.searchParams.set("key", key);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Places Nearby HTTP ${res.status}`);
  const data = (await res.json()) as {
    status: string;
    results: Array<{
      place_id: string;
      name: string;
      geometry: { location: { lat: number; lng: number } };
      rating?: number;
      user_ratings_total?: number;
      types?: string[];
    }>;
  };

  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    throw new Error(`Places Nearby failed: ${data.status}`);
  }

  await recordPlacesCalls(1);
  return data.results ?? [];
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

  if (freshInCell.length === 0) {
    const allowed = await canCallPlaces(options.googleTypes.length || 1);

    if (useMockProviders()) {
      for (const cafe of MOCK_CAFES) {
        await upsertPlaceCache({
          cityId: options.cityId,
          categorySlug: options.categorySlug,
          gridCell: gridCellKey({ lat: cafe.lat, lng: cafe.lng }),
          googlePlaceId: cafe.id,
          name: cafe.name,
          lat: cafe.lat,
          lng: cafe.lng,
          rating: cafe.rating,
          reviewCount: cafe.reviewCount,
          types: cafe.types,
          competitionType: cafe.competitionType,
        });
      }
    } else if (!allowed) {
      budgetExhausted = true;
      fromCacheOnly = true;
      warnings.push(
        "Presupuesto diario de Google Places agotado; se usa solo cache.",
      );
    } else {
      try {
        for (const type of options.googleTypes) {
          const results = await fetchGoogleNearby(
            options.center,
            Math.max(options.radiusM, 800),
            type,
          );
          for (const r of results) {
            const types = r.types ?? [type];
            await upsertPlaceCache({
              cityId: options.cityId,
              categorySlug: options.categorySlug,
              gridCell: gridCellKey({
                lat: r.geometry.location.lat,
                lng: r.geometry.location.lng,
              }),
              googlePlaceId: r.place_id,
              name: r.name,
              lat: r.geometry.location.lat,
              lng: r.geometry.location.lng,
              rating: r.rating ?? null,
              reviewCount: r.user_ratings_total ?? 0,
              types,
              competitionType: classifyCompetition(types, options.googleTypes),
            });
          }
        }
        // Also pull restaurants as indirect once
        if (await canCallPlaces(1)) {
          const indirect = await fetchGoogleNearby(
            options.center,
            options.radiusM,
            "restaurant",
          );
          for (const r of indirect.slice(0, 20)) {
            const types = r.types ?? ["restaurant"];
            if (types.some((t) => options.googleTypes.includes(t))) continue;
            await upsertPlaceCache({
              cityId: options.cityId,
              categorySlug: options.categorySlug,
              gridCell: gridCellKey({
                lat: r.geometry.location.lat,
                lng: r.geometry.location.lng,
              }),
              googlePlaceId: r.place_id,
              name: r.name,
              lat: r.geometry.location.lat,
              lng: r.geometry.location.lng,
              rating: r.rating ?? null,
              reviewCount: r.user_ratings_total ?? 0,
              types,
              competitionType: "indirect",
            });
          }
        }
      } catch (e) {
        warnings.push(
          `Places API error: ${e instanceof Error ? e.message : "unknown"}`,
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
