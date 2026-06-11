import assert from "node:assert/strict";
import path from "node:path";
import { getManualChunkName, packageNameFromModuleId } from "../../artifacts/trader-dashboard/vite.config.js";

const pnpmModule = (...parts: string[]) =>
  path.join(
    "C:",
    "repo",
    "node_modules",
    ".pnpm",
    "pkg@1.0.0",
    "node_modules",
    ...parts,
    "dist",
    "index.mjs",
  );

assert.equal(packageNameFromModuleId(pnpmModule("react")), "react");
assert.equal(packageNameFromModuleId(pnpmModule("@radix-ui", "react-slot")), "@radix-ui/react-slot");

assert.equal(getManualChunkName(pnpmModule("react")), "vendor-react");
assert.equal(getManualChunkName(pnpmModule("react-dom")), "vendor-react");
assert.equal(getManualChunkName(pnpmModule("@radix-ui", "react-slot")), "vendor-ui");
assert.equal(getManualChunkName(pnpmModule("@tanstack", "react-query")), undefined);
assert.equal(getManualChunkName(pnpmModule("lucide-react")), "vendor-ui");
assert.equal(getManualChunkName(pnpmModule("wouter")), "vendor-router");

console.log("trader dashboard vite chunk checks passed");
