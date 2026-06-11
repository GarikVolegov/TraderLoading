const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

if (process.env.VERCEL) {
  process.env.TRUST_PROXY ??= "1";
  const runtimeDir = path.join(os.tmpdir(), "traderloadings");
  fs.mkdirSync(runtimeDir, { recursive: true });
  process.chdir(runtimeDir);
}

const serverless = require("../artifacts/api-server/dist/vercel.cjs");

module.exports = serverless.default ?? serverless;
