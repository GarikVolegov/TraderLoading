import assert from "node:assert/strict";
import { createFxBlueSetupIntentStore } from "./fxBlueSetupIntentStore.js";

const store = createFxBlueSetupIntentStore({
  now: () => new Date("2026-06-08T10:00:00.000Z"),
  id: () => "fxblue-intent-1",
});

const intent = await store.createIntent({
  platform: "MT5",
  brokerName: "FP Trading",
  server: "FPTrading-Live",
  accountNumber: "123456",
  environment: "live",
  investorPassword: "read-only-secret",
});

assert.equal(intent.id, "fxblue-intent-1");
assert.equal(intent.status, "created");
assert.equal(intent.accountNumber, "123456");
assert.equal(intent.server, "FPTrading-Live");
assert.equal("investorPassword" in (intent as object), false);
assert.equal(intent.displayStatus, "Apri FX Blue Account Sync e avvia la raccolta in sola lettura.");

const verified = await store.updateIntent(intent.id, {
  status: "profile_verified",
  fxBlueProfileRef: "trader-one",
  displayStatus: "Profilo FX Blue verificato.",
});
assert.equal(verified.status, "profile_verified");
assert.equal(verified.fxBlueProfileRef, "trader-one");

const fetched = await store.getIntent(intent.id);
assert.equal(fetched?.status, "profile_verified");

await assert.rejects(
  store.createIntent({
    platform: "MT5",
    brokerName: "FP Trading",
    server: "",
    accountNumber: "123456",
    environment: "live",
    investorPassword: "secret",
  }),
  /Server broker richiesto/,
);

console.log("fx blue setup intent store checks passed");
