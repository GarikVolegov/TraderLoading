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

// ─── Personalizzazione Sessioni & Orari Personali (AUREUS PROTOCOL) ──────────

export type CustomSessionId = "asia" | "london" | "newYork" | "custom1" | "custom2";

export interface SessionPreferenceItem {
  id: CustomSessionId;
  name: string;
  shortLabel: string;
  enabled: boolean;
  favorite: boolean;
  startTime: string; // Formato "HH:MM" (Europe/Rome CET)
  endTime: string;   // Formato "HH:MM" (Europe/Rome CET)
  color: string;     // Hex es. "#C5A059"
  opacity: number;   // 0.02 .. 0.50
  showBorders: boolean;
  showLabel: boolean;
  showHighLowLabels?: boolean;
  showSweepBadges?: boolean;
  extendHighLowLines?: boolean;
}

export interface SessionPreferencesState {
  onlyFavorites: boolean;
  soundAlertOnSweep?: boolean;
  showSweepBadges?: boolean;
  items: SessionPreferenceItem[];
}

export const SESSION_PREFERENCES_STORAGE_KEY = "aureus_chart_session_preferences_v1";
export const SESSION_PREFERENCES_EVENT = "aureus:session-preferences-updated";

export const DEFAULT_SESSION_ITEMS: SessionPreferenceItem[] = [
  {
    id: "asia",
    name: "Sessione Asiatica",
    shortLabel: "ASIA",
    enabled: true,
    favorite: true,
    startTime: "00:00",
    endTime: "08:00",
    color: "#C5A059",
    opacity: 0.08,
    showBorders: true,
    showLabel: true,
    showHighLowLabels: false,
    showSweepBadges: false,
    extendHighLowLines: false,
  },
  {
    id: "london",
    name: "Sessione Europea (Londra)",
    shortLabel: "LONDRA",
    enabled: true,
    favorite: true,
    startTime: "08:00",
    endTime: "17:00",
    color: "#10B981",
    opacity: 0.08,
    showBorders: true,
    showLabel: true,
    showHighLowLabels: false,
    showSweepBadges: false,
    extendHighLowLines: false,
  },
  {
    id: "newYork",
    name: "Sessione Americana (New York)",
    shortLabel: "NY",
    enabled: true,
    favorite: true,
    startTime: "14:30",
    endTime: "23:00",
    color: "#60A5FA",
    opacity: 0.08,
    showBorders: true,
    showLabel: true,
    showHighLowLabels: false,
    showSweepBadges: false,
    extendHighLowLines: false,
  },
  {
    id: "custom1",
    name: "Finestra Personale I (Killzone Mattina)",
    shortLabel: "KZ MATTINA",
    enabled: false,
    favorite: false,
    startTime: "08:00",
    endTime: "10:30",
    color: "#A855F7",
    opacity: 0.10,
    showBorders: true,
    showLabel: true,
    showHighLowLabels: false,
    showSweepBadges: false,
    extendHighLowLines: false,
  },
  {
    id: "custom2",
    name: "Finestra Personale II (Killzone Pomeriggio)",
    shortLabel: "KZ NY",
    enabled: false,
    favorite: false,
    startTime: "14:00",
    endTime: "16:30",
    color: "#F43F5E",
    opacity: 0.10,
    showBorders: true,
    showLabel: true,
    showHighLowLabels: false,
    showSweepBadges: false,
    extendHighLowLines: false,
  },
];

export const DEFAULT_SESSION_PREFERENCES: SessionPreferencesState = {
  onlyFavorites: false,
  soundAlertOnSweep: true,
  showSweepBadges: false,
  items: DEFAULT_SESSION_ITEMS,
};

export const SESSION_PRESET_CONFIGS: Record<
  "standard" | "aureus" | "ict",
  { label: string; description: string; items: SessionPreferenceItem[] }
