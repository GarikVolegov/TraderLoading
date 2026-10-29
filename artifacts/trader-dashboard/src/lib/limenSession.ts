/**
 * LIMEN PROTOCOL — Session Engine
 * Canonical trading session schedule based on Europe/Rome (CET/CEST).
 * Aligned with 'La Dottrina del Tempo' and the Trading Cockpit protocol.
 * Supports user-configured personal session hours via loadSessionPreferences().
 */
import { loadSessionPreferences } from "@/components/chartSessionTime";

function parseTimeToMin(str: string, fallbackMin: number): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(str.trim());
  if (!m) return fallbackMin;
  return Number(m[1]) * 60 + Number(m[2]);
}

function isMinInWindow(currentMin: number, startMin: number, endMin: number): boolean {
  if (startMin <= endMin) {
    return currentMin >= startMin && currentMin < endMin;
  }
  return currentMin >= startMin || currentMin < endMin;
}

export interface LimenSessionInfo {
  name: string;
  shortName: string;
  hours: string;
  statusColor: string;
  isActive: boolean;
  kind: "asia" | "london" | "lunch" | "pre_ny" | "ny" | "swing" | "closed" | "weekend";
  description: string;
}

/**
 * Calculates current market session aligned with Europe/Rome timezone
 * and synchronized with any custom session hours configured by the operator.
 */
export function getLimenSessionInfo(d: Date = new Date()): LimenSessionInfo {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Rome",
    weekday: "short",
  }).format(d);

  if (["Sat", "Sun"].includes(weekday)) {
    return {
      name: "WEEKEND / MERCATO CHIUSO",
      shortName: "WEEKEND",
      hours: "Riapertura Domenica 23:00 CET",
      statusColor: "text-muted-foreground",
      isActive: false,
      kind: "weekend",
      description: "Mercati chiusi. Preparazione della settimana e backtest.",
    };
  }

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome",
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(d);

  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const m = hour * 60 + minute;

  const prefs = loadSessionPreferences();
  const asiaPref = prefs.items.find((s) => s.id === "asia");
  const londonPref = prefs.items.find((s) => s.id === "london");
  const nyPref = prefs.items.find((s) => s.id === "newYork");

  const asiaStart = parseTimeToMin(asiaPref?.startTime ?? "00:00", 0);
  const asiaEnd = parseTimeToMin(asiaPref?.endTime ?? "08:00", 480);
  const londonStart = parseTimeToMin(londonPref?.startTime ?? "08:00", 480);
  const londonEnd = parseTimeToMin(londonPref?.endTime ?? "11:30", 690);
  const nyStart = parseTimeToMin(nyPref?.startTime ?? "14:00", 840);
  const nyEnd = parseTimeToMin(nyPref?.endTime ?? "18:00", 1080);

  // Controllo prioritario su New York e Londra con orari personalizzati
  if (isMinInWindow(m, nyStart, nyEnd)) {
    const label = nyPref?.shortLabel || "NEW YORK";
    const hrs = `${nyPref?.startTime ?? "14:00"}–${nyPref?.endTime ?? "18:00"} CET`;
    return {
      name: `SESSIONE ${label.toUpperCase()}`,
      shortName: label.toUpperCase(),
      hours: hrs,
      statusColor: "text-primary font-semibold",
      isActive: true,
      kind: "ny",
      description: "Sessione americana principale: volatilità istituzionale e caccia di liquidità.",
    };
  }

  if (isMinInWindow(m, londonStart, londonEnd)) {
    const label = londonPref?.shortLabel || "LONDRA";
    const hrs = `${londonPref?.startTime ?? "08:00"}–${londonPref?.endTime ?? "11:30"} CET`;
    return {
      name: `SESSIONE ${label.toUpperCase()}`,
      shortName: label.toUpperCase(),
      hours: hrs,
      statusColor: "text-primary font-semibold",
      isActive: true,
      kind: "london",
      description: "Sessione europea primaria: massima liquidità ed espansione mattutina.",
    };
  }

  if (isMinInWindow(m, asiaStart, asiaEnd)) {
    const isEntryWindow = m >= 60 && m < 210;
    const label = asiaPref?.shortLabel || "ASIA";
    const hrs = `${asiaPref?.startTime ?? "00:00"}–${asiaPref?.endTime ?? "08:00"} CET`;
    return {
      name: isEntryWindow ? `SESSIONE ${label.toUpperCase()} (INGRESSI)` : `SESSIONE ${label.toUpperCase()}`,
      shortName: label.toUpperCase(),
      hours: hrs,
      statusColor: isEntryWindow ? "text-primary font-semibold" : "text-muted-foreground",
      isActive: true,
      kind: "asia",
      description: isEntryWindow
        ? "Finestra asiatica attiva: ingressi consentiti solo con sweep accertato."
        : "Sessione asiatica: analisi e preparazione.",
    };
  }

  // Intervalli di transizione tra le sessioni personalizzate
  if (m >= londonEnd && m < nyStart - 30) {
    return {
      name: "LUNCH / TRANSIZIONE",
      shortName: "LUNCH",
      hours: `${londonPref?.endTime ?? "11:30"}–13:30 CET`,
      statusColor: "text-muted-foreground",
      isActive: false,
      kind: "lunch",
      description: "Fase di rallentamento: nessun nuovo ingresso senza impulso avviato.",
    };
  }

  if (m >= nyStart - 30 && m < nyStart) {
    return {
      name: "PRE-NEW YORK",
      shortName: "PRE-NY",
      hours: `Pre-${nyPref?.startTime ?? "14:00"} CET`,
      statusColor: "text-muted-foreground",
      isActive: false,
      kind: "pre_ny",
      description: "Intervallo pre-mercato americano: preparazione livelli e news US.",
    };
  }

  // 18:00 - 22:00 Swing / Tarda sera
  if (m >= nyEnd && m < 1320) {
    return {
      name: "SESSIONE SWING / SERA",
      shortName: "SWING SERA",
      hours: `${nyPref?.endTime ?? "18:00"}–22:00 CET`,
      statusColor: "text-primary font-semibold",
      isActive: true,
      kind: "swing",
      description: "Tarda sessione: riservata a posizioni Swing con target multiday.",
    };
  }

  // 22:00 - 24:00 Chiusura / Pre-Asia
  return {
    name: "CHIUSURA / PRE-ASIA",
    shortName: "CHIUSURA",
    hours: "22:00–00:00 CET",
    statusColor: "text-muted-foreground",
    isActive: false,
    kind: "closed",
    description: "Mercati occidentali chiusi. Attesa apertura sessione asiatica.",
  };
}

