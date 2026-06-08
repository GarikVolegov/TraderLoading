import assert from "node:assert/strict";
import {
  emptyJournalRecapFields,
  fetchJournalRecap,
  journalRecapQueryKey,
  saveJournalRecap,
} from "./journalRecapsApi.js";
import type { JournalRecapPeriod } from "./journalRecapPeriods.js";

const period: JournalRecapPeriod = {
  kind: "four_week",
  periodStart: "2026-06-08",
  periodEnd: "2026-07-05",
  editWindowStart: "2026-07-04",
  editWindowEnd: "2026-07-05",
};

const calls: Array<{ url: string; init?: RequestInit }> = [];
globalThis.fetch = async (url, init) => {
  calls.push({ url: String(url), init });
  return Response.json({
    id: 7,
    ...period,
    ...emptyJournalRecapFields,
    overallJudgment: "Buon ciclo",
  });
};

assert.deepEqual(journalRecapQueryKey(period), ["/api/journal/recaps", "four_week", "2026-06-08", "2026-07-05"]);

const fetched = await fetchJournalRecap(period, { basePath: "/trader" });
assert.equal(calls[0]?.url, "/trader/api/journal/recaps?kind=four_week&periodStart=2026-06-08&periodEnd=2026-07-05");
assert.equal(fetched?.overallJudgment, "Buon ciclo");

await saveJournalRecap({
  ...period,
  ...emptyJournalRecapFields,
  overallJudgment: "Da consolidare",
}, { basePath: "/trader" });

assert.equal(calls[1]?.url, "/trader/api/journal/recaps");
assert.equal(calls[1]?.init?.method, "PUT");
assert.equal(JSON.parse(String(calls[1]?.init?.body)).overallJudgment, "Da consolidare");

console.log("journal recap api checks passed");