> = {
  standard: {
    label: "Standard Istituzionale",
    description: "Orari bancari completi: Asia 00–08, Londra 08–17, NY 14:30–23",
    items: DEFAULT_SESSION_ITEMS,
  },
  aureus: {
    label: "Canone AUREUS (Finestre Core)",
    description: "Finestre operative d'élite: Asia Sweep 01–03:30, Londra 08–11:30, NY 14–18",
    items: [
      {
        id: "asia",
        name: "Asia Sweep (Ingressi)",
        shortLabel: "ASIA SWEEP",
        enabled: true,
        favorite: true,
        startTime: "01:00",
        endTime: "03:30",
        color: "#C5A059",
        opacity: 0.1,
        showBorders: true,
        showLabel: true,
      },
      {
        id: "london",
        name: "Londra Core",
        shortLabel: "LONDRA",
        enabled: true,
        favorite: true,
        startTime: "08:00",
        endTime: "11:30",
        color: "#10B981",
        opacity: 0.1,
        showBorders: true,
        showLabel: true,
      },
      {
        id: "newYork",
        name: "New York Core",
        shortLabel: "NEW YORK",
        enabled: true,
        favorite: true,
        startTime: "14:00",
        endTime: "18:00",
        color: "#60A5FA",
        opacity: 0.1,
        showBorders: true,
        showLabel: true,
      },
      {
        id: "custom1",
        name: "Swing Sera",
        shortLabel: "SWING",
        enabled: false,
        favorite: false,
        startTime: "18:00",
        endTime: "22:00",
        color: "#A855F7",
        opacity: 0.08,
        showBorders: true,
        showLabel: true,
      },
      {
        id: "custom2",
        name: "Finestra Personale II",
        shortLabel: "CUSTOM II",
        enabled: false,
        favorite: false,
        startTime: "13:30",
        endTime: "15:00",
        color: "#F43F5E",
        opacity: 0.1,
        showBorders: true,
        showLabel: true,
      },
    ],
  },
  ict: {
    label: "ICT Killzones",
    description: "Killzones algoritmiche: Asia 02–05, LDN Open 08–11, NY Open 13–16, LDN Close 16–18",
    items: [
      {
        id: "asia",
        name: "ICT Asian Killzone",
        shortLabel: "ASIA KZ",
        enabled: true,
        favorite: true,
        startTime: "02:00",
        endTime: "05:00",
        color: "#C5A059",
        opacity: 0.11,
        showBorders: true,
        showLabel: true,
      },
      {
        id: "london",
        name: "ICT London Open Killzone",
        shortLabel: "LDN OPEN",
        enabled: true,
        favorite: true,
        startTime: "08:00",
        endTime: "11:00",
        color: "#10B981",
        opacity: 0.11,
        showBorders: true,
        showLabel: true,
      },
      {
        id: "newYork",
        name: "ICT NY Open Killzone",
        shortLabel: "NY OPEN",
        enabled: true,
        favorite: true,
        startTime: "13:00",
        endTime: "16:00",
        color: "#60A5FA",
        opacity: 0.11,
        showBorders: true,
        showLabel: true,
      },
      {
        id: "custom1",
        name: "ICT London Close Killzone",
        shortLabel: "LDN CLOSE",
        enabled: true,
        favorite: true,
        startTime: "16:00",
        endTime: "18:00",
        color: "#A855F7",
        opacity: 0.1,
        showBorders: true,
        showLabel: true,
      },
      {
        id: "custom2",
        name: "Silver Bullet NY",
        shortLabel: "SILVER BULLET",
        enabled: false,
        favorite: false,
        startTime: "16:00",
        endTime: "17:00",
        color: "#F43F5E",
        opacity: 0.14,
        showBorders: true,
        showLabel: true,
      },
    ],
  },
};

export function parseTimeHHMM(
  hhmm: string,
  fallbackH: number,
  fallbackM: number,
): { hour: number; minute: number } {
  const match = /^(\d{1,2}):(\d{2})$/.exec((hhmm || "").trim());
  if (!match) return { hour: fallbackH, minute: fallbackM };
  const h = Math.max(0, Math.min(23, Number(match[1])));
  const m = Math.max(0, Math.min(59, Number(match[2])));
  return { hour: h, minute: m };
}

