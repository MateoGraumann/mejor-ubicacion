import { PrismaClient } from "@prisma/client";
import { CDU_BBOX, CDU_CENSUS_TRACTS } from "../src/lib/data/cdu-seed";

const prisma = new PrismaClient();

const DEFAULT_WEIGHTS = {
  demand: 0.35,
  competition: 0.4,
  accessibility: 0.25,
};

const DEFAULT_THRESHOLDS = {
  demand: {
    density_p50: 3000,
    density_p90: 6000,
    nse_p50: 0.5,
    nse_p90: 0.75,
    age_target_share: 0.35,
  },
  competition: {
    ideal_count: 2,
    saturate_count: 8,
    direct_weight: 1.0,
    indirect_weight: 0.4,
    intensity_p50: 8,
    intensity_p90: 25,
  },
  accessibility: {
    complements_p50: 4,
    complements_p90: 12,
    primary_road_bonus: 0.2,
    corner_bonus: 0.15,
  },
};

const DEFAULT_RADII = {
  competition: 500,
  complements: 300,
};

async function main() {
  const city = await prisma.city.upsert({
    where: { slug: "concepcion-del-uruguay" },
    update: {
      name: "Concepción del Uruguay",
      province: "Entre Ríos",
      bboxMinLat: CDU_BBOX.minLat,
      bboxMaxLat: CDU_BBOX.maxLat,
      bboxMinLng: CDU_BBOX.minLng,
      bboxMaxLng: CDU_BBOX.maxLng,
    },
    create: {
      slug: "concepcion-del-uruguay",
      name: "Concepción del Uruguay",
      province: "Entre Ríos",
      bboxMinLat: CDU_BBOX.minLat,
      bboxMaxLat: CDU_BBOX.maxLat,
      bboxMinLng: CDU_BBOX.minLng,
      bboxMaxLng: CDU_BBOX.maxLng,
    },
  });

  const category = await prisma.category.upsert({
    where: { slug: "cafeteria" },
    update: {
      name: "Cafetería",
      googleTypes: ["cafe", "bakery"],
      defaultRadiusM: 500,
    },
    create: {
      slug: "cafeteria",
      name: "Cafetería",
      googleTypes: ["cafe", "bakery"],
      defaultRadiusM: 500,
    },
  });

  for (const tract of CDU_CENSUS_TRACTS) {
    await prisma.censusTract.upsert({
      where: {
        cityId_indecCode: {
          cityId: city.id,
          indecCode: tract.indecCode,
        },
      },
      update: {
        name: tract.name,
        geometrySimplified: tract.geometry,
        population: tract.population,
        areaKm2: tract.areaKm2,
        socioeconomicIndex: tract.socioeconomicIndex,
        ageBands: tract.ageBands,
      },
      create: {
        cityId: city.id,
        indecCode: tract.indecCode,
        name: tract.name,
        geometrySimplified: tract.geometry,
        population: tract.population,
        areaKm2: tract.areaKm2,
        socioeconomicIndex: tract.socioeconomicIndex,
        ageBands: tract.ageBands,
      },
    });
  }

  const existingActive = await prisma.scoringConfig.findFirst({
    where: { categoryId: category.id, isActive: true },
  });

  if (!existingActive) {
    await prisma.scoringConfig.create({
      data: {
        categoryId: category.id,
        version: 1,
        isActive: true,
        weights: DEFAULT_WEIGHTS,
        thresholds: DEFAULT_THRESHOLDS,
        radiiM: DEFAULT_RADII,
        notes: "Seed provisional weights for development (pre-calibration)",
      },
    });
  }

  console.log("Seed complete:", {
    city: city.slug,
    category: category.slug,
    tracts: CDU_CENSUS_TRACTS.length,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
