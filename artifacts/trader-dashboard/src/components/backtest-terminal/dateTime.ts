/** Native datetime-local values are interpreted explicitly as UTC, never browser time. */
export function utcDateTimeInput(timestamp: number | null | undefined): string {
  return timestamp != null && Number.isFinite(timestamp)
    ? new Date(timestamp * 1000).toISOString().slice(0, 16)
    : "";
}

export function parseUtcDateTimeInput(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const millis = Date.parse(`${value}:00Z`);
  if (!Number.isFinite(millis)) return null;
  // Date.parse normalizes impossible dates (e.g. 30 February): reject those.
  if (new Date(millis).toISOString().slice(0, 16) !== value) return null;
  return Math.floor(millis / 1000);
}

export function formatRomeReplayTime(timestamp: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: "Europe/Rome", day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(new Date(timestamp * 1000));
}

export const formatUtcReplayTime = formatRomeReplayTime;
