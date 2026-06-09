import type { TradingSessionConfig } from "@workspace/api-client-react";

export type TradingSessionKind = "trading" | "market_closed";
export type MarketSessionConfig = TradingSessionConfig & { kind?: TradingSessionKind; days?: number[] };

export function getSessionKind(session: MarketSessionConfig): TradingSessionKind {
  return session.kind === "market_closed" ? "market_closed" : "trading";
}

export function isMarketClosedSession(session: MarketSessionConfig): boolean {
  return getSessionKind(session) === "market_closed";
}

export function isTradingSession(session: MarketSessionConfig): boolean {
  return getSessionKind(session) === "trading";
}

export function isSessionEnabledForDate(session: MarketSessionConfig, date = new Date()): boolean {
  if (!Array.isArray(session.days) || session.days.length === 0) return true;
  return session.days.includes(date.getDay());
}

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
}

function formatTime(hours: number, minutes: number): string {
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function normalizeLocalSessionTime(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  return formatTime(Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0);
}

export function localTimeToUtcTime(localTime: string, _referenceDate = new Date()): string {
  return normalizeLocalSessionTime(localTime);
}

export function utcTimeToLocalTime(utcTime: string, _referenceDate = new Date()): string {
  return normalizeLocalSessionTime(utcTime);
}

export function legacyUtcTimeToLocalSessionTime(utcTime: string, referenceDate = new Date()): string {
  const [hours, minutes] = utcTime.split(":").map(Number);
  const date = new Date(referenceDate);
  date.setUTCHours(Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  return formatTime(date.getHours(), date.getMinutes());
}

export function getLocalTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "Local";
}

export function getLocalTimeZoneLabel(): string {
  const timeZone = getLocalTimeZone();
  return timeZone === "Local" ? "fuso locale" : timeZone.replace(/_/g, " ");
}

export function getLocalClockHours(date = new Date()): number {
  return date.getHours() + date.getMinutes() / 60;
}

export function getLocalDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function toDailyIntervals(openMinutes: number, closeMinutes: number): [number, number][] {
  if (openMinutes === closeMinutes) return [[0, 1440]];
  if (openMinutes < closeMinutes) return [[openMinutes, closeMinutes]];
  return [[openMinutes, 1440], [0, closeMinutes]];
}

export function intervalsOverlap(a: [number, number], b: [number, number]): boolean {
  return a[0] < b[1] && b[0] < a[1];
}

export function detectTradingSessionOverlap(sessions: MarketSessionConfig[]): string | null {
  const enabledTradingSessions = sessions.filter((session) => session.enabled && isTradingSession(session));

  for (let i = 0; i < enabledTradingSessions.length; i++) {
    for (let j = i + 1; j < enabledTradingSessions.length; j++) {
      const first = enabledTradingSessions[i];
      const second = enabledTradingSessions[j];
      const firstIntervals = toDailyIntervals(timeToMinutes(first.openUTC), timeToMinutes(first.closeUTC));
      const secondIntervals = toDailyIntervals(timeToMinutes(second.openUTC), timeToMinutes(second.closeUTC));

      if (firstIntervals.some((a) => secondIntervals.some((b) => intervalsOverlap(a, b)))) {
        return `"${first.name}" e "${second.name}" si sovrappongono`;
      }
    }
  }

  return null;
}
