import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const src = fs.readFileSync("src/components/journal/JournalOverview.tsx", "utf8");

test("reads real data hooks, not mock arrays", () => {
  assert.match(src, /useGetJournalEdge/);
  assert.match(src, /useGetJournalEntries/);
  assert.match(src, /fetchJournalRecap/);
  assert.match(src, /getJournalRecapPeriod\(\s*"four_week"/);
  // mock literals from the kit must not survive
  assert.doesNotMatch(src, /JOURNAL_TRADES|"128"|"\+24\.6R"/);
});

test("composes the five sections via real primitives + chart", () => {
  assert.match(src, /StatTile/);
  assert.match(src, /EquityCurveChart/);
  assert.match(src, /Progress/);
  assert.match(src, /tradeRMultiple/);
  assert.match(src, /onNavigate/);
});

test("every visible string is i18n'd", () => {
  assert.match(src, /journal\.overview\./);
  // no obvious hardcoded Italian copy
  assert.doesNotMatch(src, /Nuovo Trade|Recap 4 settimane|Trade recenti/);
});
