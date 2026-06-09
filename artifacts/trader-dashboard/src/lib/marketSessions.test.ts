import assert from "node:assert/strict";
import {
  detectTradingSessionOverlap,
  getLocalTimeZone,
  getLocalTimeZoneLabel,
  isSessionEnabledForDate,
  isMarketClosedSession,
  isTradingSession,
  legacyUtcTimeToLocalSessionTime,
  localTimeToUtcTime,
  toDailyIntervals,
  utcTimeToLocalTime,
  type MarketSessionConfig,
} from "./marketSessions.js";

const london: MarketSessionConfig = {
  id: "london",
  name: "Londra",
  openUTC: "07:00",
  closeUTC: "11:00",
  color: "session-london",
  enabled: true,
};

const overlap: MarketSessionConfig = {
  id: "overlap",
  name: "Overlap",
  openUTC: "10:00",
  closeUTC: "12:00",
  color: "session-ny",
  enabled: true,
};

const closed: MarketSessionConfig = {
  id: "closed",
  name: "Mercato chiuso",
  kind: "market_closed",
  openUTC: "00:00",
  closeUTC: "23:59",
  color: "session-closed",
  enabled: true,
};

assert.equal(isTradingSession(london), true);
assert.equal(isMarketClosedSession(london), false);
assert.equal(isTradingSession(closed), false);
assert.equal(isMarketClosedSession(closed), true);
assert.equal(isSessionEnabledForDate({ ...closed, days: [6, 0] }, new Date(2026, 5, 6)), true);
assert.equal(isSessionEnabledForDate({ ...closed, days: [6, 0] }, new Date(2026, 5, 7)), true);
assert.equal(isSessionEnabledForDate({ ...closed, days: [6, 0] }, new Date(2026, 5, 5)), false);
assert.equal(isSessionEnabledForDate(closed, new Date(2026, 5, 5)), true);
assert.deepEqual(toDailyIntervals(23 * 60, 2 * 60), [[1380, 1440], [0, 120]]);
assert.deepEqual(toDailyIntervals(0, 0), [[0, 1440]]);
assert.equal(detectTradingSessionOverlap([london, overlap])?.includes("sovrappongono"), true);
assert.equal(detectTradingSessionOverlap([london, closed]), null);

const referenceDate = new Date(2026, 5, 7, 12, 0, 0, 0);
const localTime = "09:30";
assert.equal(utcTimeToLocalTime(localTimeToUtcTime(localTime, referenceDate), referenceDate), localTime);
assert.equal(localTimeToUtcTime(localTime, referenceDate), localTime);
assert.equal(utcTimeToLocalTime(localTime, referenceDate), localTime);
assert.equal(typeof getLocalTimeZone(), "string");
assert.notEqual(getLocalTimeZone().length, 0);
assert.equal(typeof getLocalTimeZoneLabel(), "string");
assert.notEqual(getLocalTimeZoneLabel().length, 0);

const legacyExpected = new Date(referenceDate);
legacyExpected.setUTCHours(9, 30, 0, 0);
assert.equal(
  legacyUtcTimeToLocalSessionTime("09:30", referenceDate),
  `${String(legacyExpected.getHours()).padStart(2, "0")}:${String(legacyExpected.getMinutes()).padStart(2, "0")}`,
);

console.log("market session checks passed");
