type RelativeTimeOptions = {
  nowMs?: number;
};

function now(options?: RelativeTimeOptions): number {
  return options?.nowMs ?? Date.now();
}

export function formatItalianNewsRelativeTime(isoDate: string | null | undefined, options?: RelativeTimeOptions): string {
  if (!isoDate) return "";

  const then = new Date(isoDate).getTime();
  if (isNaN(then)) return "";

  const diffMs = now(options) - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "adesso";
  if (diffMins < 60) return `${diffMins} min fa`;
  if (diffHours < 24) return `${diffHours}h fa`;
  if (diffDays === 1) return "ieri";
  if (diffDays < 7) return `${diffDays} giorni fa`;
  return new Date(isoDate).toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

export function formatCompactItalianRelativeTime(dateStr: string, options?: RelativeTimeOptions): string {
  const diff = now(options) - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3_600_000);

  if (h < 1) return "poco fa";
  if (h < 24) return `${h}h fa`;
  return `${Math.floor(h / 24)}g fa`;
}

export function formatIntlRelativeTime(isoDate: string, locale: string, options?: RelativeTimeOptions): string {
  const diff = now(options) - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60000);

  try {
    const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    if (minutes < 1) return formatter.format(0, "minute");
    if (minutes < 60) return formatter.format(-minutes, "minute");

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return formatter.format(-hours, "hour");
    return formatter.format(-Math.floor(hours / 24), "day");
  } catch {
    if (minutes < 1) return "now";
    if (minutes < 60) return `${minutes}m`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  }
}
