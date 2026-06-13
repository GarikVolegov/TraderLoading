import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(new URL(`../../${path}`, import.meta.url), "utf8")) as T;
}

function readText(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

const rootPackage = readJson<{ scripts?: Record<string, string> }>("package.json");
assert.equal(
  rootPackage.scripts?.["build:railway"],
  "pnpm --filter @workspace/trader-dashboard build && pnpm --filter @workspace/api-server build",
);
assert.equal(rootPackage.scripts?.["start:railway"], "pnpm --filter @workspace/api-server start");
assert.equal(rootPackage.scripts?.["db:push"], "pnpm --filter @workspace/db push");

const apiPackage = readJson<{ scripts?: Record<string, string> }>("artifacts/api-server/package.json");
assert.equal(apiPackage.scripts?.start, "node ./dist/index.cjs");

const railway = readJson<{
  build?: { builder?: string; buildCommand?: string };
  deploy?: {
    preDeployCommand?: string;
    startCommand?: string;
    healthcheckPath?: string;
    restartPolicyType?: string;
  };
}>("railway.json");
assert.equal(railway.build?.builder, "RAILPACK");
assert.equal(railway.build?.buildCommand, "pnpm run build:railway");
assert.equal(railway.deploy?.preDeployCommand, "pnpm run db:push");
assert.equal(railway.deploy?.startCommand, "pnpm run start:railway");
assert.equal(railway.deploy?.healthcheckPath, "/api/healthz");
assert.equal(railway.deploy?.restartPolicyType, "ALWAYS");

const appSource = readText("artifacts/api-server/src/app.ts");
assert.match(appSource, /import healthRouter from "\.\/routes\/health"/);
const clerkMountIndex = appSource.indexOf("clerkMiddleware((");
assert.ok(clerkMountIndex >= 0, "Clerk middleware mount must exist in app.ts");
assert.ok(
  appSource.indexOf('app.use("/api", healthRouter);') < clerkMountIndex,
  "Railway healthcheck must be mounted before Clerk/auth middleware",
);
assert.ok(
  appSource.indexOf("serveFrontendApp(app);") < clerkMountIndex,
  "Frontend static app must be served before Clerk/auth middleware",
);
assert.match(appSource, /function serveFrontendApp/);
assert.match(appSource, /trader-dashboard/);
assert.match(appSource, /dist\/public/);
assert.match(appSource, /index\.html/);

const envExample = readText(".env.production.example");
for (const key of [
  "NODE_ENV=production",
  "API_CORS_ORIGINS=",
  "VITE_API_BASE=",
  "CLERK_PUBLISHABLE_KEY=",
  "CLERK_SECRET_KEY=",
  "VAPID_PUBLIC_KEY=",
  "VAPID_PRIVATE_KEY=",
]) {
  assert.match(envExample, new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

console.log("railway deploy checks passed");
