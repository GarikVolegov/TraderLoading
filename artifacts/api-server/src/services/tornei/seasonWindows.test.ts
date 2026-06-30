import assert from "node:assert/strict";
import { quarterWindowFor, nextWindowAfter } from "./seasonWindows.js";

// ── metà agosto cade nel Q3 (7 lug → 7 ott) ──────────────────────────────────
{
  const w = quarterWindowFor(new Date("2025-08-15T00:00:00Z"));
  assert.equal(w.slug, "2025-q3");
  assert.equal(w.label, "Q3 2025");
  assert.equal(w.startsAt.toISOString(), "2025-07-07T00:00:00.000Z");
  assert.equal(w.endsAt.toISOString(), "2025-10-07T00:00:00.000Z");
}

// ── prima del 7 del primo mese del trimestre => trimestre precedente ─────────
{
  const w = quarterWindowFor(new Date("2025-07-05T12:00:00Z"));
  assert.equal(w.slug, "2025-q2");
  assert.equal(w.endsAt.toISOString(), "2025-07-07T00:00:00.000Z");
}

// ── il Q4 attraversa il confine d'anno ───────────────────────────────────────
{
  const w = quarterWindowFor(new Date("2025-12-20T00:00:00Z"));
  assert.equal(w.slug, "2025-q4");
  assert.equal(w.startsAt.toISOString(), "2025-10-07T00:00:00.000Z");
  assert.equal(w.endsAt.toISOString(), "2026-01-07T00:00:00.000Z");
}

// ── la finestra dopo il Q4 2025 è il Q1 2026 ────────────────────────────────
{
  const w = nextWindowAfter(quarterWindowFor(new Date("2025-12-20T00:00:00Z")));
  assert.equal(w.slug, "2026-q1");
  assert.equal(w.startsAt.toISOString(), "2026-01-07T00:00:00.000Z");
}

console.log("seasonWindows.test.ts: all assertions passed");
