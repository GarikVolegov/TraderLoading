import assert from "node:assert/strict";
import { parseJournalTab } from "./journalTabs";

assert.equal(parseJournalTab(""), "panoramica", "empty search defaults to panoramica");
assert.equal(parseJournalTab("?t=panoramica"), "panoramica");
assert.equal(parseJournalTab("?t=trades"), "trades");
assert.equal(parseJournalTab("?t=idee"), "idee");
assert.equal(parseJournalTab("?t=obiettivi"), "obiettivi");
assert.equal(parseJournalTab("?t=recap-settimanale"), "recap-settimanale");
assert.equal(parseJournalTab("?t=recap-mensile"), "recap-mensile");
assert.equal(parseJournalTab("t=trades"), "trades", "leading ? optional");
assert.equal(parseJournalTab("?t=bogus"), "panoramica", "unknown value falls back to panoramica");
assert.equal(parseJournalTab("?foo=1"), "panoramica", "missing t falls back to panoramica");

console.log("journalTabs unit checks passed");
