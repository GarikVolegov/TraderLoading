import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(process.cwd(), "..");

const productionExample = fs.readFileSync(path.join(repoRoot, ".env.production.example"), "utf8");
assert.match(productionExample, /^VAPID_PUBLIC_KEY=/m);
assert.match(productionExample, /^VAPID_PRIVATE_KEY=/m);
assert.match(productionExample, /^VAPID_EMAIL=/m);

const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8")) as {
  scripts?: Record<string, string>;
};
assert.equal(packageJson.scripts?.["push:vapid"], "pnpm --filter @workspace/api-server exec web-push generate-vapid-keys");

console.log("vapid env checks passed");
