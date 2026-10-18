import assert from "node:assert/strict";
import { createSentimentOutlookService, SENTIMENT_MAX_STALE_MS } from "./sentimentOutlook.js";
import type { MyfxbookSymbol } from "./myfxbook.js";

const symbols: MyfxbookSymbol[] = [{ name: "EURUSD", longPercentage: 60, shortPercentage: 40, longPositions: 6, shortPositions: 4, longVolume: 6, shortVolume: 4 }];
let configured = false;
let time = Date.parse("2026-09-18T10:00:00Z");
let response = symbols;
let fail = true;
let calls = 0;
const get = createSentimentOutlookService({
  hasCredentials: () => configured, now: () => time,
  fetchSymbols: async () => { calls++; if (fail) throw new Error("secret provider URL"); return response; },
});

async function main() {
  const disabled = await get();
  assert.equal(disabled.status, "unavailable");
  assert.equal(disabled.reason, "not_configured");
  assert.deepEqual(disabled.symbols, []);
  assert.equal(calls, 0);
  configured = true;
  const outage = await get();
  assert.equal(outage.status, "unavailable");
  assert.deepEqual(outage.symbols, []);
  assert.equal(JSON.stringify(outage).includes("secret"), false);
  fail = false;
  response = [...symbols, { ...symbols[0], name: "INACTIVE", longPercentage: 0, shortPercentage: 0 }, { ...symbols[0], name: "INVALID", longPercentage: Number.NaN }];
  const fresh = await get();
  assert.equal(fresh.status, "available");
  assert.deepEqual(fresh.symbols, symbols, "invalid/inactive rows must not hide a valid pair");
  assert.equal(fresh.observedAt, null); // never invent an observation timestamp
  const retrieved = fresh.fetchedAt;
  time += 60_000;
  fail = true;
  const cached = await get();
  assert.equal(cached.status, "stale");
  assert.equal(cached.live, false);
  assert.equal(cached.fetchedAt, retrieved); // failed attempt must not freshen old data
  assert.deepEqual(cached.symbols, symbols);
  fail = false;
  response = [];
  assert.equal((await get()).status, "stale");
  response = [{ ...symbols[0], longPercentage: Number.NaN }];
  assert.equal((await get()).status, "stale");
  time += SENTIMENT_MAX_STALE_MS;
  assert.equal((await get()).status, "unavailable");
  response = symbols;
  assert.equal((await get()).status, "available");
  configured = false;
  assert.deepEqual((await get()).symbols, []);
  configured = true;
  fail = true;
  assert.equal((await get()).status, "unavailable"); // clearing config clears last-good

  let resolve!: (value: MyfxbookSymbol[]) => void;
  const shared = createSentimentOutlookService({ hasCredentials: () => true, fetchSymbols: () => new Promise((r) => { resolve = r; }) });
  const a = shared(); const b = shared();
  assert.equal(a, b);
  resolve(symbols);
  assert.equal((await a).status, "available");
  console.log("sentiment outlook lifecycle checks passed");
}
void main();
