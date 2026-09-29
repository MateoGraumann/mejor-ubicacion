/**
 * Validation harness: evaluates 12 sample addresses in CdU.
 * Run inside Docker: docker compose exec app npm run validate
 */
import { evaluateAddress } from "../src/lib/scoring/evaluate";

const ADDRESSES = [
  "Av. San Martin 100, Concepcion del Uruguay",
  "Av. San Martin 800, Concepcion del Uruguay",
  "Plaza Ramirez, Concepcion del Uruguay",
  "Costanera, Concepcion del Uruguay",
  "Hospital zona Norte, Concepcion del Uruguay",
  "Barrio Sur, Concepcion del Uruguay",
  "Av. Roca 200, Concepcion del Uruguay",
  "Calle Galarza 500, Concepcion del Uruguay",
  "Puerto, Concepcion del Uruguay",
  "Terminal de omnibus, Concepcion del Uruguay",
  "Universidad, Concepcion del Uruguay",
  "Barrio Oeste, Concepcion del Uruguay",
];

async function main() {
  const rows: Array<{
    address: string;
    score: number;
    demand: number | null;
    competition: number | null;
    accessibility: number | null;
    version: number;
    warnings: number;
  }> = [];

  for (const address of ADDRESSES) {
    try {
      const r = await evaluateAddress(address);
      rows.push({
        address,
        score: r.scoreTotal,
        demand: r.pillars.demand,
        competition: r.pillars.competition,
        accessibility: r.pillars.accessibility,
        version: r.scoringConfigVersion,
        warnings: r.warnings.length,
      });
      console.log(
        `OK  ${r.scoreTotal.toFixed(1).padStart(5)} | ${address}`,
      );
    } catch (e) {
      console.error(
        `ERR ${address}: ${e instanceof Error ? e.message : e}`,
      );
    }
  }

  console.log("\n--- Summary ---");
  console.table(rows);

  const scores = rows.map((r) => r.score);
  if (scores.length > 0) {
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    console.log({
      count: scores.length,
      min: min.toFixed(1),
      max: max.toFixed(1),
      avg: avg.toFixed(1),
      spread: (max - min).toFixed(1),
    });
    if (max - min < 5) {
      console.warn(
        "WARNING: scores barely discriminate — review calibration thresholds",
      );
    } else {
      console.log("Score spread looks usable for MVP validation.");
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
