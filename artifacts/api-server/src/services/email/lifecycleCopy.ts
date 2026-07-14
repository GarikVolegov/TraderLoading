// ─── Server-side lifecycle email copy (it/en/es/fr/de) ───────────────────────
// Mirrors emailCopy.ts: a server dictionary kept out of the browser bundle.
// ASCII-only (no diacritics) to match that file and stay clear of the i18n
// mojibake guard (Ã/â/Â/ð).

import { getNotificationLanguage } from "../notifications/notificationCopy.js";

export const LIFECYCLE_LANGUAGES = ["it", "en", "es", "fr", "de"] as const;
export type LifecycleLanguage = (typeof LIFECYCLE_LANGUAGES)[number];

export interface LifecycleCopy {
  greeting: string;
  footer: string;
  welcome: {
    subject: string;
    title: string;
    intro: string;
    body: string;
    cta: string;
  };
  digest: {
    subject: (trades: number) => string;
    title: string;
    intro: string;
    empty: string;
    cta: string;
    labels: {
      trades: string;
      winRate: string;
      netR: string;
      streak: string;
      topSymbol: string;
    };
  };
  winback: {
    subject: string;
    title: string;
    intro: (idleDays: number) => string;
    cta: string;
  };
}

const COPY: Record<LifecycleLanguage, LifecycleCopy> = {
  it: {
    greeting: "Ciao,",
    footer:
      "Ricevi questa email perche hai un account TraderLoading. Gestisci le preferenze email nelle impostazioni.",
    welcome: {
      subject: "Benvenuto su TraderLoading",
      title: "Benvenuto a bordo",
      intro: "Il tuo account e pronto. Ecco come iniziare col piede giusto.",
      body: "Registra il tuo primo trade nel diario, collega un broker per la sincronizzazione automatica e tieni d'occhio la disciplina con il coach.",
      cta: "Apri la dashboard",
    },
    digest: {
      subject: (trades) => `La tua settimana: ${trades} trade`,
      title: "La tua settimana di trading",
      intro: "Ecco il riepilogo degli ultimi sette giorni.",
      empty:
        "Nessun trade registrato questa settimana. Torna quando vuoi: bastano pochi minuti per aggiornare il diario.",
      cta: "Apri il diario",
      labels: {
        trades: "Trade",
        winRate: "Win rate",
        netR: "R netto",
        streak: "Serie",
        topSymbol: "Simbolo top",
      },
    },
    winback: {
      subject: "Ci manchi su TraderLoading",
      title: "Riprendi da dove avevi lasciato",
      intro: (idleDays) =>
        `Sono passati ${idleDays} giorni dal tuo ultimo accesso. Il tuo diario e i tuoi progressi ti aspettano.`,
      cta: "Torna al trading",
    },
  },
  en: {
    greeting: "Hi,",
    footer:
      "You received this email because you have a TraderLoading account. Manage email preferences in settings.",
    welcome: {
      subject: "Welcome to TraderLoading",
      title: "Welcome aboard",
      intro: "Your account is ready. Here is how to get off to a strong start.",
      body: "Log your first trade in the journal, connect a broker for automatic sync, and keep an eye on discipline with the coach.",
      cta: "Open the dashboard",
    },
    digest: {
      subject: (trades) => `Your week: ${trades} trades`,
      title: "Your trading week",
      intro: "Here is your recap of the last seven days.",
      empty:
        "No trades logged this week. Come back anytime: a few minutes is all it takes to update your journal.",
      cta: "Open the journal",
      labels: {
        trades: "Trades",
        winRate: "Win rate",
        netR: "Net R",
        streak: "Streak",
        topSymbol: "Top symbol",
      },
    },
    winback: {
      subject: "We miss you at TraderLoading",
      title: "Pick up where you left off",
      intro: (idleDays) =>
        `It has been ${idleDays} days since your last visit. Your journal and progress are waiting for you.`,
      cta: "Back to trading",
    },
  },
  es: {
    greeting: "Hola,",
    footer:
      "Recibes este correo porque tienes una cuenta en TraderLoading. Gestiona las preferencias de correo en los ajustes.",
    welcome: {
      subject: "Bienvenido a TraderLoading",
      title: "Bienvenido a bordo",
      intro: "Tu cuenta esta lista. Asi puedes empezar con buen pie.",
      body: "Registra tu primer trade en el diario, conecta un broker para la sincronizacion automatica y vigila la disciplina con el coach.",
      cta: "Abrir el panel",
    },
    digest: {
      subject: (trades) => `Tu semana: ${trades} trades`,
      title: "Tu semana de trading",
      intro: "Aqui tienes el resumen de los ultimos siete dias.",
      empty:
        "Ningun trade registrado esta semana. Vuelve cuando quieras: unos minutos bastan para actualizar tu diario.",
      cta: "Abrir el diario",
      labels: {
        trades: "Trades",
        winRate: "Tasa de acierto",
        netR: "R neto",
        streak: "Racha",
        topSymbol: "Simbolo top",
      },
    },
    winback: {
      subject: "Te echamos de menos en TraderLoading",
      title: "Retoma donde lo dejaste",
      intro: (idleDays) =>
        `Han pasado ${idleDays} dias desde tu ultima visita. Tu diario y tu progreso te esperan.`,
      cta: "Volver al trading",
    },
  },
  fr: {
    greeting: "Bonjour,",
    footer:
      "Vous recevez cet email car vous avez un compte TraderLoading. Gerez les preferences email dans les parametres.",
    welcome: {
      subject: "Bienvenue sur TraderLoading",
      title: "Bienvenue a bord",
      intro: "Votre compte est pret. Voici comment bien demarrer.",
      body: "Enregistrez votre premier trade dans le journal, connectez un broker pour la synchronisation automatique et surveillez la discipline avec le coach.",
      cta: "Ouvrir le tableau de bord",
    },
    digest: {
      subject: (trades) => `Votre semaine: ${trades} trades`,
      title: "Votre semaine de trading",
      intro: "Voici le recapitulatif des sept derniers jours.",
      empty:
        "Aucun trade enregistre cette semaine. Revenez quand vous voulez: quelques minutes suffisent pour mettre a jour votre journal.",
      cta: "Ouvrir le journal",
      labels: {
        trades: "Trades",
        winRate: "Taux de reussite",
        netR: "R net",
        streak: "Serie",
        topSymbol: "Symbole top",
      },
    },
    winback: {
      subject: "Vous nous manquez sur TraderLoading",
      title: "Reprenez la ou vous vous etes arrete",
      intro: (idleDays) =>
        `Cela fait ${idleDays} jours depuis votre derniere visite. Votre journal et vos progres vous attendent.`,
      cta: "Retour au trading",
    },
  },
  de: {
    greeting: "Hallo,",
    footer:
      "Du erhaeltst diese E-Mail, weil du ein TraderLoading-Konto hast. Verwalte die E-Mail-Einstellungen in den Einstellungen.",
    welcome: {
      subject: "Willkommen bei TraderLoading",
      title: "Willkommen an Bord",
      intro: "Dein Konto ist bereit. So startest du optimal.",
      body: "Trage deinen ersten Trade ins Journal ein, verbinde einen Broker fuer die automatische Synchronisierung und behalte die Disziplin mit dem Coach im Blick.",
      cta: "Dashboard oeffnen",
    },
    digest: {
      subject: (trades) => `Deine Woche: ${trades} Trades`,
      title: "Deine Trading-Woche",
      intro: "Hier ist deine Zusammenfassung der letzten sieben Tage.",
      empty:
        "Diese Woche keine Trades erfasst. Komm jederzeit zurueck: ein paar Minuten reichen, um dein Journal zu aktualisieren.",
      cta: "Journal oeffnen",
      labels: {
        trades: "Trades",
        winRate: "Trefferquote",
        netR: "Netto-R",
        streak: "Serie",
        topSymbol: "Top-Symbol",
      },
    },
    winback: {
      subject: "Wir vermissen dich bei TraderLoading",
      title: "Mach dort weiter, wo du aufgehoert hast",
      intro: (idleDays) =>
        `Es ist ${idleDays} Tage her seit deinem letzten Besuch. Dein Journal und deine Fortschritte warten auf dich.`,
      cta: "Zurueck zum Trading",
    },
  },
};

export function getLifecycleCopy(language: unknown): LifecycleCopy {
  return COPY[getNotificationLanguage(language) as LifecycleLanguage];
}
