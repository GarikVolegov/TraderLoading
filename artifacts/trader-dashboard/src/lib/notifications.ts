import type { Language } from "@/contexts/LanguageContext";

export interface NotificationPrefs {
  sessions: boolean;
  messages: boolean;
  social: boolean;
  goals: boolean;
  dailyReminder: boolean;
  scheduledCalls: boolean;
  macroEvents: boolean;
  brain: boolean;
}

export type NotificationPrefKey = keyof NotificationPrefs;

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  sessions: true,
  messages: true,
  social: true,
  goals: true,
  dailyReminder: true,
  scheduledCalls: true,
  macroEvents: true,
  brain: true,
};

export const NOTIFICATION_PREF_ORDER: NotificationPrefKey[] = [
  "sessions",
  "dailyReminder",
  "scheduledCalls",
  "goals",
  "macroEvents",
  "brain",
  "messages",
  "social",
];

type PrefCopy = Record<NotificationPrefKey, { label: string; description: string }>;

interface NotificationCopy {
  prefs: PrefCopy;
  titles: {
    sessionOpen: (sessionName: string) => string;
    dailyReminder: string;
    goalReminder: string;
    macroAlert: string;
    welcomeSummary: string;
  };
  messages: {
    sessionOpen: string;
    dailyEmpty: string;
    dailyMissions: (pending: number, total: number) => string;
    macroEvents: (count: number, names: string) => string;
  };
}

const IT: NotificationCopy = {
  prefs: {
    sessions: { label: "Sessioni di trading", description: "Avvisi quando una sessione operativa si apre." },
    dailyReminder: { label: "Promemoria giornaliero", description: "Riepilogo missioni e routine della giornata." },
    scheduledCalls: { label: "Chiamate programmate", description: "Chiamate push personalizzate nei giorni e orari scelti." },
    goals: { label: "Obiettivi e scadenze", description: "Promemoria sugli obiettivi impostati nel diario." },
    macroEvents: { label: "Eventi macro", description: "Alert prima delle notizie ad alto impatto." },
    brain: { label: "Brain AI", description: "Setup e analisi rilevanti generati dal cervello." },
    messages: { label: "Messaggi", description: "Chat, risposte e comunicazioni importanti." },
    social: { label: "Social", description: "Follow, like e attivita della community." },
  },
  titles: {
    sessionOpen: (sessionName) => `Sessione ${sessionName} aperta`,
    dailyReminder: "Promemoria giornaliero",
    goalReminder: "Promemoria obiettivo",
    macroAlert: "Evento macro - attenzione",
    welcomeSummary: "Riepilogo di oggi",
  },
  messages: {
    sessionOpen: "Controlla il piano e opera solo se il setup e valido.",
    dailyEmpty: "Inizia le tue missioni di oggi.",
    dailyMissions: (pending, total) => `Missioni oggi: ${pending} da completare su ${total}.`,
    macroEvents: (count, names) => `${count} event${count > 1 ? "i" : "o"} ad alto impatto: ${names}`,
  },
};

