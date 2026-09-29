export type ScoringWeights = {
  demand: number;
  competition: number;
  accessibility: number;
};

export type ScoringThresholds = {
  demand: {
    density_p50: number;
    density_p90: number;
    nse_p50: number;
    nse_p90: number;
    age_target_share: number;
  };
  competition: {
    ideal_count: number;
    saturate_count: number;
    direct_weight: number;
    indirect_weight: number;
    intensity_p50: number;
    intensity_p90: number;
  };
  accessibility: {
    complements_p50: number;
    complements_p90: number;
    primary_road_bonus: number;
    corner_bonus: number;
  };
};

export type ScoringRadii = {
  competition: number;
  complements: number;
};

export type PillarResult = {
  score: number | null;
  available: boolean;
  factors: Array<{
    key: string;
    value: number;
    contribution: number;
    note: string;
  }>;
};

export type CompetitorPlace = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  rating: number | null;
  reviewCount: number;
  competitionType: "direct" | "indirect";
  distanceM: number;
};

export type CensusSnapshot = {
  indecCode: string;
  name: string | null;
  population: number;
  areaKm2: number;
  density: number;
  socioeconomicIndex: number;
  age20_45: number;
};

export type AccessibilitySnapshot = {
  roadClass: "primary" | "secondary" | "residential" | "unknown";
  isCorner: boolean;
  complementsCount: number;
  complements: Array<{ name: string; kind: string; distanceM: number }>;
};
