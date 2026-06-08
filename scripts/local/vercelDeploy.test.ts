import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(new URL(`../../${path}`, import.meta.url), "utf8")) as T;
}

function readText(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

const vercel = readJson<{
  version?: number;
  installCommand?: string;
  buildCommand?: string;
  outputDirectory?: string;
  functions?: Record<string, { runtime?: string; maxDuration?: number }>;
  rewrites?: Array<{ source?: string; destination?: string }>;
}>("vercel.json");

assert.equal(vercel.version, 2);
assert.equal(vercel.installCommand, "pnpm install --frozen-lockfile");
assert.equal(
  vercel.buildCommand,
  "pnpm --filter ./scripts exec tsx local/vercelEnvGuard.ts && pnpm run codegen && pnpm --filter @workspace/api-server build && pnpm --filter @workspace/trader-dashboard build",
);
assert.equal(vercel.outputDirectory, "artifacts/trader-dashboard/dist/public");
assert.equal(vercel.functions?.["api/index.js"]?.runtime, undefined);
assert.equal(vercel.functions?.["api/index.js"]?.maxDuration, 60);
assert.deepEqual(vercel.rewrites, [
  { source: "/api/(.*)", destination: "/api" },
  { source: "/((?!api/).*)", destination: "/index.html" },
]);

assert.ok(existsSync(new URL("../../api/index.js", import.meta.url)));
const functionSource = readText("api/index.js");
assert.match(functionSource, /process\.env\.VERCEL/);
assert.match(functionSource, /process\.env\.TRUST_PROXY \?\?= "1"/);
assert.match(functionSource, /process\.chdir\(runtimeDir\)/);
assert.match(functionSource, /require\("\.\.\/artifacts\/api-server\/dist\/vercel\.cjs"\)/);
assert.match(functionSource, /module\.exports/);

const apiBuildSource = readText("artifacts/api-server/build.ts");
assert.match(apiBuildSource, /src\/app\.ts/);
assert.match(apiBuildSource, /vercel\.cjs/);
assert.match(apiBuildSource, /"openid-client"/);
assert.match(apiBuildSource, /"@clerk\/express"/);
assert.match(apiBuildSource, /"@clerk\/shared"/);

console.log("vercel deploy checks passed");
