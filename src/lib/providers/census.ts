import { prisma } from "@/lib/db";
import { pointInPolygon, type LatLng } from "@/lib/geo";
import type { CensusSnapshot } from "@/lib/scoring/types";

type AgeBands = { "0_19"?: number; "20_45"?: number; "46_plus"?: number };

export async function findCensusTract(
  cityId: string,
  point: LatLng,
): Promise<CensusSnapshot | null> {
  const tracts = await prisma.censusTract.findMany({ where: { cityId } });

  for (const tract of tracts) {
    const geometry = tract.geometrySimplified as {
      type: string;
      coordinates: number[][][];
    };
    const ring = geometry?.coordinates?.[0];
    if (!ring) continue;
    if (!pointInPolygon(point, ring)) continue;

    const ageBands = tract.ageBands as AgeBands;
    const density =
      tract.areaKm2 > 0 ? tract.population / tract.areaKm2 : tract.population;

    return {
      indecCode: tract.indecCode,
      name: tract.name,
      population: tract.population,
      areaKm2: tract.areaKm2,
      density,
      socioeconomicIndex: tract.socioeconomicIndex,
      age20_45: ageBands["20_45"] ?? 0.35,
    };
  }

  // Fallback: nearest tract centroid
  let best: (typeof tracts)[number] | null = null;
  let bestDist = Infinity;
  for (const tract of tracts) {
    const geometry = tract.geometrySimplified as {
      coordinates: number[][][];
    };
    const ring = geometry?.coordinates?.[0];
    if (!ring?.length) continue;
    const lats = ring.map((c) => c[1]);
    const lngs = ring.map((c) => c[0]);
    const cLat = lats.reduce((a, b) => a + b, 0) / lats.length;
    const cLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;
    const d = (cLat - point.lat) ** 2 + (cLng - point.lng) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = tract;
    }
  }

  if (!best) return null;

  const ageBands = best.ageBands as AgeBands;
  const density =
    best.areaKm2 > 0 ? best.population / best.areaKm2 : best.population;

  return {
    indecCode: best.indecCode,
    name: best.name,
    population: best.population,
    areaKm2: best.areaKm2,
    density,
    socioeconomicIndex: best.socioeconomicIndex,
    age20_45: ageBands["20_45"] ?? 0.35,
  };
}
