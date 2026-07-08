import assert from "node:assert/strict";
import { transferCredits } from "./wallet.js";

// transferCredits input guards that short-circuit before any DB access (so they run
// without a live database). The atomic debit+credit path itself is integration-tested
// with a running Postgres (manual / CI).

// amount must be a positive integer
await assert.rejects(() => transferCredits({ fromUserId: "a", toUserId: "b", amount: 0, reason: "channel_sale" }));
await assert.rejects(() => transferCredits({ fromUserId: "a", toUserId: "b", amount: -5, reason: "channel_sale" }));
await assert.rejects(() => transferCredits({ fromUserId: "a", toUserId: "b", amount: 1.5, reason: "channel_sale" }));

// self-transfer is a no-op: resolves without touching the DB
await transferCredits({ fromUserId: "a", toUserId: "a", amount: 10, reason: "channel_sale" });

console.log("credit transfer guard checks passed");
