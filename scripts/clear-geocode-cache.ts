import { prisma } from "../src/lib/db";

async function main() {
  const result = await prisma.geocodeCache.deleteMany();
  console.log(`Cleared ${result.count} geocode cache rows`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
