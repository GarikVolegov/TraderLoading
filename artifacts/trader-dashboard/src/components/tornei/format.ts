// Helper di formattazione puri per la UI dei Tornei.

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export type CountdownParts = { d: number; h: number; m: number; s: number; done: boolean };

export function countdownParts(targetMs: number, nowMs: number): CountdownParts {
  let delta = Math.max(0, Math.floor((targetMs - nowMs) / 1000));
  const d = Math.floor(delta / 86400);
  delta -= d * 86400;
  const h = Math.floor(delta / 3600);
  delta -= h * 3600;
  const m = Math.floor(delta / 60);
  const s = delta - m * 60;
  return { d, h, m, s, done: targetMs <= nowMs };
}

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function formatRangeDate(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(locale, { day: "numeric", month: "short" });
}

export function fmtR(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}R`;
}
