/**
 * LIMEN PROTOCOL — Session Engine
 * Canonical trading session schedule based on Europe/Rome (CET/CEST).
 * Aligned with 'La Dottrina del Tempo' and the Trading Cockpit protocol.
 */

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
 * Calculates current market session aligned with Europe/Rome timezone.
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

  // 00:00 - 08:00 Asia (Finestra di ingresso 01:00 - 03:30 CET)
  if (m < 480) {
    const isEntryWindow = m >= 60 && m < 210;
    return {
      name: isEntryWindow ? "SESSIONE ASIA (INGRESSI)" : "SESSIONE ASIA",
      shortName: "ASIA",
      hours: "00:00–08:00 (Ingressi 01:00–03:30)",
      statusColor: isEntryWindow ? "text-primary font-semibold" : "text-muted-foreground",
      isActive: isEntryWindow,
      kind: "asia",
      description: isEntryWindow
        ? "Finestra asiatica attiva: ingressi consentiti solo con sweep accertato."
        : "Sessione asiatica: analisi e preparazione.",
    };
  }

  // 08:00 - 11:30 Londra
  if (m < 690) {
    return {
      name: "SESSIONE LONDRA",
      shortName: "LONDRA",
      hours: "08:00–11:30 CET",
      statusColor: "text-primary font-semibold",
      isActive: true,
      kind: "london",
      description: "Sessione europea primaria: massima liquidità ed espansione mattutina.",
    };
  }

  // 11:30 - 13:30 Lunch / Pausa
  if (m < 810) {
    return {
      name: "LUNCH / TRANSIZIONE",
      shortName: "LUNCH",
      hours: "11:30–13:30 CET",
      statusColor: "text-muted-foreground",
      isActive: false,
      kind: "lunch",
      description: "Fase di rallentamento: nessun nuovo ingresso senza impulso avviato.",
    };
  }

  // 13:30 - 14:00 Pre-New York / Intervallo
  if (m < 840) {
    return {
      name: "PRE-NEW YORK",
      shortName: "PRE-NY",
      hours: "13:30–14:00 CET",
      statusColor: "text-muted-foreground",
      isActive: false,
      kind: "pre_ny",
      description: "Intervallo pre-mercato americano: preparazione livelli e news US.",
    };
  }

  // 14:00 - 18:00 New York (Scalp primario & Core)
  if (m < 1080) {
    return {
      name: "SESSIONE NEW YORK",
      shortName: "NEW YORK",
      hours: "14:00–18:00 CET",
      statusColor: "text-primary font-semibold",
      isActive: true,
      kind: "ny",
      description: "Sessione americana principale: volatilità istituzionale e caccia di liquidità.",
    };
  }

  // 18:00 - 22:00 Swing / Tarda sera
  if (m < 1320) {
    return {
      name: "SESSIONE SWING / SERA",
      shortName: "SWING SERA",
      hours: "18:00–22:00 CET",
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