const COPIES: Record<Language, NotificationCopy> = {
  it: IT,
  en: {
    prefs: {
      sessions: { label: "Trading sessions", description: "Alerts when an active trading session opens." },
      dailyReminder: { label: "Daily reminder", description: "Summary of today's missions and routine." },
      scheduledCalls: { label: "Scheduled calls", description: "Custom push calls on selected days and times." },
      goals: { label: "Goals and deadlines", description: "Reminders for goals saved in the journal." },
      macroEvents: { label: "Macro events", description: "Alerts before high-impact market events." },
      brain: { label: "Brain AI", description: "Relevant setups and analysis from the AI brain." },
      messages: { label: "Messages", description: "Chat, replies and important communications." },
      social: { label: "Social", description: "Follows, likes and community activity." },
    },
    titles: {
      sessionOpen: (sessionName) => `${sessionName} session is open`,
      dailyReminder: "Daily reminder",
      goalReminder: "Goal reminder",
      macroAlert: "Macro event alert",
      welcomeSummary: "Today's summary",
    },
    messages: {
      sessionOpen: "Check your plan and trade only if the setup is valid.",
      dailyEmpty: "Start today's missions.",
      dailyMissions: (pending, total) => `Today's missions: ${pending} left out of ${total}.`,
      macroEvents: (count, names) => `${count} high-impact event${count > 1 ? "s" : ""}: ${names}`,
    },
  },
  es: {
    prefs: {
      sessions: { label: "Sesiones de trading", description: "Avisos cuando se abre una sesion operativa." },
      dailyReminder: { label: "Recordatorio diario", description: "Resumen de misiones y rutina del dia." },
      scheduledCalls: { label: "Llamadas programadas", description: "Llamadas push personalizadas en dias y horas elegidos." },
      goals: { label: "Objetivos y fechas", description: "Recordatorios de objetivos del diario." },
      macroEvents: { label: "Eventos macro", description: "Alertas antes de noticias de alto impacto." },
      brain: { label: "Brain AI", description: "Setups y analisis relevantes del cerebro AI." },
      messages: { label: "Mensajes", description: "Chat, respuestas y comunicaciones importantes." },
      social: { label: "Social", description: "Follows, likes y actividad de la comunidad." },
    },
    titles: {
      sessionOpen: (sessionName) => `Sesion ${sessionName} abierta`,
      dailyReminder: "Recordatorio diario",
      goalReminder: "Recordatorio de objetivo",
      macroAlert: "Alerta de evento macro",
      welcomeSummary: "Resumen de hoy",
    },
    messages: {
      sessionOpen: "Revisa tu plan y opera solo si el setup es valido.",
      dailyEmpty: "Empieza tus misiones de hoy.",
      dailyMissions: (pending, total) => `Misiones de hoy: ${pending} pendientes de ${total}.`,
      macroEvents: (count, names) => `${count} evento${count > 1 ? "s" : ""} de alto impacto: ${names}`,
    },
  },
  fr: {
    prefs: {
      sessions: { label: "Sessions de trading", description: "Alertes quand une session active s'ouvre." },
      dailyReminder: { label: "Rappel quotidien", description: "Resume des missions et de la routine du jour." },
      scheduledCalls: { label: "Appels programmes", description: "Appels push personnalises aux jours et heures choisis." },
      goals: { label: "Objectifs et echeances", description: "Rappels des objectifs du journal." },
      macroEvents: { label: "Evenements macro", description: "Alertes avant les nouvelles a fort impact." },
      brain: { label: "Brain AI", description: "Setups et analyses pertinents du cerveau AI." },
      messages: { label: "Messages", description: "Chat, reponses et communications importantes." },
      social: { label: "Social", description: "Follows, likes et activite de la communaute." },
    },
    titles: {
      sessionOpen: (sessionName) => `Session ${sessionName} ouverte`,
      dailyReminder: "Rappel quotidien",
      goalReminder: "Rappel d'objectif",
      macroAlert: "Alerte evenement macro",
      welcomeSummary: "Resume du jour",
    },
    messages: {
      sessionOpen: "Verifiez votre plan et tradez seulement si le setup est valide.",
      dailyEmpty: "Commencez vos missions du jour.",
      dailyMissions: (pending, total) => `Missions du jour: ${pending} restantes sur ${total}.`,
      macroEvents: (count, names) => `${count} evenement${count > 1 ? "s" : ""} a fort impact: ${names}`,
    },
  },
  de: {
    prefs: {
      sessions: { label: "Trading-Sitzungen", description: "Hinweise, wenn eine aktive Sitzung startet." },
      dailyReminder: { label: "Tageserinnerung", description: "Zusammenfassung der heutigen Missionen und Routine." },
      scheduledCalls: { label: "Geplante Anrufe", description: "Individuelle Push-Anrufe an ausgewaehlten Tagen und Zeiten." },
      goals: { label: "Ziele und Fristen", description: "Erinnerungen an Ziele aus dem Journal." },
      macroEvents: { label: "Makroereignisse", description: "Alerts vor wichtigen Marktnachrichten." },
      brain: { label: "Brain AI", description: "Relevante Setups und Analysen des AI-Brains." },
      messages: { label: "Nachrichten", description: "Chat, Antworten und wichtige Mitteilungen." },
      social: { label: "Social", description: "Follows, Likes und Community-Aktivitaet." },
    },
    titles: {
      sessionOpen: (sessionName) => `${sessionName} Sitzung ist offen`,
      dailyReminder: "Tageserinnerung",
      goalReminder: "Zielerinnerung",
      macroAlert: "Makroereignis-Alarm",
      welcomeSummary: "Heutige Zusammenfassung",
    },
    messages: {
      sessionOpen: "Pruefe deinen Plan und trade nur bei einem gueltigen Setup.",
      dailyEmpty: "Starte deine heutigen Missionen.",
      dailyMissions: (pending, total) => `Heutige Missionen: ${pending} von ${total} offen.`,
      macroEvents: (count, names) => `${count} wichtige${count > 1 ? "" : "s"} Ereignis${count > 1 ? "se" : ""}: ${names}`,
    },
  },
};

export interface NotificationStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function normalizeNotificationPrefs(input?: Partial<NotificationPrefs> | null): NotificationPrefs {
  return { ...DEFAULT_NOTIFICATION_PREFS, ...(input ?? {}) };
}

export function getNotificationCopy(language: Language): NotificationCopy {
  return COPIES[language] ?? IT;
}

export function shouldNotifyOnce(
  storage: NotificationStorage,
  key: string,
  now = new Date(),
  windowMs = 24 * 60 * 60 * 1000,
): boolean {
  const storageKey = `tl_notification_once:${key}`;
  const previous = Number(storage.getItem(storageKey) ?? 0);
  if (Number.isFinite(previous) && previous > 0 && now.getTime() - previous < windowMs) {
    return false;
  }
  storage.setItem(storageKey, String(now.getTime()));
  return true;
}

export function browserNotificationsAvailable(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}
