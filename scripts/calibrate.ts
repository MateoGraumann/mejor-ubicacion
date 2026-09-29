import { calibrateCategory } from "../src/lib/scoring/calibrate";

async function main() {
  const result = await calibrateCategory("cafeteria");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
