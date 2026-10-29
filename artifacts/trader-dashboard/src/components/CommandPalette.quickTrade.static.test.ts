import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseQuickTradeCommand } from "../lib/quickTradeCommand.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test("CommandPalette Quick Trade Parser: Win syntax with tags and profit", () => {
  const result = parseQuickTradeCommand("trade win 250 EURUSD piano target");
  assert.ok(result);
  assert.strictEqual(result.isValid, true);
  assert.strictEqual(result.symbol, "EURUSD");
  assert.strictEqual(result.result, "win");
  assert.strictEqual(result.profit, 250);
  assert.deepStrictEqual(result.tags, ["piano", "target"]);
  assert.match(result.title, /EURUSD/);
  assert.match(result.rawContent, /Ticket: #CMD-/);
  assert.match(result.rawContent, /Symbol: EURUSD/);
});

test("CommandPalette Quick Trade Parser: Loss syntax with leak tag", () => {
  const result = parseQuickTradeCommand("/trade loss 120 GBPUSD fomo");
  assert.ok(result);
  assert.strictEqual(result.isValid, true);
  assert.strictEqual(result.symbol, "GBPUSD");
  assert.strictEqual(result.result, "loss");
  assert.strictEqual(result.profit, -120);
  assert.deepStrictEqual(result.tags, ["fomo"]);
});

test("CommandPalette Quick Trade Parser: Price syntax requires Stop Loss", () => {
  const invalid = parseQuickTradeCommand("trade buy EURUSD 1.0850 tp 1.0920");
  assert.ok(invalid);
  assert.strictEqual(invalid.isValid, false);
  assert.match(invalid.error || "", /Stop Loss obbligatorio/i);

  const valid = parseQuickTradeCommand("trade buy EURUSD 1.0850 sl 1.0820 tp 1.0910 piano");
  assert.ok(valid);
  assert.strictEqual(valid.isValid, true);
  assert.strictEqual(valid.symbol, "EURUSD");
  assert.strictEqual(valid.direction, "buy");
  assert.strictEqual(valid.entryPrice, 1.085);
  assert.strictEqual(valid.stopLoss, 1.082);
  assert.strictEqual(valid.takeProfit, 1.091);
  assert.strictEqual(valid.rMultiple, 2);
  assert.deepStrictEqual(valid.tags, ["piano"]);
});

test("CommandPalette Source Inspection: Integrates Quick Trade and Synesthetic Sound", () => {
  const source = fs.readFileSync(path.join(__dirname, "CommandPalette.tsx"), "utf8");

  assert.ok(
    source.includes("parseQuickTradeCommand"),
    "CommandPalette must import and invoke parseQuickTradeCommand",
  );
  assert.ok(
    source.includes("useCreateJournalEntry"),
    "CommandPalette must use useCreateJournalEntry mutation",
  );
  assert.ok(
    source.includes("synestheticSealOfAction"),
    "CommandPalette must play synestheticSealOfAction upon successful trade sealing",
  );
  assert.ok(
    source.includes("queueOfflineMutation"),
    "CommandPalette must provide offline-first queue fallback",
  );
  assert.ok(
    source.includes("whitespace-nowrap"),
    "Financial badges in CommandPalette must include whitespace-nowrap",
  );
  assert.ok(
    source.includes("font-mono"),
    "Financial figures in CommandPalette must use font-mono",
  );
});
