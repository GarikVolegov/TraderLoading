export type ScheduledCallVisualPreset = "bank" | "broker" | "risk" | "custom";
export type ScheduledCallRingtone = "institutional" | "digital" | "gentle" | "pulse";
export type ScheduledCallVibration = "standard" | "urgent" | "silent";

export interface ScheduledCallConfig {
  id: string;
  enabled: boolean;
  callerName: string;
  department: string;
  notificationTitle: string;
  notificationBody: string;
  callMessage: string;
  time: string;
  days: number[];
  timezone: string;
  iconUrl?: string;
  logoText?: string;
  visualPreset: ScheduledCallVisualPreset;
  accentColor: string;
  ringtone: ScheduledCallRingtone;
  vibration: ScheduledCallVibration;
  requireInteraction: boolean;
  snoozeMins: number;
  primaryActionLabel: string;
  secondaryActionLabel: string;
}

interface PersistedScheduledCalls {
  version: 1;
  calls: ScheduledCallConfig[];
}

export const DEFAULT_SCHEDULED_CALL: ScheduledCallConfig = {
  id: "scheduled-call",
  enabled: true,
  callerName: "Banca - Ufficio Risk",
  department: "Controllo Operativo",
  notificationTitle: "Chiamata dalla banca",
  notificationBody: "Controllo operativo richiesto",
  callMessage: "Verifica il piano e conferma la tua disciplina operativa.",
  time: "09:00",
  days: [],
  timezone: "Europe/Rome",
  logoText: "BK",
  visualPreset: "bank",
  accentColor: "#c9a227",
  ringtone: "institutional",
  vibration: "standard",
  requireInteraction: true,
  snoozeMins: 10,
  primaryActionLabel: "Apri chiamata",
  secondaryActionLabel: "Chiudi",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isTime(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function normalizeDays(days: unknown): number[] {
  if (!Array.isArray(days)) return [];
  return [...new Set(days.filter((day): day is number => Number.isInteger(day) && day >= 0 && day <= 6))];
}

function normalizeTimezone(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Rome";
  } catch {
    return "Europe/Rome";
  }
}

function normalizePreset(value: unknown): ScheduledCallVisualPreset {
  return value === "broker" || value === "risk" || value === "custom" || value === "bank" ? value : "bank";
}

function normalizeRingtone(value: unknown): ScheduledCallRingtone {
  return value === "digital" || value === "gentle" || value === "pulse" || value === "institutional" ? value : "institutional";
}

function normalizeVibration(value: unknown): ScheduledCallVibration {
  return value === "urgent" || value === "silent" || value === "standard" ? value : "standard";
}

function parseCall(value: unknown): ScheduledCallConfig | null {
  if (!isRecord(value) || typeof value.id !== "string" || !value.id.trim()) return null;
  if (typeof value.callerName !== "string" || !value.callerName.trim()) return null;
  if (!isTime(value.time)) return null;

  return {
    ...DEFAULT_SCHEDULED_CALL,
    id: value.id,
    enabled: typeof value.enabled === "boolean" ? value.enabled : DEFAULT_SCHEDULED_CALL.enabled,
    callerName: value.callerName,
    department: typeof value.department === "string" ? value.department : DEFAULT_SCHEDULED_CALL.department,
    notificationTitle: typeof value.notificationTitle === "string" && value.notificationTitle.trim()
      ? value.notificationTitle
      : value.callerName,
    notificationBody: typeof value.notificationBody === "string" ? value.notificationBody : DEFAULT_SCHEDULED_CALL.notificationBody,
    callMessage: typeof value.callMessage === "string" ? value.callMessage : DEFAULT_SCHEDULED_CALL.callMessage,
    time: value.time,
    days: normalizeDays(value.days),
    timezone: normalizeTimezone(value.timezone),
    iconUrl: typeof value.iconUrl === "string" && value.iconUrl.trim() ? value.iconUrl : undefined,
    logoText: typeof value.logoText === "string" && value.logoText.trim() ? value.logoText.slice(0, 4) : DEFAULT_SCHEDULED_CALL.logoText,
    visualPreset: normalizePreset(value.visualPreset),
    accentColor: typeof value.accentColor === "string" && value.accentColor.trim() ? value.accentColor : DEFAULT_SCHEDULED_CALL.accentColor,
    ringtone: normalizeRingtone(value.ringtone),
    vibration: normalizeVibration(value.vibration),
    requireInteraction: typeof value.requireInteraction === "boolean" ? value.requireInteraction : true,
    snoozeMins: typeof value.snoozeMins === "number" && Number.isFinite(value.snoozeMins)
      ? Math.max(0, Math.min(120, Math.floor(value.snoozeMins)))
      : DEFAULT_SCHEDULED_CALL.snoozeMins,
    primaryActionLabel: typeof value.primaryActionLabel === "string" && value.primaryActionLabel.trim()
      ? value.primaryActionLabel
      : DEFAULT_SCHEDULED_CALL.primaryActionLabel,
    secondaryActionLabel: typeof value.secondaryActionLabel === "string" && value.secondaryActionLabel.trim()
      ? value.secondaryActionLabel
      : DEFAULT_SCHEDULED_CALL.secondaryActionLabel,
  };
}

export function createDefaultScheduledCall(overrides: Partial<ScheduledCallConfig> = {}): ScheduledCallConfig {
  const id = overrides.id ?? `scheduled-call-${Date.now().toString(36)}`;
  const call = parseCall({ ...DEFAULT_SCHEDULED_CALL, ...overrides, id });
  return call ?? { ...DEFAULT_SCHEDULED_CALL, id };
}

export function parseScheduledCalls(raw: unknown): ScheduledCallConfig[] {
  if (!raw) return [];
  try {
    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!isRecord(data) || data.version !== 1 || !Array.isArray(data.calls)) return [];
    return data.calls.map(parseCall).filter((call): call is ScheduledCallConfig => Boolean(call));
  } catch {
    return [];
  }
}

export function serializeScheduledCalls(calls: ScheduledCallConfig[]): string {
  const persisted: PersistedScheduledCalls = {
    version: 1,
    calls: calls.map(parseCall).filter((call): call is ScheduledCallConfig => Boolean(call)),
  };
  return JSON.stringify(persisted);
}

function getLocalParts(date: Date, timezone: string): { weekday: number; time: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const weekdayName = parts.find((part) => part.type === "weekday")?.value ?? "Sun";
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekdayName);
  return { weekday: Math.max(0, weekday), time: `${hour}:${minute}` };
}

export function isScheduledCallDue(call: ScheduledCallConfig, now = new Date()): boolean {
  if (!call.enabled) return false;
  const local = getLocalParts(now, call.timezone);
  const dayMatches = call.days.length === 0 || call.days.includes(local.weekday);
  return dayMatches && local.time === call.time;
}

export function encodeScheduledCallUrl(call: ScheduledCallConfig, basePath = "/"): string {
  const normalizedBase = basePath.endsWith("/") ? basePath : `${basePath}/`;
  return `${normalizedBase}?scheduledCall=${encodeURIComponent(JSON.stringify(call))}`;
}

export function decodeScheduledCallFromLocation(location: string): ScheduledCallConfig | null {
  try {
    const url = new URL(location, "https://traderloading.local");
    const raw = url.searchParams.get("scheduledCall");
    if (!raw) return null;
    return parseCall(JSON.parse(raw));
  } catch {
    return null;
  }
}
