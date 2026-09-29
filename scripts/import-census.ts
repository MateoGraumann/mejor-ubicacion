/**
 * Re-import census tracts for CdU from data/cdu/census-tracts.json
 * or fall back to built-in seed data.
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";
import { CDU_CENSUS_TRACTS } from "../src/lib/data/cdu-seed";

const prisma = new PrismaClient();

async function main() {
  const city = await prisma.city.findUniqueOrThrow({
    where: { slug: "concepcion-del-uruguay" },
  });

  const filePath = join(process.cwd(), "data", "cdu", "census-tracts.json");
  let tracts = CDU_CENSUS_TRACTS;

  if (existsSync(filePath)) {
    tracts = JSON.parse(readFileSync(filePath, "utf8"));
    console.log(`Loaded ${tracts.length} tracts from ${filePath}`);
  } else {
    console.log("No data/cdu/census-tracts.json — using built-in seed tracts");
  }

  for (const tract of tracts) {
    await prisma.censusTract.upsert({
      where: {
        cityId_indecCode: { cityId: city.id, indecCode: tract.indecCode },
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

  console.log(`Imported ${tracts.length} census tracts for ${city.slug}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
