import assert from "node:assert/strict";
import { historyChunks, historyStart, parseDayStart, parseIngestOptions } from "./ingestCli.js";

const supported = ["XAUUSD", "EURUSD", "USOIL", "BTCUSD"];
const options = parseIngestOptions(["seed", "--symbols=xauusd,EURUSD,xauusd,usoil", "--years=5"], supported);
assert.deepEqual(options.symbols, ["XAUUSD", "EURUSD", "USOIL"]);
assert.equal(options.resume, true);
for (const args of [
  ["seed", "--symbols=EURUSD,UNKNOWN"], ["seed", "--symbols="], ["seed", "--years=0"],
  ["seed", "--years=Infinity"], ["seed", "--years=2.5"], ["seed", "--from=2025-02-29"],
  ["seed", "--from=2026-10-10", "--to=2026-10-01"], ["seed", "--resume=maybe"],
  ["seed", "--years=5", "--years=6"], ["seed", "--oops=1"], ["tail", "--from=2026-01-01"],
  ["seed", "--file=history.csv"], ["import", "--file=history.csv", "--symbols=USOIL"],
  ["import", "--file=history.csv", "--source=dukascopy", "--symbols=USOIL,EURUSD"],
  ["import", "--file=history.csv", "--source=other", "--symbols=USOIL"],
]) assert.throws(() => parseIngestOptions(args, supported), args.join(" "));
assert.equal(parseIngestOptions(["import", "--file=/my export/history.csv", "--source=dukascopy", "--symbols=USOIL"], supported).file, "/my export/history.csv");
assert.equal(parseDayStart("2024-02-29"), Date.UTC(2024, 1, 29) / 1000);
assert.throws(() => parseDayStart("2024-2-29"));
const from = parseDayStart("2024-01-15"), to = parseDayStart("2024-03-07");
assert.deepEqual(historyChunks(from, to), [
  [parseDayStart("2024-03-01"), to],
  [parseDayStart("2024-02-01"), parseDayStart("2024-03-01")],
  [from, parseDayStart("2024-02-01")],
]);
assert.equal(historyStart(parseDayStart("2024-02-29"), 1), parseDayStart("2023-02-28"));
assert.equal(historyStart(parseDayStart("2026-10-10"), 5), parseDayStart("2021-10-10"));
console.log("ingest CLI validation and calendar-range planning passed");
