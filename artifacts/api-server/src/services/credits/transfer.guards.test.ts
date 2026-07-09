import assert from "node:assert/strict";

// wallet.ts imports @workspace/db, which requires DATABASE_URL *at import time*. These
// guard tests short-circuit before any DB query, so we point at a dummy URL (never
// actually connected to) and dynamic-import wallet.ts AFTER setting it — so the test
// runs in the suite regardless of whether the runner injects database env. The atomic
// debit+credit path itself is integration-tested with a running Postgres (manual / CI).
process.env.DATABASE_URL ||= "postgres://tests:tests@127.0.0.1:1/none";
const { transferCredits } = await import("./wallet.js");

// amount must be a positive integer
await assert.rejects(() => transferCredits({ fromUserId: "a", toUserId: "b", amount: 0, reason: "channel_sale" }));
await assert.rejects(() => transferCredits({ fromUserId: "a", toUserId: "b", amount: -5, reason: "channel_sale" }));
await assert.rejects(() => transferCredits({ fromUserId: "a", toUserId: "b", amount: 1.5, reason: "channel_sale" }));

// self-transfer is a no-op: resolves without touching the DB
await transferCredits({ fromUserId: "a", toUserId: "a", amount: 10, reason: "channel_sale" });

console.log("credit transfer guard checks passed");