export function getCustomSessionRangeForTime(
  ts: number,
  startTime: string,
  endTime: string,
): TimeRange {
  const dayStart = getEuropeRomeDayRangeForTime(ts).start;
  const day = { ...getRomeParts(dayStart), hour: 0, minute: 0 };
  const s = parseTimeHHMM(startTime, 0, 0);
  const e = parseTimeHHMM(endTime, 8, 0);
  return rangeForRomeClock(day, s.hour, s.minute, e.hour, e.minute);
}

export function hexToRgba(hex: string, alpha: number): string {
  const clean = (hex || "#C5A059").replace("#", "").trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16) || 197;
    const g = parseInt(clean[1] + clean[1], 16) || 160;
    const b = parseInt(clean[2] + clean[2], 16) || 89;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const r = parseInt(clean.slice(0, 2), 16) || 197;
  const g = parseInt(clean.slice(2, 4), 16) || 160;
  const b = parseInt(clean.slice(4, 6), 16) || 89;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function loadSessionPreferences(): SessionPreferencesState {
  if (typeof window === "undefined") return DEFAULT_SESSION_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(SESSION_PREFERENCES_STORAGE_KEY);
    if (!raw) return DEFAULT_SESSION_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<SessionPreferencesState>;
    if (!parsed || !Array.isArray(parsed.items)) return DEFAULT_SESSION_PREFERENCES;

    const mergedItems: SessionPreferenceItem[] = DEFAULT_SESSION_ITEMS.map((def) => {
      const found = parsed.items?.find((it) => it && it.id === def.id);
      if (!found) return def;
      return {
        ...def,
        name: typeof found.name === "string" && found.name.trim() ? found.name.trim() : def.name,
        shortLabel:
          typeof found.shortLabel === "string" && found.shortLabel.trim()
            ? found.shortLabel.trim()
            : def.shortLabel,
        enabled: typeof found.enabled === "boolean" ? found.enabled : def.enabled,
        favorite: typeof found.favorite === "boolean" ? found.favorite : def.favorite,
        startTime:
          typeof found.startTime === "string" && /^\d{1,2}:\d{2}$/.test(found.startTime)
            ? found.startTime
            : def.startTime,
        endTime:
          typeof found.endTime === "string" && /^\d{1,2}:\d{2}$/.test(found.endTime)
            ? found.endTime
            : def.endTime,
        color: typeof found.color === "string" && found.color.startsWith("#") ? found.color : def.color,
        opacity:
          typeof found.opacity === "number" && found.opacity >= 0.01 && found.opacity <= 0.5
            ? found.opacity
            : def.opacity,
        showBorders: typeof found.showBorders === "boolean" ? found.showBorders : def.showBorders,
        showLabel: typeof found.showLabel === "boolean" ? found.showLabel : def.showLabel,
        showHighLowLabels:
          typeof found.showHighLowLabels === "boolean"
            ? found.showHighLowLabels
            : (def.showHighLowLabels ?? false),
        showSweepBadges:
          typeof found.showSweepBadges === "boolean"
            ? found.showSweepBadges
            : (def.showSweepBadges ?? false),
        extendHighLowLines:
          typeof found.extendHighLowLines === "boolean"
            ? found.extendHighLowLines
            : (def.extendHighLowLines ?? false),
      };
    });

    return {
      onlyFavorites: Boolean(parsed.onlyFavorites),
      soundAlertOnSweep: typeof parsed.soundAlertOnSweep === "boolean" ? parsed.soundAlertOnSweep : true,
      showSweepBadges: typeof parsed.showSweepBadges === "boolean" ? parsed.showSweepBadges : false,
      items: mergedItems,
    };
  } catch {
    return DEFAULT_SESSION_PREFERENCES;
  }
}

export function saveSessionPreferences(next: SessionPreferencesState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SESSION_PREFERENCES_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(SESSION_PREFERENCES_EVENT, { detail: next }));
  } catch {
    // ignore storage errors
  }
}
