import { clamp01 } from "@/lib/geo";
import type {
  AccessibilitySnapshot,
  CensusSnapshot,
  CompetitorPlace,
  PillarResult,
  ScoringThresholds,
} from "@/lib/scoring/types";

function scaleBetween(value: number, p50: number, p90: number): number {
  if (p90 <= p50) return clamp01(value >= p50 ? 1 : value / (p50 || 1));
  if (value <= p50) return clamp01((value / p50) * 0.5);
  return clamp01(0.5 + 0.5 * ((value - p50) / (p90 - p50)));
}

export function scoreDemand(
  census: CensusSnapshot | null,
  thresholds: ScoringThresholds["demand"],
): PillarResult {
  if (!census) {
    return { score: null, available: false, factors: [] };
  }

  const densityScore = scaleBetween(
    census.density,
    thresholds.density_p50,
    thresholds.density_p90,
  );
  const nseScore = scaleBetween(
    census.socioeconomicIndex,
    thresholds.nse_p50,
    thresholds.nse_p90,
  );
  const ageScore = clamp01(
    census.age20_45 / Math.max(thresholds.age_target_share, 0.01),
  );

  const score = clamp01(0.45 * densityScore + 0.35 * nseScore + 0.2 * ageScore);

  return {
    score,
    available: true,
    factors: [
      {
        key: "density",
        value: census.density,
        contribution: densityScore,
        note: `Zona ${census.name ?? census.indecCode}: ~${Math.round(census.density)} hab/km²`,
      },
      {
        key: "nse",
        value: census.socioeconomicIndex,
        contribution: nseScore,
        note: `Nivel socioeconómico relativo ${(census.socioeconomicIndex * 100).toFixed(0)}/100`,
      },
      {
        key: "age_20_45",
        value: census.age20_45,
        contribution: ageScore,
        note: `${Math.round(census.age20_45 * 100)}% de la población tiene entre 20 y 45 años (público habitual de cafetería)`,
      },
    ],
  };
}

export function scoreCompetition(
  places: CompetitorPlace[],
  thresholds: ScoringThresholds["competition"],
): PillarResult {
  if (!places) {
    return { score: null, available: false, factors: [] };
  }

  const direct = places.filter((p) => p.competitionType === "direct");
  const indirect = places.filter((p) => p.competitionType === "indirect");

  const weightedCount =
    direct.length * thresholds.direct_weight +
    indirect.length * thresholds.indirect_weight;

  // Inverted: ideal around ideal_count, bad at saturate_count
  let countScore = 1;
  if (weightedCount <= thresholds.ideal_count) {
    countScore = 0.7 + 0.3 * (weightedCount / Math.max(thresholds.ideal_count, 1));
  } else {
    const span = Math.max(
      thresholds.saturate_count - thresholds.ideal_count,
      1,
    );
    countScore = clamp01(
      1 - (weightedCount - thresholds.ideal_count) / span,
    );
  }

  const intensities = places.map(
    (p) => (p.rating ?? 3.5) * Math.log1p(p.reviewCount),
  );
  const avgIntensity =
    intensities.length > 0
      ? intensities.reduce((a, b) => a + b, 0) / intensities.length
      : 0;
  const intensityPressure = scaleBetween(
    avgIntensity,
    thresholds.intensity_p50,
    thresholds.intensity_p90,
  );
  const intensityScore = clamp01(1 - intensityPressure * 0.7);

  const score = clamp01(0.65 * countScore + 0.35 * intensityScore);

  return {
    score,
    available: true,
    factors: [
      {
        key: "direct_count",
        value: direct.length,
        contribution: countScore,
        note: `${direct.length} cafeterías directas en el radio`,
      },
      {
        key: "indirect_count",
        value: indirect.length,
        contribution: countScore,
        note: `${indirect.length} competidores indirectos (resto/bar)`,
      },
      {
        key: "intensity",
        value: avgIntensity,
        contribution: intensityScore,
        note: `Intensidad media de reseñas ${avgIntensity.toFixed(1)}`,
      },
    ],
  };
}

export function scoreAccessibility(
  snapshot: AccessibilitySnapshot | null,
  thresholds: ScoringThresholds["accessibility"],
): PillarResult {
  if (!snapshot) {
    return { score: null, available: false, factors: [] };
  }

  const roadScore =
    snapshot.roadClass === "primary"
      ? 1
      : snapshot.roadClass === "secondary"
        ? 0.75
        : snapshot.roadClass === "residential"
          ? 0.45
          : 0.3;

  const complementsScore = scaleBetween(
    snapshot.complementsCount,
    thresholds.complements_p50,
    thresholds.complements_p90,
  );

  let score = clamp01(0.45 * roadScore + 0.4 * complementsScore);
  if (snapshot.roadClass === "primary") {
    score = clamp01(score + thresholds.primary_road_bonus * 0.5);
  }
  if (snapshot.isCorner) {
    score = clamp01(score + thresholds.corner_bonus);
  }

  return {
    score,
    available: true,
    factors: [
      {
        key: "road_class",
        value: roadScore,
        contribution: roadScore,
        note: `Vía tipo ${snapshot.roadClass}`,
      },
      {
        key: "complements",
        value: snapshot.complementsCount,
        contribution: complementsScore,
        note: `${snapshot.complementsCount} POIs complementarios cercanos`,
      },
      {
        key: "corner",
        value: snapshot.isCorner ? 1 : 0,
        contribution: snapshot.isCorner ? thresholds.corner_bonus : 0,
        note: snapshot.isCorner
          ? "Ubicación en esquina / cruce activo"
          : "No parece esquina de alto flujo",
      },
    ],
  };
}
