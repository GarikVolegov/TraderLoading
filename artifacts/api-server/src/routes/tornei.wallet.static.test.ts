import assert from "node:assert/strict";
import fs from "node:fs";

// GET /tornei/wallet must advertise whether the on-chain mint is configured
// (TORNEI_MINT_*): without it the FE shows a claim CTA whose POST always 503s
// (minting_unavailable) — a feature that promises an NFT it can never mint.
// getMintProvider()'s env matrix is unit-tested in services/tornei/mint/provider.test.ts;
// this check pins the route wiring.
const route = fs.readFileSync("src/routes/tornei.ts", "utf8");

const walletGet = route.slice(
  route.indexOf('router.get("/tornei/wallet"'),
  route.indexOf('router.put("/tornei/wallet"'),
);
assert.ok(walletGet.length > 0, "GET /tornei/wallet route must exist");
assert.match(
  walletGet,
  /mintEnabled:\s*getMintProvider\(\)\s*!==\s*null/,
  "GET /tornei/wallet must expose mintEnabled from the mint provider config",
);

// The claim route keeps its explicit degraded answer when the provider is absent.
assert.match(route, /minting_unavailable/, "claim must 503 with minting_unavailable when unconfigured");

console.log("tornei wallet static checks passed");
