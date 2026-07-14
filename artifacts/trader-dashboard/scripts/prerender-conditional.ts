import { spawnSync } from "node:child_process";

if (process.env.SKIP_PRERENDER === "1") {
  console.log("prerender: SKIP_PRERENDER=1, skipping prerender");
  process.exit(0);
}

const result = spawnSync("pnpm", ["run", "prerender"], { stdio: "inherit" });
if (result.error) {
  console.error(result.error);
  process.exit(1);
}
process.exit(result.status ?? 1);
