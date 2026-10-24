import assert from "node:assert/strict";
import {
  isWeekendMarketClosed,
  adjustToActiveTradingSession,
  getBlindHistoricalTimestamp,
  assignBlindHistoricalDates,
} from "./blindDateEngine.js";

async function runTests() {
  // 1. Weekend check
  // 2023-10-14 12:00:00 UTC was a Saturday
  const saturdayTs = 1697284800;
  assert.equal(isWeekendMarketClosed(saturdayTs, "XAU/USD"), true, "Saturday should be marked closed for Gold");
  assert.equal(isWeekendMarketClosed(saturdayTs, "BTC/USD"), false, "Crypto trades 24/7 on weekends");

  // Friday night after 22:00 UTC
  // 2023-10-13 22:30:00 UTC
  const fridayNightTs = 1697236200;
  assert.equal(isWeekendMarketClosed(fridayNightTs, "EUR/USD"), true, "Friday night >22:00 UTC is closed");

  // Monday 10:00 UTC
  // 2023-10-16 10:00:00 UTC
  const mondayTs = 1697450400;
  assert.equal(isWeekendMarketClosed(mondayTs, "EUR/USD"), false, "Monday morning is open");

  // 2. Adjust Saturday to Monday London session
  const adjusted = adjustToActiveTradingSession(saturdayTs, "XAU/USD");
  assert.equal(isWeekendMarketClosed(adjusted, "XAU/USD"), false, "Adjusted timestamp must be open");
  const adjDate = new Date(adjusted * 1000);
  assert.equal(adjDate.getUTCDay(), 1, "Must be adjusted to Monday");
  assert.equal(adjDate.getUTCHours(), 8, "Must be adjusted to 08:00 UTC London session");

  // 3. Single blind timestamp generation
  const singleTs = await getBlindHistoricalTimestamp("XAU/USD", "M5");
  assert.ok(singleTs > 1622505600, "Timestamp must be within valid historical bounds");
  assert.equal(singleTs % 300, 0, "Must be aligned to 5-minute candle interval");
  assert.equal(isWeekendMarketClosed(singleTs, "XAU/USD"), false, "Must not be on a closed weekend");

  // 4. Multi-participant assignment
  const participants = ["user_1", "user_2", "user_3", "user_4"];
  const assignments = await assignBlindHistoricalDates(participants, "US30", "M15");

  assert.equal(Object.keys(assignments).length, 4, "All participants must receive a timestamp");
  for (const pid of participants) {
    const ts = assignments[pid];
    assert.ok(typeof ts === "number" && ts > 0, `Participant ${pid} must have a valid number`);
    assert.equal(ts % 900, 0, "Must be aligned to 15-minute interval");
    assert.equal(isWeekendMarketClosed(ts, "US30"), false, "Must not be weekend");
  }

  // Ensure timestamps are distinct
  const uniqueVals = new Set(Object.values(assignments));
  assert.equal(uniqueVals.size, 4, "Each participant must receive a distinct historical start time!");

  console.log("blindDateEngine tests passed successfully!");
}

await runTests();
