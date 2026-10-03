import { prisma } from "../src/lib/db";

async function main() {
  const places = await prisma.placeCache.deleteMany();
  const osm = await prisma.osmCache.deleteMany();
  console.log(
    `Cleared ${places.count} place cache rows and ${osm.count} OSM cache rows`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
