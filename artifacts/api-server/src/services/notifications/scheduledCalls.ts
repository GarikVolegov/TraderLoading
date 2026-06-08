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

export interface ScheduledCallPushPayload {
  title: string;
  body: string;
  tag: string;
  icon?: string;
  badge?: string;
  requireInteraction: boolean;
  vibrate: number[];
  actions: Array<{ action: string; title: string }>;
  data: {
    url: string;
    scheduledCall: ScheduledCallConfig;
  };
}

const DEFAULT_CALL: ScheduledCallConfig = {
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

function normalizeDays(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((day): day is number => Number.isInteger(day) && day >= 0 && day <= 6))];
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
    ...DEFAULT_CALL,
    id: value.id,
    enabled: typeof value.enabled === "boolean" ? value.enabled : DEFAULT_CALL.enabled,
    callerName: value.callerName,
    department: typeof value.department === "string" ? value.department : DEFAULT_CALL.department,
    notificationTitle: typeof value.notificationTitle === "string" && value.notificationTitle.trim()
      ? value.notificationTitle
      : value.callerName,
    notificationBody: typeof value.notificationBody === "string" ? value.notificationBody : DEFAULT_CALL.notificationBody,
    callMessage: typeof value.callMessage === "string" ? value.callMessage : DEFAULT_CALL.callMessage,
    time: value.time,
    days: normalizeDays(value.days),
    timezone: typeof value.timezone === "string" && value.timezone.trim() ? value.timezone : "Europe/Rome",
    iconUrl: typeof value.iconUrl === "string" && value.iconUrl.trim() ? value.iconUrl : undefined,
    logoText: typeof value.logoText === "string" && value.logoText.trim() ? value.logoText.slice(0, 4) : DEFAULT_CALL.logoText,
    visualPreset: normalizePreset(value.visualPreset),
    accentColor: typeof value.accentColor === "string" && value.accentColor.trim() ? value.accentColor : DEFAULT_CALL.accentColor,
    ringtone: normalizeRingtone(value.ringtone),
    vibration: normalizeVibration(value.vibration),
    requireInteraction: typeof value.requireInteraction === "boolean" ? value.requireInteraction : DEFAULT_CALL.requireInteraction,
    snoozeMins: typeof value.snoozeMins === "number" && Number.isFinite(value.snoozeMins)
      ? Math.max(0, Math.min(120, Math.floor(value.snoozeMins)))
      : DEFAULT_CALL.snoozeMins,
    primaryActionLabel: typeof value.primaryActionLabel === "string" && value.primaryActionLabel.trim()
      ? value.primaryActionLabel
      : DEFAULT_CALL.primaryActionLabel,
    secondaryActionLabel: typeof value.secondaryActionLabel === "string" && value.secondaryActionLabel.trim()
      ? value.secondaryActionLabel
      : DEFAULT_CALL.secondaryActionLabel,
  };
}

export function parseScheduledCallConfigs(raw: unknown): ScheduledCallConfig[] {
  if (!raw) return [];
  try {
    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!isRecord(data) || data.version !== 1 || !Array.isArray(data.calls)) return [];
    return data.calls.map(parseCall).filter((call): call is ScheduledCallConfig => Boolean(call));
  } catch {
    return [];
  }
}

function getLocalParts(date: Date, timezone: string): { weekday: number; dateTime: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  const time = `${get("hour")}:${get("minute")}`;
  return {
    weekday: Math.max(0, weekday),
    dateTime: `${get("year")}-${get("month")}-${get("day")}T${time}`,
    time,
  };
}

export function isServerScheduledCallDue(call: ScheduledCallConfig, now = new Date()): boolean {
  if (!call.enabled) return false;
  const local = getLocalParts(now, call.timezone);
  const dayMatches = call.days.length === 0 || call.days.includes(local.weekday);
  return dayMatches && local.time === call.time;
}

export function getScheduledCallVibration(vibration: ScheduledCallVibration): number[] {
  if (vibration === "silent") return [];
  if (vibration === "urgent") return [300, 120, 300, 120, 500];
  return [200, 100, 200];
}

export function encodeScheduledCallUrl(call: ScheduledCallConfig, basePath = "/"): string {
  const normalizedBase = basePath.endsWith("/") ? basePath : `${basePath}/`;
  return `${normalizedBase}?scheduledCall=${encodeURIComponent(JSON.stringify(call))}`;
}

export function buildScheduledCallPayload(call: ScheduledCallConfig, basePath = "/"): ScheduledCallPushPayload {
  return {
    title: call.notificationTitle || call.callerName,
    body: call.notificationBody || call.callMessage,
    tag: `scheduled-call:${call.id}`,
    icon: call.iconUrl,
    badge: call.iconUrl,
    requireInteraction: call.requireInteraction,
    vibrate: getScheduledCallVibration(call.vibration),
    actions: [{ action: "open", title: call.primaryActionLabel }],
    data: {
      url: encodeScheduledCallUrl(call, basePath),
      scheduledCall: call,
    },
  };
}

export function buildScheduledCallDedupeKey(userId: string, call: ScheduledCallConfig, now = new Date()): string {
  return `${userId}:${call.id}:${getLocalParts(now, call.timezone).dateTime}`;
}
