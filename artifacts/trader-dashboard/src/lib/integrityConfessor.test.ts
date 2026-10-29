import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  computeConfessionScore,
  computeConfessionHash,
  getTodayKey,
  type ConfessionAnswers,
} from "./integrityConfessor.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sourceFile = path.join(__dirname, "integrityConfessor.ts");

test("integrityConfessor: source file exists", () => {
  assert.ok(fs.existsSync(sourceFile), "integrityConfessor.ts must exist");
});

test("integrityConfessor: getTodayKey returns YYYY-MM-DD format", () => {
  const key = getTodayKey();
  assert.match(key, /^\d{4}-\d{2}-\d{2}$/, "Today key must match YYYY-MM-DD");
});

test("integrityConfessor: computeConfessionScore rewards total discipline with 100% and inviolable seal", () => {
  const perfectAnswers: ConfessionAnswers = {
    stopLoss: "strict",
    antiOvertrading: "monastic",
    truthfulLedger: "faithful",
  };

  const res = computeConfessionScore(perfectAnswers);
  assert.equal(res.score, 100);
  assert.equal(res.sealType, "inviolable");
  assert.equal(res.sealColor, "#10b981");
  assert.ok(res.sealLabel.includes("Inviolata"));
});

test("integrityConfessor: computeConfessionScore assigns watchful seal to minor hesitation", () => {
  const hesitatedAnswers: ConfessionAnswers = {
    stopLoss: "hesitated",
    antiOvertrading: "tempted",
    truthfulLedger: "faithful",
  };

  const res = computeConfessionScore(hesitatedAnswers);
  assert.equal(res.score, 65);
  assert.equal(res.sealType, "watchful");
  assert.equal(res.sealColor, "#C5A059");
  assert.ok(res.sealLabel.includes("Vigilanza"));
});

test("integrityConfessor: computeConfessionScore triggers drift alert on multiple violations", () => {
  const violatedAnswers: ConfessionAnswers = {
    stopLoss: "violated",
    antiOvertrading: "violated",
    truthfulLedger: "omitted",
  };

  const res = computeConfessionScore(violatedAnswers);
  assert.equal(res.score, 0);
  assert.equal(res.sealType, "drift");
  assert.equal(res.sealColor, "#ef4444");
  assert.ok(res.sealLabel.includes("Deriva"));
});

test("integrityConfessor: computeConfessionHash produces deterministic 18-char hex string", () => {
  const answers: ConfessionAnswers = {
    stopLoss: "strict",
    antiOvertrading: "monastic",
    truthfulLedger: "faithful",
  };

  const hash1 = computeConfessionHash("2026-10-25", answers, 100);
  const hash2 = computeConfessionHash("2026-10-25", answers, 100);

  assert.equal(hash1, hash2, "Confession hash must be strictly deterministic");
  assert.ok(hash1.startsWith("0x"), "Must start with 0x prefix");
  assert.equal(hash1.length, 18, "0x + 16 hex chars = 18 chars total");

  const hashDiff = computeConfessionHash("2026-10-26", answers, 100);
  assert.notEqual(hash1, hashDiff, "Different date must yield different hash");
});
