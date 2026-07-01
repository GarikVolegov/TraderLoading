import assert from "node:assert/strict";
import {
  evaluateReviewPrompt,
  MIN_TRADES_FOR_REVIEW,
  STREAK_SIGNAL_THRESHOLD,
  type PromptInput,
} from "./promptEligibility.js";

const NOW = new Date("2026-07-01T12:00:00Z");

function input(overrides: Partial<PromptInput> = {}): PromptInput {
  return {
    closedTrades: MIN_TRADES_FOR_REVIEW,
    level: 1,
    streak: 0,
    clientSignal: "none",
    hasReviewed: false,
    optedOut: false,
    snoozedUntil: null,
    now: NOW,
    ...overrides,
  };
}

// ── sotto la soglia di attività => non idoneo ────────────────────────────────
{
  const r = evaluateReviewPrompt(input({ closedTrades: MIN_TRADES_FOR_REVIEW - 1, level: 5 }));
  assert.equal(r.eligible, false);
  assert.equal(r.shouldPrompt, false);
  assert.equal(r.reason, "below_threshold");
}

// ── opt-out ha la precedenza su tutto ────────────────────────────────────────
{
  const r = evaluateReviewPrompt(input({ optedOut: true, level: 9, streak: 30 }));
  assert.equal(r.shouldPrompt, false);
  assert.equal(r.reason, "opted_out");
}

// ── snooze nel futuro sopprime il prompt ─────────────────────────────────────
{
  const r = evaluateReviewPrompt(
    input({ snoozedUntil: new Date("2026-07-15T00:00:00Z"), level: 5 }),
  );
  assert.equal(r.shouldPrompt, false);
  assert.equal(r.reason, "snoozed");
}

// ── snooze scaduto NON sopprime (torna a valutare i segnali) ──────────────────
{
  const r = evaluateReviewPrompt(
    input({ snoozedUntil: new Date("2026-06-01T00:00:00Z"), level: 3 }),
  );
  assert.equal(r.shouldPrompt, true);
  assert.equal(r.reason, "level");
}

// ── ha già recensito => soppresso ────────────────────────────────────────────
{
  const r = evaluateReviewPrompt(input({ hasReviewed: true, level: 5 }));
  assert.equal(r.shouldPrompt, false);
  assert.equal(r.hasReviewed, true);
  assert.equal(r.reason, "already_reviewed");
}

// ── level-up (level > 1) è un segnale positivo ───────────────────────────────
{
  const r = evaluateReviewPrompt(input({ level: 2 }));
  assert.equal(r.shouldPrompt, true);
  assert.equal(r.eligible, true);
  assert.equal(r.reason, "level");
}

// ── streak sopra soglia è un segnale positivo ────────────────────────────────
{
  const r = evaluateReviewPrompt(input({ streak: STREAK_SIGNAL_THRESHOLD }));
  assert.equal(r.shouldPrompt, true);
  assert.equal(r.reason, "streak");
}

// ── hint del client "coach" è un segnale positivo (e ha priorità) ────────────
{
  const r = evaluateReviewPrompt(input({ clientSignal: "coach" }));
  assert.equal(r.shouldPrompt, true);
  assert.equal(r.reason, "coach");
}

// ── idoneo ma nessun picco => non disturbare ─────────────────────────────────
{
  const r = evaluateReviewPrompt(input({ level: 1, streak: 0, clientSignal: "none" }));
  assert.equal(r.eligible, true);
  assert.equal(r.shouldPrompt, false);
  assert.equal(r.reason, "no_signal");
}

console.log("promptEligibility.test.ts: all assertions passed");