export interface MarketSessionTrack {
  id: "asia" | "london" | "ny";
  name: string;
  hours: string;
  isOpen: boolean;
  isKillzone: boolean;
  killzoneName?: string;
}

export interface RichMarketOverview {
  currentSession: LimenSessionInfo;
  sessions: MarketSessionTrack[];
  activeKillzone: string | null;
  nextSessionText: string;
  isWeekend: boolean;
  romeTime: string;
  utcTime: string;
}

export function getRichMarketSessions(d: Date = new Date()): RichMarketOverview {
  const currentSession = getLimenSessionInfo(d);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Rome",
    weekday: "short",
  }).format(d);
  const isWeekend = ["Sat", "Sun"].includes(weekday);

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome",
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(d);

  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const m = hour * 60 + minute;

  const romeTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  const utcParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(d);
  const utcHour = utcParts.find((p) => p.type === "hour")?.value ?? "00";
  const utcMinute = utcParts.find((p) => p.type === "minute")?.value ?? "00";
  const utcTime = `${utcHour}:${utcMinute}`;

  const prefs = loadSessionPreferences();
  const asiaPref = prefs.items.find((s) => s.id === "asia");
  const londonPref = prefs.items.find((s) => s.id === "london");
  const nyPref = prefs.items.find((s) => s.id === "newYork");
  const c1Pref = prefs.items.find((s) => s.id === "custom1");
  const c2Pref = prefs.items.find((s) => s.id === "custom2");

  const asiaStart = parseTimeToMin(asiaPref?.startTime ?? "00:00", 0);
  const asiaEnd = parseTimeToMin(asiaPref?.endTime ?? "08:00", 480);
  const londonStart = parseTimeToMin(londonPref?.startTime ?? "08:00", 480);
  const londonEnd = parseTimeToMin(londonPref?.endTime ?? "11:30", 690);
  const nyStart = parseTimeToMin(nyPref?.startTime ?? "14:00", 840);
  const nyEnd = parseTimeToMin(nyPref?.endTime ?? "18:00", 1080);

  const asiaKillzone = !isWeekend && m >= 60 && m < 210;
  const londonKillzone = !isWeekend && m >= londonStart && m < Math.min(londonEnd, londonStart + 120);
  const nyKillzone = !isWeekend && m >= nyStart && m < Math.min(nyEnd, nyStart + 120);

  const sessions: MarketSessionTrack[] = [
    {
      id: "asia",
      name: asiaPref?.shortLabel || "Asia",
      hours: `${asiaPref?.startTime ?? "00:00"}–${asiaPref?.endTime ?? "08:00"}`,
      isOpen: !isWeekend && isMinInWindow(m, asiaStart, asiaEnd),
      isKillzone: asiaKillzone,
      killzoneName: "Ingressi Sweep (01:00–03:30)",
    },
    {
      id: "london",
      name: londonPref?.shortLabel || "Londra",
      hours: `${londonPref?.startTime ?? "08:00"}–${londonPref?.endTime ?? "11:30"}`,
      isOpen: !isWeekend && isMinInWindow(m, londonStart, londonEnd),
      isKillzone: londonKillzone,
      killzoneName: `London Open (${londonPref?.startTime ?? "08:00"}–10:00)`,
    },
    {
      id: "ny",
      name: nyPref?.shortLabel || "New York",
      hours: `${nyPref?.startTime ?? "14:00"}–${nyPref?.endTime ?? "18:00"}`,
      isOpen: !isWeekend && isMinInWindow(m, nyStart, nyEnd),
      isKillzone: nyKillzone,
      killzoneName: `NY Open (${nyPref?.startTime ?? "14:00"}–16:00)`,
    },
  ];

  let activeKillzone: string | null = null;
  if (!isWeekend && c1Pref?.enabled && isMinInWindow(m, parseTimeToMin(c1Pref.startTime, 480), parseTimeToMin(c1Pref.endTime, 600))) {
    activeKillzone = `${c1Pref.name} (${c1Pref.startTime}–${c1Pref.endTime})`;
  } else if (!isWeekend && c2Pref?.enabled && isMinInWindow(m, parseTimeToMin(c2Pref.startTime, 870), parseTimeToMin(c2Pref.endTime, 990))) {
    activeKillzone = `${c2Pref.name} (${c2Pref.startTime}–${c2Pref.endTime})`;
  } else if (asiaKillzone) activeKillzone = "Asia Sweep Zone (01:00–03:30)";
  else if (londonKillzone) activeKillzone = `London Open Killzone (${londonPref?.startTime ?? "08:00"}–10:00)`;
  else if (nyKillzone) activeKillzone = `NY Open Killzone (${nyPref?.startTime ?? "14:00"}–16:00)`;

  let nextSessionText = "";
  if (isWeekend) {
    nextSessionText = "Riapertura Domenica 23:00 CET";
  } else if (m < londonStart) {
    const remMin = londonStart - m;
    const h = Math.floor(remMin / 60);
    const min = remMin % 60;
    nextSessionText = `Apertura Londra tra ${h}h ${min}m`;
  } else if (m < nyStart) {
    const remMin = nyStart - m;
    const h = Math.floor(remMin / 60);
    const min = remMin % 60;
    nextSessionText = `Apertura New York tra ${h}h ${min}m`;
  } else if (m < nyEnd) {
    const remMin = nyEnd - m;
    const h = Math.floor(remMin / 60);
    const min = remMin % 60;
    nextSessionText = `Chiusura New York tra ${h}h ${min}m`;
  } else {
    nextSessionText = `Apertura Asia alle ${asiaPref?.startTime ?? "00:00"} CET`;
  }

  return {
    currentSession,
    sessions,
    activeKillzone,
    nextSessionText,
    isWeekend,
    romeTime,
    utcTime,
  };
}
