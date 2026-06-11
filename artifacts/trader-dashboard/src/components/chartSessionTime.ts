import type { Time } from "lightweight-charts";
import type { SessionBoxId } from "./chartAnalysisTypes";

const ROME_TIME_ZONE = "Europe/Rome";

export interface TimeRange {
  start: number;
  end: number;
}

type RomeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

function getRomeParts(ts: number): RomeParts {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: ROME_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(ts * 1000));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}

function compareRomeParts(a: RomeParts, b: RomeParts): number {
  const av = [a.year, a.month, a.day, a.hour, a.minute];
  const bv = [b.year, b.month, b.day, b.hour, b.minute];
  for (let i = 0; i < av.length; i++) {
    if (av[i] < bv[i]) return -1;
    if (av[i] > bv[i]) return 1;
  }
  return 0;
}

function findUtcForRomeLocal(target: RomeParts): number {
  const approximate = Date.UTC(target.year, target.month - 1, target.day, target.hour, target.minute) / 1000;
  let low = approximate - 36 * 60 * 60;
  let high = approximate + 36 * 60 * 60;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const cmp = compareRomeParts(getRomeParts(mid), target);
    if (cmp < 0) low = mid + 1;
    else high = mid;
  }
  return low;
}

function addRomeDays(parts: RomeParts, days: number): RomeParts {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, 12, 0));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: parts.hour,
    minute: parts.minute,
  };
}

function rangeForRomeClock(day: RomeParts, startHour: number, startMinute: number, endHour: number, endMinute: number): TimeRange {
  const start = findUtcForRomeLocal({ ...day, hour: startHour, minute: startMinute });
  const endDay = endHour < startHour || (endHour === startHour && endMinute <= startMinute) ? addRomeDays(day, 1) : day;
  const end = findUtcForRomeLocal({ ...endDay, hour: endHour, minute: endMinute });
  return { start, end };
}

export function getEuropeRomeDayRangeForTime(ts: number): TimeRange {
  const parts = getRomeParts(ts);
  const day = { ...parts, hour: 0, minute: 0 };
  const start = findUtcForRomeLocal(day);
  const nextDay = addRomeDays(day, 1);
  const end = findUtcForRomeLocal({ ...nextDay, hour: 0, minute: 0 });
  return { start, end };
}

export function getSessionRangesForTime(ts: number): Record<SessionBoxId, TimeRange> {
  const dayStart = getEuropeRomeDayRangeForTime(ts).start;
  const day = { ...getRomeParts(dayStart), hour: 0, minute: 0 };
  return {
    asia: rangeForRomeClock(day, 0, 0, 8, 0),
    london: rangeForRomeClock(day, 8, 0, 17, 0),
    newYork: rangeForRomeClock(day, 14, 30, 23, 0),
  };
}

export function isTimeInsideRange(ts: number, range: TimeRange): boolean {
  return ts >= range.start && ts < range.end;
}

export function selectCandlesInRange<T extends { time: Time }>(candles: T[], range: TimeRange): T[] {
  return candles.filter((candle) => isTimeInsideRange(candle.time as number, range));
}
