// ─── Server-side email copy (it/en/es/fr/de) ─────────────────────────────────
// Mirrors services/notifications/notificationCopy.ts: a server dictionary kept
// out of the browser bundle. ASCII-only (no diacritics) to match that file and
// to stay clear of the i18n mojibake guard (Ã/â/Â/ð).

import { getNotificationLanguage } from "../notifications/notificationCopy.js";

export const EMAIL_LANGUAGES = ["it", "en", "es", "fr", "de"] as const;
export type EmailLanguage = (typeof EMAIL_LANGUAGES)[number];

export interface EmailCopy {
  cta: string;
  footer: string;
  greeting: string;
  ticketCreated: {
    title: string;
    subject: (id: number) => string;
    intro: (subject: string) => string;
  };
  ticketReply: {
    title: string;
    subject: (subject: string) => string;
    intro: (subject: string) => string;
  };
  ticketStatus: {
    subject: (label: string) => string;
    title: (label: string) => string;
    intro: (subject: string, label: string) => string;
  };
  statusLabel: (status: string) => string;
}

function statusLabeller(labels: Record<string, string>) {
  return (status: string): string => labels[status] ?? status;
}

const COPY: Record<EmailLanguage, EmailCopy> = {
  it: {
    cta: "Apri la conversazione",
    footer:
      "Ricevi questa email perche hai una richiesta di assistenza su TraderLoading.",
    greeting: "Ciao,",
    ticketCreated: {
      title: "Richiesta ricevuta",
      subject: (id) => `Richiesta #${id} ricevuta`,
      intro: (subject) =>
        `Abbiamo ricevuto la tua richiesta "${subject}". Un membro del team ti rispondera presto.`,
    },
    ticketReply: {
      title: "Nuova risposta dal supporto",
      subject: (subject) => `Re: ${subject}`,
      intro: (subject) =>
        `Il team di assistenza ha risposto alla tua richiesta "${subject}".`,
    },
    ticketStatus: {
      subject: (label) => `Aggiornamento richiesta: ${label}`,
      title: (label) => `Stato aggiornato: ${label}`,
      intro: (subject, label) =>
        `Lo stato della tua richiesta "${subject}" e ora: ${label}.`,
    },
    statusLabel: statusLabeller({
      open: "Aperta",
      pending: "In lavorazione",
      closed: "Chiusa",
    }),
  },
  en: {
    cta: "Open the conversation",
    footer:
      "You received this email because you have a support request on TraderLoading.",
    greeting: "Hi,",
    ticketCreated: {
      title: "Request received",
      subject: (id) => `Request #${id} received`,
      intro: (subject) =>
        `We received your request "${subject}". A team member will reply soon.`,
    },
    ticketReply: {
      title: "New reply from support",
      subject: (subject) => `Re: ${subject}`,
      intro: (subject) =>
        `The support team replied to your request "${subject}".`,
    },
    ticketStatus: {
      subject: (label) => `Request update: ${label}`,
      title: (label) => `Status updated: ${label}`,
      intro: (subject, label) =>
        `The status of your request "${subject}" is now: ${label}.`,
    },
    statusLabel: statusLabeller({
      open: "Open",
      pending: "In progress",
      closed: "Closed",
    }),
  },
  es: {
    cta: "Abrir la conversacion",
    footer:
      "Recibes este correo porque tienes una solicitud de soporte en TraderLoading.",
    greeting: "Hola,",
    ticketCreated: {
      title: "Solicitud recibida",
      subject: (id) => `Solicitud #${id} recibida`,
      intro: (subject) =>
        `Hemos recibido tu solicitud "${subject}". Un miembro del equipo respondera pronto.`,
    },
    ticketReply: {
      title: "Nueva respuesta de soporte",
      subject: (subject) => `Re: ${subject}`,
      intro: (subject) =>
        `El equipo de soporte respondio a tu solicitud "${subject}".`,
    },
    ticketStatus: {
      subject: (label) => `Actualizacion de la solicitud: ${label}`,
      title: (label) => `Estado actualizado: ${label}`,
      intro: (subject, label) =>
        `El estado de tu solicitud "${subject}" ahora es: ${label}.`,
    },
    statusLabel: statusLabeller({
      open: "Abierta",
      pending: "En curso",
      closed: "Cerrada",
    }),
  },
  fr: {
    cta: "Ouvrir la conversation",
    footer:
      "Vous recevez cet email car vous avez une demande d'assistance sur TraderLoading.",
    greeting: "Bonjour,",
    ticketCreated: {
      title: "Demande recue",
      subject: (id) => `Demande #${id} recue`,
      intro: (subject) =>
        `Nous avons recu votre demande "${subject}". Un membre de l'equipe vous repondra bientot.`,
    },
    ticketReply: {
      title: "Nouvelle reponse du support",
      subject: (subject) => `Re: ${subject}`,
      intro: (subject) =>
        `L'equipe d'assistance a repondu a votre demande "${subject}".`,
    },
    ticketStatus: {
      subject: (label) => `Mise a jour de la demande: ${label}`,
      title: (label) => `Statut mis a jour: ${label}`,
      intro: (subject, label) =>
        `Le statut de votre demande "${subject}" est maintenant: ${label}.`,
    },
    statusLabel: statusLabeller({
      open: "Ouverte",
      pending: "En cours",
      closed: "Fermee",
    }),
  },
  de: {
    cta: "Konversation oeffnen",
    footer:
      "Du erhaeltst diese E-Mail, weil du eine Supportanfrage bei TraderLoading hast.",
    greeting: "Hallo,",
    ticketCreated: {
      title: "Anfrage erhalten",
      subject: (id) => `Anfrage #${id} erhalten`,
      intro: (subject) =>
        `Wir haben deine Anfrage "${subject}" erhalten. Ein Teammitglied antwortet bald.`,
    },
    ticketReply: {
      title: "Neue Antwort vom Support",
      subject: (subject) => `Re: ${subject}`,
      intro: (subject) =>
        `Das Support-Team hat auf deine Anfrage "${subject}" geantwortet.`,
    },
    ticketStatus: {
      subject: (label) => `Anfrage-Update: ${label}`,
      title: (label) => `Status aktualisiert: ${label}`,
      intro: (subject, label) =>
        `Der Status deiner Anfrage "${subject}" ist jetzt: ${label}.`,
    },
    statusLabel: statusLabeller({
      open: "Offen",
      pending: "In Bearbeitung",
      closed: "Geschlossen",
    }),
  },
};

export function getEmailCopy(language: unknown): EmailCopy {
  return COPY[getNotificationLanguage(language) as EmailLanguage];
}
