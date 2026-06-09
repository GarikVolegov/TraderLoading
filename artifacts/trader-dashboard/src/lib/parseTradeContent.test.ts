import assert from "node:assert/strict";
import { parseTradeContent, tradeDuration, tradeRMultiple } from "./parseTradeContent.js";

// Formato Broker Hub (accountDataSync.ts)
const brokerHubContent = [
  "Ticket: 215004131",
  "Source: FX Blue Account Sync",
  "Broker: FP Trading",
  "Account: 82364482",
  "Symbol: XAUUSD.R",
  "Direction: BUY",
  "Volume: 0.01",
  "Open Time: 2026-05-20T17:12:33Z",
  "Close Time: 2026-05-20T17:55:14Z",
  "Entry Price: 4468.94000",
  "Exit Price: 4532.00000",
  "Stop Loss: 4452.00000",
  "Take Profit: 4532.00000",
  "Profit: 54.20 EUR",
  "Commission: -0.06 EUR",
  "Swap: 0.00 EUR",
  "Rischio prezzo: 16.94000",
  "Rendimento conto: 0.5683%",
].join("\n");

const parsed = parseTradeContent(brokerHubContent);
assert.ok(parsed, "broker hub content must parse");
assert.equal(parsed.ticket, "215004131");
assert.equal(parsed.symbol, "XAUUSD.R");
assert.equal(parsed.direction, "BUY");
assert.equal(parsed.volume, 0.01);
assert.equal(parsed.entryPrice, 4468.94);
assert.equal(parsed.exitPrice, 4532);
assert.equal(parsed.stopLoss, 4452);
assert.equal(parsed.profit, 54.2);
assert.equal(parsed.commission, -0.06);
assert.equal(parsed.currency, "EUR");
assert.equal(parsed.returnPct, 0.5683);
assert.equal(tradeDuration(parsed), "43m");

const r = tradeRMultiple(parsed);
assert.ok(r !== null && r > 3.7 && r < 3.8, `expected R ~3.72, got ${r}`);

// Formato account bridge (journalImport.ts) — senza valuta, con Status
const bridgeContent = [
  "Ticket: T-100",
  "Source: mt5-local",
  "Symbol: EURUSD",
  "Direction: SELL",
  "Status: closed",
  "Volume: 0.50",
  "Open Time: 2026-06-01T08:00:00Z",
  "Close Time: 2026-06-03T10:30:00Z",
  "Entry Price: 1.08500",
  "Exit Price: 1.09000",
  "Stop Loss: -",
  "Take Profit: -",
  "Profit: -25.00",
  "Commission: 0.00",
  "Swap: -1.20",
].join("\n");

const bridgeParsed = parseTradeContent(bridgeContent);
assert.ok(bridgeParsed, "bridge content must parse");
assert.equal(bridgeParsed.profit, -25);
assert.equal(bridgeParsed.stopLoss, undefined);
assert.equal(bridgeParsed.currency, undefined);
assert.equal(bridgeParsed.status, "closed");
assert.equal(tradeDuration(bridgeParsed), "2g 2h");
assert.equal(tradeRMultiple(bridgeParsed), null, "no stop loss means no R-multiple");

// Commento utente dopo il blocco importato
const withComment = `${brokerHubContent}\n\nEntrata anticipata, rivedere il timing.`;
const commentParsed = parseTradeContent(withComment);
assert.ok(commentParsed);
assert.equal(commentParsed.comment, "Entrata anticipata, rivedere il timing.");

// SL/TP a zero (non impostati su MT4/MT5) → undefined, niente R-multiple fasullo
const zeroSlContent = brokerHubContent
  .replace("Stop Loss: 4452.00000", "Stop Loss: 0.00000")
  .replace("Take Profit: 4532.00000", "Take Profit: 0.00000");
const zeroSlParsed = parseTradeContent(zeroSlContent);
assert.ok(zeroSlParsed);
assert.equal(zeroSlParsed.stopLoss, undefined);
assert.equal(zeroSlParsed.takeProfit, undefined);
assert.equal(tradeRMultiple(zeroSlParsed), null);

// Note manuali → null
assert.equal(parseTradeContent("Oggi ho seguito il piano e ho chiuso flat."), null);
assert.equal(parseTradeContent(""), null);
assert.equal(parseTradeContent(null), null);
assert.equal(
  parseTradeContent("Idea: long XAUUSD sopra 2400\nNota: attendere conferma"),
  null,
  "free text with colons must not be treated as a trade",
);

console.log("parse trade content checks passed");
