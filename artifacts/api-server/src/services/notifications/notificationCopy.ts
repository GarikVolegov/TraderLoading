export type NotificationLanguage = "it" | "en" | "es" | "fr" | "de";

interface ServerNotificationCopy {
  sessionTitle: (sessionName: string) => string;
  sessionQuotes: string[];
  chatBody: string;
  socialFollowBody: (actorName: string) => string;
  socialLikeBody: (actorName: string) => string;
  socialCommentBody: (actorName: string) => string;
  dailyReminderTitle: string;
  dailyEmptyBody: string;
  dailyMissionsBody: (pending: number, total: number) => string;
  macroAlertTitle: string;
  macroEventBody: (label: string) => string;
  goalReminderTitle: string;
}

const COPY: Record<NotificationLanguage, ServerNotificationCopy> = {
  it: {
    sessionTitle: (sessionName) => `Sessione ${sessionName} aperta`,
    sessionQuotes: [
      "La disciplina batte il talento quando il talento non e disciplinato.",
      "Ogni sessione e un'opportunita: non sprecarne nemmeno una.",
      "Il mercato premia chi rispetta il piano. Segui il tuo.",
      "Controlla il rischio prima ancora di pensare al profitto.",
      "Proteggi il capitale prima di tutto. Il profitto viene dopo.",
    ],
    chatBody: "Ti ha inviato un messaggio",
    socialFollowBody: (actorName) => `${actorName} ha iniziato a seguirti`,
    socialLikeBody: (actorName) => `${actorName} ha messo like al tuo post`,
    socialCommentBody: (actorName) => `${actorName} ha commentato il tuo post`,
    dailyReminderTitle: "Promemoria giornaliero",
    dailyEmptyBody: "Inizia le tue missioni di oggi.",
    dailyMissionsBody: (pending, total) => `Missioni oggi: ${pending} da completare su ${total}.`,
    macroAlertTitle: "Evento macro - attenzione",
    macroEventBody: (label) => `1 evento ad alto impatto: ${label}`,
    goalReminderTitle: "Promemoria obiettivo",
  },
  en: {
    sessionTitle: (sessionName) => `${sessionName} session is open`,
    sessionQuotes: [
      "Discipline beats talent when talent is not disciplined.",
      "Every session is an opportunity: do not waste it.",
      "The market rewards traders who respect their plan.",
      "Control risk before thinking about profit.",
      "Protect capital first. Profit comes later.",
    ],
    chatBody: "Sent you a message",
    socialFollowBody: (actorName) => `${actorName} started following you`,
    socialLikeBody: (actorName) => `${actorName} liked your post`,
    socialCommentBody: (actorName) => `${actorName} commented on your post`,
    dailyReminderTitle: "Daily reminder",
    dailyEmptyBody: "Start today's missions.",
    dailyMissionsBody: (pending, total) => `Today's missions: ${pending} left out of ${total}.`,
    macroAlertTitle: "Macro event alert",
    macroEventBody: (label) => `1 high-impact event: ${label}`,
    goalReminderTitle: "Goal reminder",
  },
  es: {
    sessionTitle: (sessionName) => `Sesion ${sessionName} abierta`,
    sessionQuotes: [
      "La disciplina vence al talento cuando el talento no es disciplinado.",
      "Cada sesion es una oportunidad: no la desperdicies.",
      "El mercado premia a quien respeta su plan.",
      "Controla el riesgo antes de pensar en beneficio.",
      "Protege el capital primero. El beneficio viene despues.",
    ],
    chatBody: "Te ha enviado un mensaje",
    socialFollowBody: (actorName) => `${actorName} ha empezado a seguirte`,
    socialLikeBody: (actorName) => `${actorName} dio like a tu post`,
    socialCommentBody: (actorName) => `${actorName} comento tu post`,
    dailyReminderTitle: "Recordatorio diario",
    dailyEmptyBody: "Empieza tus misiones de hoy.",
    dailyMissionsBody: (pending, total) => `Misiones de hoy: ${pending} pendientes de ${total}.`,
    macroAlertTitle: "Alerta de evento macro",
    macroEventBody: (label) => `1 evento de alto impacto: ${label}`,
    goalReminderTitle: "Recordatorio de objetivo",
  },
  fr: {
    sessionTitle: (sessionName) => `Session ${sessionName} ouverte`,
    sessionQuotes: [
      "La discipline bat le talent quand le talent manque de discipline.",
      "Chaque session est une opportunite: ne la gaspillez pas.",
      "Le marche recompense ceux qui respectent leur plan.",
      "Controlez le risque avant de penser au profit.",
      "Protegez le capital d'abord. Le profit vient ensuite.",
    ],
    chatBody: "Vous a envoye un message",
    socialFollowBody: (actorName) => `${actorName} vous suit maintenant`,
    socialLikeBody: (actorName) => `${actorName} a aime votre post`,
    socialCommentBody: (actorName) => `${actorName} a commente votre post`,
    dailyReminderTitle: "Rappel quotidien",
    dailyEmptyBody: "Commencez vos missions du jour.",
    dailyMissionsBody: (pending, total) => `Missions du jour: ${pending} restantes sur ${total}.`,
    macroAlertTitle: "Alerte evenement macro",
    macroEventBody: (label) => `1 evenement a fort impact: ${label}`,
    goalReminderTitle: "Rappel d'objectif",
  },
  de: {
    sessionTitle: (sessionName) => `Session ${sessionName} ist offen`,
    sessionQuotes: [
      "Disziplin schlaegt Talent, wenn Talent nicht diszipliniert ist.",
      "Jede Session ist eine Chance: verschwende sie nicht.",
      "Der Markt belohnt Trader, die ihren Plan respektieren.",
      "Kontrolliere Risiko, bevor du an Gewinn denkst.",
      "Schuetze zuerst das Kapital. Gewinn kommt danach.",
    ],
    chatBody: "Hat dir eine Nachricht gesendet",
    socialFollowBody: (actorName) => `${actorName} folgt dir jetzt`,
    socialLikeBody: (actorName) => `${actorName} hat deinen Beitrag geliked`,
    socialCommentBody: (actorName) => `${actorName} hat deinen Beitrag kommentiert`,
    dailyReminderTitle: "Tageserinnerung",
    dailyEmptyBody: "Starte deine heutigen Missionen.",
    dailyMissionsBody: (pending, total) => `Heutige Missionen: ${pending} von ${total} offen.`,
    macroAlertTitle: "Makroereignis-Alarm",
    macroEventBody: (label) => `1 wichtiges Ereignis: ${label}`,
    goalReminderTitle: "Zielerinnerung",
  },
};

export function getNotificationLanguage(value: unknown): NotificationLanguage {
  const normalized = typeof value === "string" ? value.toLowerCase().slice(0, 2) : "";
  if (normalized === "en" || normalized === "es" || normalized === "fr" || normalized === "de" || normalized === "it") {
    return normalized;
  }
  return "it";
}

export function getServerNotificationCopy(language: unknown): ServerNotificationCopy {
  return COPY[getNotificationLanguage(language)];
}

export function pickSessionQuote(language: unknown): string {
  const copy = getServerNotificationCopy(language);
  return copy.sessionQuotes[Math.floor(Math.random() * copy.sessionQuotes.length)];
}
