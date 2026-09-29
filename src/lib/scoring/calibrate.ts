import { prisma } from "@/lib/db";
import { percentile, sampleVariance, type LatLng } from "@/lib/geo";
import { findCompetitors } from "@/lib/providers/places";
import { findCensusTract } from "@/lib/providers/census";
import { getAccessibility } from "@/lib/providers/osm";
import type {
  ScoringRadii,
  ScoringThresholds,
  ScoringWeights,
} from "@/lib/scoring/types";

const WEIGHT_MIN = 0.15;
const WEIGHT_MAX = 0.5;

/**
 * Map raw variance shares onto weights that sum to 1
 * with each pillar in [0.15, 0.50].
 */
function normalizeWeights(raw: ScoringWeights): ScoringWeights {
  const keys = ["demand", "competition", "accessibility"] as const;
  const w: ScoringWeights = {
    demand: WEIGHT_MIN,
    competition: WEIGHT_MIN,
    accessibility: WEIGHT_MIN,
  };

  let remaining = 1 - WEIGHT_MIN * keys.length;
  const room: ScoringWeights = {
    demand: WEIGHT_MAX - WEIGHT_MIN,
    competition: WEIGHT_MAX - WEIGHT_MIN,
    accessibility: WEIGHT_MAX - WEIGHT_MIN,
  };

  for (let iter = 0; iter < 8 && remaining > 1e-9; iter++) {
    const active = keys.filter((k) => room[k] > 1e-9);
    if (active.length === 0) break;

    const shareSum =
      active.reduce((acc, k) => acc + Math.max(raw[k], 1e-9), 0) || 1;
    let given = 0;

    for (const k of active) {
      const want = remaining * (Math.max(raw[k], 1e-9) / shareSum);
      const add = Math.min(want, room[k]);
      w[k] += add;
      room[k] -= add;
      given += add;
    }

    if (given < 1e-9) break;
    remaining -= given;
  }

  // Absorb leftover into any pillar with room (prefer competition)
  if (remaining > 1e-9) {
    for (const k of ["competition", "accessibility", "demand"] as const) {
      if (room[k] <= 0) continue;
      const add = Math.min(remaining, room[k]);
      w[k] += add;
      remaining -= add;
      if (remaining <= 1e-9) break;
    }
  }

  return w;
}

function sampleGrid(bbox: {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}, steps = 4): LatLng[] {
  const points: LatLng[] = [];
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < steps; j++) {
      const lat =
        bbox.minLat + ((i + 0.5) / steps) * (bbox.maxLat - bbox.minLat);
      const lng =
        bbox.minLng + ((j + 0.5) / steps) * (bbox.maxLng - bbox.minLng);
      points.push({ lat, lng });
    }
  }
  return points;
}

export async function calibrateCategory(categorySlug = "cafeteria") {
  const city = await prisma.city.findUniqueOrThrow({
    where: { slug: "concepcion-del-uruguay" },
  });
  const category = await prisma.category.findUniqueOrThrow({
    where: { slug: categorySlug },
  });

  const radii: ScoringRadii = {
    competition: category.defaultRadiusM,
    complements: 300,
  };

  const points = sampleGrid({
    minLat: city.bboxMinLat,
    maxLat: city.bboxMaxLat,
    minLng: city.bboxMinLng,
    maxLng: city.bboxMaxLng,
  });

  const densities: number[] = [];
  const nses: number[] = [];
  const ages: number[] = [];
  const directCounts: number[] = [];
  const intensities: number[] = [];
  const complements: number[] = [];

  for (const point of points) {
    const census = await findCensusTract(city.id, point);
    if (census) {
      densities.push(census.density);
      nses.push(census.socioeconomicIndex);
      ages.push(census.age20_45);
    }

    const places = await findCompetitors({
      cityId: city.id,
      categorySlug: category.slug,
      googleTypes: category.googleTypes,
      center: point,
      radiusM: radii.competition,
    });
    const direct = places.places.filter((p) => p.competitionType === "direct");
    directCounts.push(direct.length);
    const avgInt =
      places.places.length === 0
        ? 0
        : places.places.reduce(
            (acc, p) =>
              acc + (p.rating ?? 3.5) * Math.log1p(p.reviewCount),
            0,
          ) / places.places.length;
    intensities.push(avgInt);

    const osm = await getAccessibility(city.id, point, radii.complements);
    complements.push(osm.snapshot?.complementsCount ?? 0);
  }

  const sort = (arr: number[]) => [...arr].sort((a, b) => a - b);

  const thresholds: ScoringThresholds = {
    demand: {
      density_p50: percentile(sort(densities), 0.5) || 40,
      density_p90: percentile(sort(densities), 0.9) || 120,
      nse_p50: percentile(sort(nses), 0.5) || 0.5,
      nse_p90: percentile(sort(nses), 0.9) || 0.75,
      age_target_share: percentile(sort(ages), 0.5) || 0.35,
    },
    competition: {
      ideal_count: Math.max(1, Math.round(percentile(sort(directCounts), 0.35) || 2)),
      saturate_count: Math.max(
        4,
        Math.round(percentile(sort(directCounts), 0.9) || 8),
      ),
      direct_weight: 1,
      indirect_weight: 0.4,
      intensity_p50: percentile(sort(intensities), 0.5) || 8,
      intensity_p90: percentile(sort(intensities), 0.9) || 25,
    },
    accessibility: {
      complements_p50: percentile(sort(complements), 0.5) || 4,
      complements_p90: percentile(sort(complements), 0.9) || 12,
      primary_road_bonus: 0.2,
      corner_bonus: 0.15,
    },
  };

  // Weights from useful variance (discrimination)
  const varDemand =
    sampleVariance(densities) + sampleVariance(nses) + sampleVariance(ages);
  const varCompetition =
    sampleVariance(directCounts) + sampleVariance(intensities);
  const varAccessibility = sampleVariance(complements);

  const rawSum = varDemand + varCompetition + varAccessibility || 1;
  const weights = normalizeWeights({
    demand: varDemand / rawSum,
    competition: varCompetition / rawSum,
    accessibility: varAccessibility / rawSum,
  });

  await prisma.scoringConfig.updateMany({
    where: { categoryId: category.id, isActive: true },
    data: { isActive: false },
  });

  const latest = await prisma.scoringConfig.findFirst({
    where: { categoryId: category.id },
    orderBy: { version: "desc" },
  });

  const config = await prisma.scoringConfig.create({
    data: {
      categoryId: category.id,
      version: (latest?.version ?? 0) + 1,
      isActive: true,
      weights,
      thresholds,
      radiiM: radii,
      notes: `Calibrated from ${points.length} sample points in ${city.slug}`,
    },
  });

  return {
    configId: config.id,
    version: config.version,
    weights,
    thresholds,
    radii,
    samples: points.length,
  };
}
