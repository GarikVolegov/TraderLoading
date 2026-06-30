import assert from "node:assert/strict";
import { checkEligibility } from "./eligibility.js";

// ── richiede un conto reale sincronizzato ────────────────────────────────────
{
  assert.deepEqual(
    checkEligibility({ hasSyncedRealAccount: false, consent: true, seasonStatus: "live" }),
    { ok: false, reason: "no_real_account" },
  );
}

// ── richiede il consenso esplicito ───────────────────────────────────────────
{
  assert.deepEqual(
    checkEligibility({ hasSyncedRealAccount: true, consent: false, seasonStatus: "live" }),
    { ok: false, reason: "no_consent" },
  );
}

// ── non ci si iscrive a una stagione conclusa ────────────────────────────────
{
  assert.deepEqual(
    checkEligibility({ hasSyncedRealAccount: true, consent: true, seasonStatus: "ended" }),
    { ok: false, reason: "season_closed" },
  );
}

// ── ok per live con conto + consenso ─────────────────────────────────────────
{
  assert.deepEqual(
    checkEligibility({ hasSyncedRealAccount: true, consent: true, seasonStatus: "live" }),
    { ok: true },
  );
}

console.log("eligibility.test.ts: all assertions passed");
