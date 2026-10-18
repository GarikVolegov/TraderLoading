import assert from "node:assert/strict";
import { createCsvSource, parseDukascopyM1Csv } from "./csv.js";

const csv =
  "\uFEFFGmt time,Open,High,Low,Close,Volume\r\n03.06.2024 10:01:00.000,1.1,1.2,1.0,1.15,20\r\n03.06.2024 10:00:00.000,1.0,1.2,0.9,1.1,10\r\n";
const candles = parseDukascopyM1Csv(csv);
assert.equal(candles.length, 2);
assert.equal(candles[0].time, Date.parse("2024-06-03T10:00:00Z") / 1000);
assert.equal(candles[1].volume, 20);
const semicolon = parseDukascopyM1Csv(
  '"Time (UTC)";Open;High;Low;Close\n"2024-06-03 10:00:00";72;73;71;72.5',
);
assert.equal(semicolon[0].close, 72.5);
assert.equal(semicolon[0].volume, undefined);
const offset = parseDukascopyM1Csv(
  "Timestamp,Open,High,Low,Close\n2024-06-03T12:00:00+02:00,72,73,71,72.5",
);
assert.equal(offset[0].time, semicolon[0].time);
assert.throws(
  () => parseDukascopyM1Csv("Time,Open,High,Low,Close\n2024-06-03 10:00:00,1,2,0,1"),
  /timezone/,
);
assert.throws(
  () => parseDukascopyM1Csv(csv + "03.06.2024 10:00:00.000,1.0,1.2,0.9,1.1,10"),
  /duplicate/,
);
assert.throws(() => parseDukascopyM1Csv(csv.replace("1.2,1.0", "1.01,1.0")), /Invalid/);
assert.throws(() => parseDukascopyM1Csv(csv.replace("10:01:00.000", "10:01:30.000")), /Invalid/);
assert.throws(() => parseDukascopyM1Csv(csv.replace("03.06.2024", "31.02.2024")), /Invalid UTC/);
assert.throws(
  () => parseDukascopyM1Csv("Time (UTC),Open,High,Low,Close\n2024-02-31T10:00:00Z,1,2,0,1"),
  /Invalid ISO date/,
);
const source = createCsvSource("USOIL", candles);
for (const symbol of ["BTCUSD", "ETHUSD", "UNKNOWN"])
  assert.throws(() => createCsvSource(symbol, candles), /canonical quote feed/);
assert.equal(source.id, 1);
assert.deepEqual(await source.fetchRange("USOIL", candles[0].time, candles[1].time), [candles[0]]);
assert.equal(source.supports("EURUSD"), false);
await assert.rejects(source.fetchRange("EURUSD", 0, Infinity), /requested symbol/);
console.log("Dukascopy CSV import checks passed");
