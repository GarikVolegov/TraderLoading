import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgres://user:pass@127.0.0.1:5432/test";

const routerModule = await import("./financial-profile.js");
assert.ok(routerModule.default, "router export exists");

console.log("financial-profile route sanity test passed");
