import { prisma } from "@/lib/db";
import { isInsideBBox } from "@/lib/geo";
import { geocodeAddress } from "@/lib/providers/geocoding";
import { findCompetitors } from "@/lib/providers/places";
import { findCensusTract } from "@/lib/providers/census";
import { getAccessibility } from "@/lib/providers/osm";
import {
  combineScores,
  redistributeWeights,
} from "@/lib/scoring/engine";
import {
  scoreAccessibility,
  scoreCompetition,
  scoreDemand,
} from "@/lib/scoring/pillars";
import type {
  ScoringRadii,
  ScoringThresholds,
  ScoringWeights,
} from "@/lib/scoring/types";

export type EvaluateCompetitor = {
  name: string;
  competitionType: "direct" | "indirect";
  distanceM: number;
  rating: number | null;
  reviewCount: number;
};

export type EvaluateResponse = {
  evaluationId: string;
  address: string;
  formattedAddress: string | null;
  lat: number;
  lng: number;
  scoreTotal: number;
  pillars: {
    demand: number | null;
    competition: number | null;
    accessibility: number | null;
  };
  weights: ScoringWeights;
  factors: Array<{
    pillar: string;
    key: string;
    value: number;
    contribution: number;
    note: string;
  }>;
  competitors: EvaluateCompetitor[];
  competitionRadiusM: number;
  warnings: string[];
  scoringConfigVersion: number;
};

export async function evaluateAddress(
  addressInput: string,
  categorySlug = "cafeteria",
): Promise<EvaluateResponse> {
  const city = await prisma.city.findUniqueOrThrow({
    where: { slug: "concepcion-del-uruguay" },
  });
  const category = await prisma.category.findUniqueOrThrow({
    where: { slug: categorySlug },
  });
  const config = await prisma.scoringConfig.findFirst({
    where: { categoryId: category.id, isActive: true },
    orderBy: { version: "desc" },
  });

  if (!config) {
    throw new Error("No hay ScoringConfig activa. Corré la calibración.");
  }

  const weightsBase = config.weights as ScoringWeights;
  const thresholds = config.thresholds as ScoringThresholds;
  const radii = config.radiiM as ScoringRadii;

  const warnings: string[] = [];
  const geo = await geocodeAddress(addressInput);
  const point = { lat: geo.lat, lng: geo.lng };

  if (geo.formattedAddress.includes("aprox. calle")) {
    warnings.push(
      "La altura exacta no está en el mapa; se usó la ubicación aproximada de la calle.",
    );
  }

  if (
    !isInsideBBox(point, {
      minLat: city.bboxMinLat,
      maxLat: city.bboxMaxLat,
      minLng: city.bboxMinLng,
      maxLng: city.bboxMaxLng,
    })
  ) {
    throw new Error(
      "La dirección está fuera de Concepción del Uruguay (MVP limitado a esta ciudad).",
    );
  }

  const census = await findCensusTract(city.id, point);
  if (!census) warnings.push("Sin radio censal para el punto; demanda omitida.");

  const competitionRadiusM = radii.competition ?? category.defaultRadiusM;
  const placesResult = await findCompetitors({
    cityId: city.id,
    categorySlug: category.slug,
    googleTypes: category.googleTypes,
    center: point,
    radiusM: competitionRadiusM,
  });
  warnings.push(...placesResult.warnings);

  const competitors: EvaluateCompetitor[] = placesResult.places.map((p) => ({
    name: p.name,
    competitionType: p.competitionType,
    distanceM: Math.round(p.distanceM),
    rating: p.rating,
    reviewCount: p.reviewCount,
  }));

  const osmResult = await getAccessibility(
    city.id,
    point,
    radii.complements ?? 300,
  );
  warnings.push(...osmResult.warnings);

  const demand = scoreDemand(census, thresholds.demand);
  const competition = scoreCompetition(placesResult.places, thresholds.competition);
  const accessibility = scoreAccessibility(
    osmResult.snapshot,
    thresholds.accessibility,
  );

  const { weights, dropped } = redistributeWeights(weightsBase, {
    demand: demand.available,
    competition: competition.available,
    accessibility: accessibility.available,
  });

  for (const d of dropped) {
    warnings.push(`Pilar ${d} sin datos; peso redistribuido.`);
  }

  const combined = combineScores(weights, {
    demand,
    competition,
    accessibility,
  });

  const factors = [
    ...demand.factors.map((f) => ({ pillar: "demand", ...f })),
    ...competition.factors.map((f) => ({ pillar: "competition", ...f })),
    ...accessibility.factors.map((f) => ({ pillar: "accessibility", ...f })),
  ];

  const evaluation = await prisma.evaluation.create({
    data: {
      categoryId: category.id,
      scoringConfigId: config.id,
      addressInput,
      formattedAddress: geo.formattedAddress,
      lat: point.lat,
      lng: point.lng,
      scoreTotal: combined.total,
      scoreDemand: combined.demand,
      scoreCompetition: combined.competition,
      scoreAccessibility: combined.accessibility,
      warnings,
      rawInputs: {
        geocodeFromCache: geo.fromCache,
        geocodeProvider: geo.provider,
        census,
        placesCount: placesResult.places.length,
        competitors,
        competitionRadiusM,
        placesFromCacheOnly: placesResult.fromCacheOnly,
        budgetExhausted: placesResult.budgetExhausted,
        accessibility: osmResult.snapshot,
        weightsApplied: weights,
        weightsBase,
      },
      factors: {
        create: factors,
      },
    },
  });

  return {
    evaluationId: evaluation.id,
    address: addressInput,
    formattedAddress: geo.formattedAddress,
    lat: point.lat,
    lng: point.lng,
    scoreTotal: combined.total,
    pillars: {
      demand: combined.demand,
      competition: combined.competition,
      accessibility: combined.accessibility,
    },
    weights,
    factors,
    competitors,
    competitionRadiusM,
    warnings,
    scoringConfigVersion: config.version,
  };
}
