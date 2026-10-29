import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { isFullCalendarMonth, parseBinanceCsvLines } from "./binanceArchive.js";

// 1. Test calendar month detection
const jan2020Start = Date.UTC(2020, 0, 1) / 1000;
const feb2020Start = Date.UTC(2020, 1, 1) / 1000;
const jan15 = Date.UTC(2020, 0, 15) / 1000;

assert.equal(isFullCalendarMonth(jan2020Start, feb2020Start), true);
assert.equal(isFullCalendarMonth(jan2020Start, jan15), false);
assert.equal(isFullCalendarMonth(jan15, feb2020Start), false);

// 2. Test CSV parsing (both 13-digit ms and 16-digit us)
const sampleCsv = `open_time,open,high,low,close,volume,close_time,quote_asset_volume,number_of_trades,taker_buy_base_asset_volume,taker_buy_quote_asset_volume,ignore
1577836800000,7195.24,7196.25,7183.14,7186.68,51.6428,1577836859999,371233.51,493,19.59,140888.41,0
1577836860000,7186.68,7190.00,7185.00,7189.50,12.3456,1577836919999,88765.43,120,5.12,36789.01,0
1788220800000000,78581.30,78581.30,78562.00,78562.00,8.6783,1788220859999999,681871.93,1151,4.71,370202.90,0
`;

const parsed = parseBinanceCsvLines(sampleCsv);
assert.equal(parsed.length, 3);
assert.equal(parsed[0].time, 1577836800);
assert.equal(parsed[0].open, 7195.24);
assert.equal(parsed[0].high, 7196.25);
assert.equal(parsed[0].low, 7183.14);
assert.equal(parsed[0].close, 7186.68);
assert.equal(parsed[0].volume, 51.6428);

assert.equal(parsed[1].time, 1577836860);
assert.equal(parsed[1].close, 7189.50);

// Microsecond format verification
assert.equal(parsed[2].time, 1788220800);
assert.equal(parsed[2].open, 78581.30);
assert.equal(parsed[2].close, 78562.00);

console.log("binanceArchive unit checks passed");
