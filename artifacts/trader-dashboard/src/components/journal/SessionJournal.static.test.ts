import assert from "node:assert/strict";
import fs from "node:fs";

const src = fs.readFileSync("src/components/journal/SessionJournal.tsx", "utf8");

// 1. AUREUS Brand & Aesthetic consistency
assert.match(src, /SigilIcon/, "SessionJournal must use SigilIcon geometry");
assert.match(src, /(AUREUS|LIMEN) PROTOCOL/, "Must reference the official protocol breadcrumb");
assert.match(src, /C5A059|D4AF37/, "Must apply brand gold styling constants");

// 2. Usability & Metrics
assert.match(src, /stats\.adherence/, "Must calculate and display adherence / integrity index");
assert.match(src, /searchQuery/, "Must provide real-time search functionality");
assert.match(src, /filterStatus/, "Must provide status filtering for sessions");
assert.match(src, /allExpanded/, "Must provide expand/collapse all controls");

// 3. Integration & Browser test compatibility
assert.match(src, /session-journal-card/, "Must keep .session-journal-card class for verification drivers");
assert.match(src, /data-session-id/, "Must retain data-session-id attribute for deep links and tests");
assert.match(src, /plan\.decision === "wait"\s*\?\s*plan\.waitReason/, "Must render waitReason accurately for exact text locators");
assert.match(src, /prepareTrader/, "Must provide access to session preparation in empty state");

// 4. 4 Tactical Pillars
assert.match(src, /Contemplazione & Scenario/, "Pillar I: HTF Scenario & bias");
assert.match(src, /Custode della Soglia/, "Pillar II: Threshold Keeper & Checklist");
assert.match(src, /Sigillo d'Azione/, "Pillar III: Action Seal & Trade Evidences");
assert.match(src, /Consuntivo Spietato/, "Pillar IV: Debrief & Inherited Rule");

console.log("SessionJournal LIMEN restructuring and usability static checks passed!");
