import assert from "node:assert/strict";
import { extendProEntitlement } from "./proEntitlement.js";

const now = new Date("2025-10-07T00:00:00Z");

// ── estende da adesso se non c'è entitlement attivo ──────────────────────────
{
  const end = extendProEntitlement({ currentPeriodEnd: null }, 3, now);
  assert.equal(end.toISOString(), "2026-01-07T00:00:00.000Z");
}

// ── si somma sopra un entitlement ancora attivo ──────────────────────────────
{
  const end = extendProEntitlement({ currentPeriodEnd: new Date("2025-12-07T00:00:00Z") }, 6, now);
  assert.equal(end.toISOString(), "2026-06-07T00:00:00.000Z");
}

// ── un entitlement già scaduto riparte da adesso ─────────────────────────────
{
  const end = extendProEntitlement({ currentPeriodEnd: new Date("2025-01-01T00:00:00Z") }, 1, now);
  assert.equal(end.toISOString(), "2025-11-07T00:00:00.000Z");
}

console.log("proEntitlement.test.ts: all assertions passed");
