import type { PillarResult, ScoringWeights } from "@/lib/scoring/types";
import { clamp01 } from "@/lib/geo";

export function redistributeWeights(
  base: ScoringWeights,
  available: {
    demand: boolean;
    competition: boolean;
    accessibility: boolean;
  },
): { weights: ScoringWeights; dropped: string[] } {
  const dropped: string[] = [];
  const active: Array<keyof ScoringWeights> = [];

  (["demand", "competition", "accessibility"] as const).forEach((k) => {
    if (available[k]) active.push(k);
    else dropped.push(k);
  });

  if (active.length === 0) {
    return {
      weights: { demand: 0, competition: 0, accessibility: 0 },
      dropped,
    };
  }

  const sum = active.reduce((acc, k) => acc + base[k], 0) || 1;
  const weights: ScoringWeights = {
    demand: 0,
    competition: 0,
    accessibility: 0,
  };
  for (const k of active) {
    weights[k] = base[k] / sum;
  }
  return { weights, dropped };
}

export function combineScores(
  weights: ScoringWeights,
  pillars: {
    demand: PillarResult;
    competition: PillarResult;
    accessibility: PillarResult;
  },
): {
  total: number;
  demand: number | null;
  competition: number | null;
  accessibility: number | null;
} {
  const demand = pillars.demand.score;
  const competition = pillars.competition.score;
  const accessibility = pillars.accessibility.score;

  const total = clamp01(
    (demand ?? 0) * weights.demand +
      (competition ?? 0) * weights.competition +
      (accessibility ?? 0) * weights.accessibility,
  );

  return {
    total: Math.round(total * 1000) / 10,
    demand: demand == null ? null : Math.round(demand * 1000) / 10,
    competition:
      competition == null ? null : Math.round(competition * 1000) / 10,
    accessibility:
      accessibility == null ? null : Math.round(accessibility * 1000) / 10,
  };
}
