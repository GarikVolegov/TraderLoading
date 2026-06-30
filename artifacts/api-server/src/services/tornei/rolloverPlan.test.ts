import assert from "node:assert/strict";
import { planRollover, type SeasonRow } from "./rolloverPlan.js";

const D = (s: string) => new Date(s);

// ── chiude la live scaduta, promuove l'upcoming iniziata, coda la prossima ───
{
  const now = D("2025-10-07T01:00:00Z"); // finestra corrente = Q4 2025
  const seasons: SeasonRow[] = [
    { id: 1, slug: "2025-q3", status: "live", startsAt: D("2025-07-07Z"), endsAt: D("2025-10-07Z"), settledAt: null },
    { id: 2, slug: "2025-q4", status: "upcoming", startsAt: D("2025-10-07Z"), endsAt: D("2026-01-07Z"), settledAt: null },
  ];
  const plan = planRollover(seasons, now);
  assert.deepEqual(plan.toEnd, [1]);
  assert.deepEqual(plan.toPromote, [2]);
  // Q4 esiste → coda la successiva Q1 2026.
  assert.equal(plan.toCreate?.slug, "2026-q1");
}

// ── nessuna stagione per la finestra corrente → la crea (cold start) ─────────
{
  const now = D("2025-08-10T00:00:00Z"); // finestra corrente = Q3 2025
  const plan = planRollover([], now);
  assert.equal(plan.toEnd.length, 0);
  assert.equal(plan.toPromote.length, 0);
  assert.equal(plan.toCreate?.slug, "2025-q3");
}

// ── live corrente senza upcoming → coda la prossima ──────────────────────────
{
  const now = D("2025-10-08T00:00:00Z");
  const seasons: SeasonRow[] = [
    { id: 2, slug: "2025-q4", status: "live", startsAt: D("2025-10-07Z"), endsAt: D("2026-01-07Z"), settledAt: null },
  ];
  const plan = planRollover(seasons, now);
  assert.equal(plan.toEnd.length, 0);
  assert.equal(plan.toCreate?.slug, "2026-q1");
}

// ── stato stabile (corrente + prossima già presenti) → niente da creare ──────
{
  const now = D("2025-10-08T00:00:00Z");
  const seasons: SeasonRow[] = [
    { id: 2, slug: "2025-q4", status: "live", startsAt: D("2025-10-07Z"), endsAt: D("2026-01-07Z"), settledAt: null },
    { id: 3, slug: "2026-q1", status: "upcoming", startsAt: D("2026-01-07Z"), endsAt: D("2026-04-07Z"), settledAt: null },
  ];
  const plan = planRollover(seasons, now);
  assert.equal(plan.toCreate, null);
}

console.log("rolloverPlan.test.ts: all assertions passed");
