// Runs every usability-sweep driver sequentially (shared users/app: parallel runs
// would trample each other's state) and aggregates their findings.json outputs.
// Usage: node scripts/verify-usability/run-all.mjs [only-area ...]
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ORDER = [
  "onboarding", // must run before "pro": it completes user B's onboarding
  "pro",
  "community",
  "tornei",
  "missions",
  "journal",
  "backtest",
  "mobile",
  "misc",
  "admin",
];

const only = process.argv.slice(2);
const areas = only.length ? ORDER.filter((a) => only.includes(a)) : ORDER;

const runId = `sweep-${Date.now()}`;
const results = [];
for (const area of areas) {
  const script = fileURLToPath(new URL(`drive-${area}.mjs`, import.meta.url));
  if (!existsSync(script)) {
    console.log(`⏭  drive-${area}.mjs missing, skipped`);
    continue;
  }
  console.log(`\n━━━ ${area} ━━━`);
  const findingsPath = fileURLToPath(new URL(`../../artifacts.local/verify-usability/${area}/findings.json`, import.meta.url));
  rmSync(findingsPath,{force:true});
  const r = spawnSync(process.execPath, [script], { stdio: "inherit", env: {...process.env,VERIFY_RUN_ID:runId} });
  let findings = [];
  try {
    const payload = JSON.parse(readFileSync(findingsPath, "utf8"));
    if(payload.runId!==runId)throw new Error("Stale report");
    findings = payload.findings ?? [];
  } catch {
    findings = [{kind:"runner-error",detail:"No report from this execution"}];
  }
  results.push({ area, exit: r.status === 0 && !findings.some(f=>f.kind==="runner-error") ? 0 : 1, findings });
}

console.log("\n━━━ SWEEP SUMMARY ━━━");
let total = 0;
for (const { area, exit, findings } of results) {
  total += findings.length;
  console.log(`${exit === 0 ? "✅" : "❌"} ${area}: exit=${exit} findings=${findings.length}`);
}
console.log(`TOTAL findings: ${total}`);
process.exitCode = results.some((r) => r.exit !== 0) ? 1 : 0;
