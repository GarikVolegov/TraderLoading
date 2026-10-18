// Re-import unverified calendar ranges, including months that already contain
// partial data. Row counts/min/max alone never certify a complete import.
import { closeDbPool } from "@workspace/db";
import { SYMBOL_ID } from "../candleRegistry.js";
import { isRangeVerified } from "./candleStore.js";
import { seedSymbol } from "./seed.js";
import { sourceForSymbol } from "./sources.js";

async function main(): Promise<void> {
  const years = Number(process.argv[2] ?? 5);
  if (!Number.isInteger(years) || years < 1 || years > 30)
    throw new Error("years must be an integer between 1 and 30");
  const now = Math.floor(Date.now() / 1000);
  const start = new Date(now * 1000);
  start.setUTCFullYear(start.getUTCFullYear() - years);
  const first = Math.floor(start.getTime() / 1000);
  let failed = 0;
  for (const symbol of Object.keys(SYMBOL_ID).filter((s) => sourceForSymbol(s))) {
    let from = first;
    while (from < now) {
      const date = new Date(from * 1000);
      const to = Math.min(now, Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1) / 1000);
      if (!(await isRangeVerified(symbol, from, to))) {
        try {
          const result = await seedSymbol(symbol, from, to);
          console.log(
            `[heal] ${symbol} ${date.toISOString().slice(0, 10)}: ${result.written} bars`,
          );
        } catch (error) {
          failed++;
          console.warn(
            `[heal] ${symbol} FAILED: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 4000));
      }
      from = to;
    }
  }
  await closeDbPool();
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
